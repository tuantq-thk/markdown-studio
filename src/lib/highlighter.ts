import { createHighlighterCore, type HighlighterGeneric } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'

const aliases: Record<string, string> = { js: 'javascript', ts: 'typescript', shell: 'bash', sh: 'bash', yml: 'yaml', py: 'python', rb: 'ruby', cs: 'csharp', cxx: 'cpp' }
const loaders: Record<string, () => Promise<unknown>> = {
  bash: () => import('@shikijs/langs/bash').then((module) => module.default),
  css: () => import('@shikijs/langs/css').then((module) => module.default),
  diff: () => import('@shikijs/langs/diff').then((module) => module.default),
  docker: () => import('@shikijs/langs/docker').then((module) => module.default),
  go: () => import('@shikijs/langs/go').then((module) => module.default),
  html: () => import('@shikijs/langs/html').then((module) => module.default),
  java: () => import('@shikijs/langs/java').then((module) => module.default),
  javascript: () => import('@shikijs/langs/javascript').then((module) => module.default),
  json: () => import('@shikijs/langs/json').then((module) => module.default),
  jsx: () => import('@shikijs/langs/jsx').then((module) => module.default),
  markdown: () => import('@shikijs/langs/markdown').then((module) => module.default),
  php: () => import('@shikijs/langs/php').then((module) => module.default),
  python: () => import('@shikijs/langs/python').then((module) => module.default),
  ruby: () => import('@shikijs/langs/ruby').then((module) => module.default),
  rust: () => import('@shikijs/langs/rust').then((module) => module.default),
  scss: () => import('@shikijs/langs/scss').then((module) => module.default),
  sql: () => import('@shikijs/langs/sql').then((module) => module.default),
  tsx: () => import('@shikijs/langs/tsx').then((module) => module.default),
  typescript: () => import('@shikijs/langs/typescript').then((module) => module.default),
  vue: () => import('@shikijs/langs/vue').then((module) => module.default),
  yaml: () => import('@shikijs/langs/yaml').then((module) => module.default),
  c: () => import('@shikijs/langs/c').then((module) => module.default),
  cpp: () => import('@shikijs/langs/cpp').then((module) => module.default),
  csharp: () => import('@shikijs/langs/csharp').then((module) => module.default),
}
let highlighterPromise: Promise<HighlighterGeneric<string, string>> | undefined

const getHighlighter = () => {
  highlighterPromise ??= createHighlighterCore({
    themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
    langs: [],
    engine: createOnigurumaEngine(import('shiki/wasm')),
  }) as Promise<HighlighterGeneric<string, string>>
  return highlighterPromise
}

export async function highlightBlocks(blocks: Array<{ source: string; language: string }>) {
  const highlighter = await getHighlighter()
  const languages = [...new Set(blocks.map((block) => aliases[block.language] ?? block.language).filter((language) => Boolean(loaders[language])))]
  const loaded = new Set(highlighter.getLoadedLanguages())
  await Promise.all(languages.filter((language) => !loaded.has(language)).map(async (language) => { try { await highlighter.loadLanguage(await loaders[language]() as never) } catch { /* plain fallback */ } }))
  return blocks.map((block) => {
    const language = aliases[block.language] ?? block.language
    try { return highlighter.codeToHtml(block.source, { lang: loaders[language] ? language : 'text', themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false }) }
    catch { return '' }
  })
}
