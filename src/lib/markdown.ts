import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import { fromHighlighter } from '@shikijs/markdown-it/core'
import { createHighlighter, type HighlighterGeneric } from 'shiki'
import type { Heading } from '../types'

const slugCounts = new Map<string, number>()
const slugify = (value: string) => {
  const base = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/<[^>]+>/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'section'
  const count = slugCounts.get(base) ?? 0
  slugCounts.set(base, count + 1)
  return count ? `${base}-${count}` : base
}

const languageAliases: Record<string, string> = {
  js: 'javascript', ts: 'typescript', shell: 'bash', sh: 'bash', yml: 'yaml', blade: 'blade',
  py: 'python', rb: 'ruby', cs: 'csharp', cxx: 'cpp', vue: 'vue', jsx: 'jsx', tsx: 'tsx',
}

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | undefined
let parserPromise: Promise<MarkdownIt> | undefined

async function getHighlighter() {
  highlighterPromise ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: [] }) as Promise<HighlighterGeneric<string, string>>
  return highlighterPromise
}

async function loadLanguages(source: string) {
  const highlighter = await getHighlighter()
  const requested = [...source.matchAll(/^(?:`{3,}|~{3,})\s*([\w#+.-]+)/gm)].map((match) => languageAliases[match[1].toLowerCase()] ?? match[1].toLowerCase())
  const loaded = new Set(highlighter.getLoadedLanguages())
  await Promise.all([...new Set(requested)].filter((language) => !loaded.has(language)).map(async (language) => {
    try { await highlighter.loadLanguage(language) } catch { /* Unknown languages render as plain code. */ }
  }))
  return requested
}

async function getParser() {
  if (!parserPromise) parserPromise = (async () => {
    const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false })
    md.use(footnote as never).use(taskLists as never, { enabled: true, label: true })
    const highlighter = await getHighlighter()
    md.use(fromHighlighter(highlighter as never, { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false }))
    const shikiHighlight = md.options.highlight
    md.options.highlight = (source, language, attributes) => {
      try { return shikiHighlight?.(source, languageAliases[language] ?? language, attributes) ?? '' } catch { return '' }
    }
    const originalFence = md.renderer.rules.fence
    md.renderer.rules.fence = (tokens, index, options, env, self) => {
      const language = tokens[index].info.trim().split(/\s+/)[0].toLowerCase()
      if (['mermaid', 'uml'].includes(language)) return `<div class="mermaid" data-diagram="true">${md.utils.escapeHtml(tokens[index].content)}</div>`
      return originalFence ? originalFence(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
    }
    const original = md.renderer.rules.heading_open ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))
    md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
      const inline = tokens[index + 1]
      tokens[index].attrSet('id', slugify(inline?.content ?? 'section'))
      return original(tokens, index, options, env, self)
    }
    const linkOpen = md.renderer.rules.link_open ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))
    md.renderer.rules.link_open = (tokens, index, options, env, self) => {
      const href = tokens[index].attrGet('href') ?? ''
      if (/^https?:\/\//.test(href)) { tokens[index].attrSet('target', '_blank'); tokens[index].attrSet('rel', 'noopener noreferrer') }
      return linkOpen(tokens, index, options, env, self)
    }
    return md
  })()
  return parserPromise
}

export async function renderMarkdown(source: string): Promise<{ html: string; headings: Heading[] }> {
  slugCounts.clear()
  await loadLanguages(source)
  const parser = await getParser()
  const rendered = parser.render(source)
  const container = document.createElement('div')
  container.innerHTML = DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true }, ADD_ATTR: ['target', 'rel', 'checked', 'disabled'] })
  container.querySelectorAll('pre').forEach((pre) => {
    const wrapper = document.createElement('div'); wrapper.className = 'code-block'
    const toolbar = document.createElement('div'); toolbar.className = 'code-toolbar'
    const languageClass = [...(pre.querySelector('code')?.classList ?? [])].find((name) => name.startsWith('language-'))
    const label = document.createElement('span'); label.textContent = languageClass?.slice('language-'.length) || 'text'
    const button = document.createElement('button'); button.type = 'button'; button.className = 'copy-code'; button.dataset.copyCode = ''; button.setAttribute('aria-label', 'Sao chép code'); button.textContent = 'Sao chép'
    toolbar.append(label, button)
    pre.parentNode?.insertBefore(wrapper, pre)
    wrapper.append(toolbar, pre)
  })
  const headings = [...container.querySelectorAll<HTMLElement>('h1,h2,h3')].map((node) => ({ id: node.id, level: Number(node.tagName[1]), text: node.textContent ?? '' }))
  return { html: container.innerHTML, headings }
}
