import fsp from 'node:fs/promises'
import path from 'node:path'
import type { UnpluginFactory } from 'unplugin'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Options } from './types'
import { PLUGIN_NAME } from './constant'
import { generateInsertCode, hash, importCss_RE } from './utils'

// support for other css language ?🤔
export const unpluginFactory: UnpluginFactory<Options | undefined> = () => {
  const needTransformedCssMap = new Set()
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    transformInclude(id) {
      return id.endsWith('.tsx') || id.endsWith('.css')
    },
    async transform(code, id) {
      if (id.endsWith('.css')) {
        if (!needTransformedCssMap.has(id))
          return
        const newCssContent = code.replace(/v-bind\(([^)]+)\)/g, (_, args) => {
          // 可能有默认值
          const [cssVar, cssDefault] = args.split(',')
          return cssDefault
            ? `var(--${cssVar},${cssDefault})`
            : `var(--${cssVar})`
        })
        return newCssContent
      }
      const vbindMap = new Set<string>()

      for (const cssMatch of code.matchAll(importCss_RE)) {
        const url = cssMatch[1]
        const absoluteUrl = path.resolve(path.dirname(id), url)
        const cssContent = await fsp.readFile(absoluteUrl, 'utf-8')
        // 如果没使用 v-bind 语法,直接返回
        if (!/v-bind\(/.test(cssContent))
          continue

        for (const cssMatch of cssContent.matchAll(/v-bind\(([^)]+)\)/g)) {
          const [cssVar] = cssMatch[1].split(',')
          vbindMap.add(cssVar)
        }

        needTransformedCssMap.add(absoluteUrl)
      }

      if (vbindMap.size === 0)
        return

      // 注入 fileName 的 hash 值
      // 如果 return 顶层不是 Fragment, 则直接在后面注入, 否则要给 children 下的每一个元素注入
      const fileNameHash = hash(id)
      // 当打包时候就不再是 jsxDEV 而是 jsxs
      const fragmentMatch = code.match(/return\s+(?:\/\* @__PURE__ \*\/\s*)?(?:jsxDEV|jsxs?)\(Fragment,\s*\{.*children/)
      if (fragmentMatch) {
        // const fragmentMatch
        const changed = code.slice(fragmentMatch.index! + fragmentMatch[0].length).replace(/children:\s*(?:\[((?:[^[\]]|\[[^[\]]*\])*)\]|"[^"]*"|(?:\/\* @__PURE__ \*\/\s*)?jsxDEV\(((?:[^()]|\([^()]*\))*)\))/g, _ => ' '.repeat(_.length))
        let offset = 0
        for (const changedMatch of changed.matchAll(/(?:\/\* @__PURE__ \*\/)?\s*(?:jsxDEV|jsxs?)\([^,]+,\s*\{/g)) {
          const pos = fragmentMatch.index! + fragmentMatch[0].length + changedMatch.index! + changedMatch[0].length + offset
          const changedText = ` 'v-bind-id': '${fileNameHash}',`
          offset += changedText.length
          code = code.slice(0, pos) + changedText + code.slice(pos)
        }
      }
      else {
        const notFragmentMatch = code.match(/return\s+(?:\/\* @__PURE__ \*\/\s*)?(?:jsxDEV|jsxs?)\([^,]+,\s*\{/)
        if (notFragmentMatch) {
          code = code.replace(notFragmentMatch[0], `${notFragmentMatch[0]} 'v-bind-id': '${fileNameHash}',`)
        }
      }
      // 查找使用 vbindMap 中的变量的语句 useState 或者 useRef
      Array.from(vbindMap).forEach((vbind) => {
        const type = 'useState'
        const dynamicUseState_RE = new RegExp(`(\\s*)(?:const|let|var)\\s+\\[(${vbind})\\s*,\\s*[^\\]]*\\]\\s*=\\s*${type}\\([^)]*\\)`)
        const useStateMatch = code.match(dynamicUseState_RE)
        if (useStateMatch) {
          // 在顶部依赖中添加 useEffect
          code = generateInsertCode(code, vbind, fileNameHash, useStateMatch, type)
        }
        else {
          /**
           * 似乎 useRef 并不会触发 useEffect, 所以这里不处理
           */
          // useRef

          // const type = 'useRef'
          // const dynamicUseRef_RE = new RegExp(`(\\s*)(?:const|let|var)\\s+(${vbind})\\s*=\\s*${type}\\([^\\)]*\\)`)
          // const useRefMatch = code.match(dynamicUseRef_RE)
          // if (!useRefMatch)
          //   return
          // code = generateInsertCode(code, vbind, fileNameHash, useRefMatch, type)
        }
      })
      const s = new MagicString(code)
      const mappings = [s.generateMap({ hires: true, source: id })]
      return {
        code,
        map: JSON.stringify({
          file: id,
          mappings,
          sources: [code],
          version: 3,
        }),
      }
    },
  }
}

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin
