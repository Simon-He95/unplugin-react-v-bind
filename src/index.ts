import fsp from 'node:fs/promises'
import path from 'node:path'
import type { UnpluginFactory } from 'unplugin'
import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { PLUGIN_NAME } from './constant'

export const unpluginFactory: UnpluginFactory<Options | undefined> = (options) => {
  const importCss_RE = /import\s+['"](.+\.css)['"]/
  const importReact_RE = /import\s+(?:\w+,\s*)?\{([^}]+)\}\s+from\s+['"]react["']/
  const needTransformedCssMap = new Set()
  return {
    name: PLUGIN_NAME,
    transformInclude(id) {
      return id.endsWith('.tsx') || id.endsWith('.css')
    },
    async transform(code, id) {
      if (id.endsWith('.css')) {
        if (!needTransformedCssMap.has(id))
          return

        const newCssContent = code.replace(/v-bind\(([^)]+)\)/g, (match, args) => {
          // 可能有默认值
          const [cssVar, cssDefault] = args.split(',')
          return cssDefault
            ? `var(--${cssVar},${cssDefault})`
            : `var(--${cssVar})`
        })
        return newCssContent
      }
      const cssMatch = code.match(importCss_RE)
      const vbindMap = new Set<string>()
      if (!cssMatch) {
        return
      }
      const url = cssMatch[1]
      const absoulteUrl = path.resolve(path.dirname(id), url)
      const cssContent = await fsp.readFile(absoulteUrl, 'utf-8')
      // 如果没使用 v-bind 语法,直接返回
      if (!/v-bind\(/.test(cssContent))
        return

      for (const cssMatch of cssContent.matchAll(/v-bind\(([^)]+)\)/g)) {
        const [cssVar] = cssMatch[1].split(',')
        vbindMap.add(cssVar)
      }

      needTransformedCssMap.add(absoulteUrl)
      // 注入 fileName 的 hash 值
      // 如果 return 顶层不是 Fragment, 则直接在后面注入, 否则要给 children 下的每一个元素注入
      const fileNameHash = hash(absoulteUrl)
      const fragmentMatch = code.match(/return\s+(?:\/\* @__PURE__ \*\/\s*)?jsxDEV\(Fragment,\s*\{.*children/)
      if (fragmentMatch) {
        // const fragmentMatch
        const changed = code.slice(fragmentMatch.index! + fragmentMatch[0].length).replace(/children:\s*(?:\[((?:[^[\]]|\[[^[\]]*\])*)\]|"[^"]*"|(?:\/\* @__PURE__ \*\/\s*)?jsxDEV\(((?:[^()]|\([^()]*\))*)\))/g, _ => ' '.repeat(_.length))
        let offset = 0
        for (const changedMatch of changed.matchAll(/(?:\/\* @__PURE__ \*\/)?\s*jsxDEV\([^,]+,\s*\{/g)) {
          const pos = fragmentMatch.index! + fragmentMatch[0].length + changedMatch.index! + changedMatch[0].length + offset
          const changedText = ` 'v-bind-id': '${fileNameHash}',`
          offset += changedText.length
          code = code.slice(0, pos) + changedText + code.slice(pos)
        }
      }
      else {
        const notFragmentMatch = code.match(/return\s+(?:\/\* @__PURE__ \*\/\s*)?jsxDEV\([^,]+,\s*\{/)
        if (notFragmentMatch) {
          code = code.replace(notFragmentMatch[0], `${notFragmentMatch[0]} 'v-bind-id': '${fileNameHash}',`)
        }
      }
      // 查找使用 vbindMap 中的变量的语句 useState 或者 useRef
      Array.from(vbindMap).forEach((vbind) => {
        const dynamicUseState_RE = new RegExp(`(\\s*)(?:const|let|var)\\s+\\[(${vbind})\\s*,\\s*[^\\]]*\\]\\s*=\\s*useState\\([^)]*\\)`)
        const useStateMatch = code.match(dynamicUseState_RE)
        if (useStateMatch) {
          // 在顶部依赖中添加 useEffect
          const importMatch = code.match(importReact_RE)
          if (importMatch) {
            // 判断 {} 中是否有 useEffect, 有则不处理, 无则追加
            if (!importMatch[1].includes('useEffect')) {
              code = code.replace(importMatch[0], importMatch[0].replace(importMatch[1], ` ${importMatch[1].trim()}, useEffect `))
            }
          }
          else {
            // 在第一行追加 import { useEffect } from 'react'
            code = `import { useEffect } from 'react'\n${code}`
          }
          // 找到在该行代码后一行追加代码
          const space = useStateMatch[1]
          // 不希望通过 style 去设置, 而是通过 styleSheet 去设置
          const insertCode = `${space.replace('\n', '')}useEffect(() => {${space}  ${[
            `const styleSheet = Array.from(document.styleSheets).find(sheet => sheet.ownerNode.getAttribute('react-v-bind'));`,
            `const newStyleSheet = document.createElement('style');`,
            `newStyleSheet.setAttribute('react-v-bind', 'true');`,
            `newStyleSheet.innerHTML = \`[v-bind-id="${fileNameHash}"] { --${vbind}: \${${useStateMatch[2]}}; }\`;`,
            `if (styleSheet) {`,
            `  document.head.removeChild(styleSheet.ownerNode);`,
            `}`,
            `document.head.appendChild(newStyleSheet);`,
            `}, [${useStateMatch[2]}])`,
          ].join(`${space}  `)}`
          code = code.replace(useStateMatch[0], `${useStateMatch[0]}\n${insertCode}`)
        }
        else {
          // useRef
          const dynamigcUseRef_RE = new RegExp(`(\\s*)(?:const|let|var)\\s+(${vbind})\\s*=\\s*useRef\\([]\\)`)
          const useRefMatch = code.match(dynamigcUseRef_RE)
          if (!useRefMatch)
            return
          // 在顶部依赖中添加 useEffect
          const importMatch = code.match(importReact_RE)
          if (importMatch) {
            // 判断 {} 中是否有 useRef, 有则不处理, 无则追加
            if (!importMatch[1].includes('useRef')) {
              code = code.replace(importMatch[0], importMatch[0].replace(importMatch[1], ` ${importMatch[1].trim()}, useRef `))
            }
          }
          else {
            // 在第一行追加 import { useRef } from 'react'
            code = `import { useRef } from 'react'\n${code}`
          }
          const space = useRefMatch[1]
          const insertCode = `${space.replace('\n', '')}useEffect(() => {${space}  ${[
            `const styleSheet = Array.from(document.styleSheets).find(sheet => sheet.ownerNode.getAttribute('react-v-bind'));`,
            `const newStyleSheet = document.createElement('style');`,
            `newStyleSheet.setAttribute('react-v-bind', 'true');`,
            `newStyleSheet.innerHTML = \`[v-bind-id="${fileNameHash}"] { --${vbind}: \${${useRefMatch[2]}}; }\`;`,
            `if (styleSheet) {`,
            `  document.head.removeChild(styleSheet.ownerNode);`,
            `}`,
            `document.head.appendChild(newStyleSheet);`,
            `}, [${useRefMatch[2]}.current])`,
          ].join(`${space}  `)}`

          code = code.replace(useRefMatch[0], `${useRefMatch[0]}\n${insertCode}`)
        }
      })
      return code
    },
  }
}

function hash(str: string) {
  let i
  let l
  let hval = 0x811C9DC5

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i)
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24)
  }
  return `00000${(hval >>> 0).toString(36)}`.slice(-6)
}
export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin
