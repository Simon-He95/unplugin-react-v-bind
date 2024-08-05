export function hash(str: string) {
  let i
  let l
  let hval = 0x811C9DC5

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i)
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24)
  }
  return `00000${(hval >>> 0).toString(36)}`.slice(-6)
}

export const importReact_RE = /import\s+(?:\w+,\s*)?\{([^}]+)\}\s+from\s+['"]react["']/
export const importCss_RE = /import\s+['"]([./].+\.css)['"]/g /* 只处理相对路径的 css 文件 */
export function generateInsertCode(code: string, vbind: string, fileNameHash: string, useStateMatch: any, type: 'useState' | 'useRef') {
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
  const space = useStateMatch[1]
  const variable = type === 'useRef' ? `${useStateMatch[2]}.current` : useStateMatch[2]
  const insertCode = `${space.replace('\n', '')}useEffect(() => {${space}  ${[
    `const styleSheet = Array.from(document.styleSheets).find(sheet => sheet.ownerNode.getAttribute('react-v-bind'));`,
    `const newStyleSheet = document.createElement('style');`,
    `newStyleSheet.setAttribute('react-v-bind', 'true');`,
    `if (styleSheet) {`,
    `   if(styleSheet.ownerNode.innerHTML.includes('[v-bind-id="${fileNameHash}"]')) {`,
    `     newStyleSheet.innerHTML = styleSheet.ownerNode.innerHTML.replace(/\\[v-bind-id="${fileNameHash}"\\] { [^}]+ }/, \`[v-bind-id="${fileNameHash}"] { --${vbind}: \${${variable}}; }\`);`,
    `   }`,
    `   else {`,
    `     newStyleSheet.innerHTML += styleSheet.ownerNode.innerHTML + \`\n[v-bind-id="${fileNameHash}"] { --${vbind}: \${${variable}}; }\``,
    `   }`,
    `  document.head.removeChild(styleSheet.ownerNode);`,
    `}`,
    `else {`,
    `   newStyleSheet.innerHTML = \`[v-bind-id="${fileNameHash}"] { --${vbind}: \${${variable}}; }\``,
    `}`,
    `document.head.appendChild(newStyleSheet);`,
    `}, [${variable}])`,
  ].join(`${space}  `)}`
  return code = code.replace(useStateMatch[0], `${useStateMatch[0]}\n${insertCode}`)
}
