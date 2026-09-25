import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import type { Heading } from '../types'
import { highlightInWorker } from './highlight-client'

const slugCounts = new Map<string, number>()
const slugify = (value: string) => {
  const base = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/<[^>]+>/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'section'
  const count = slugCounts.get(base) ?? 0
  slugCounts.set(base, count + 1)
  return count ? `${base}-${count}` : base
}

let parserPromise: Promise<MarkdownIt> | undefined

async function getParser() {
  if (!parserPromise) parserPromise = (async () => {
    const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false })
    md.use(footnote as never).use(taskLists as never, { enabled: true, label: true })
    md.renderer.rules.fence = (tokens, index) => {
      const language = tokens[index].info.trim().split(/\s+/)[0].toLowerCase()
      if (['mermaid', 'uml'].includes(language)) return `<div class="mermaid" data-diagram="true">${md.utils.escapeHtml(tokens[index].content)}</div>`
      return `<pre data-highlight="true" data-language="${md.utils.escapeHtml(language || 'text')}"><code class="language-${md.utils.escapeHtml(language || 'text')}">${md.utils.escapeHtml(tokens[index].content)}</code></pre>`
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

export async function renderMarkdown(source: string, options: { allowRemoteImages?: boolean } = {}): Promise<{ html: string; headings: Heading[] }> {
  slugCounts.clear()
  const parser = await getParser()
  const rendered = parser.render(source)
  const container = document.createElement('div')
  container.innerHTML = DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true }, ADD_ATTR: ['target', 'rel', 'checked', 'disabled'] })
  const pending = [...container.querySelectorAll<HTMLElement>('pre[data-highlight]')]
  const highlighted = await highlightInWorker(pending.map((pre) => ({ source: pre.textContent ?? '', language: pre.dataset.language ?? 'text' })))
  pending.forEach((pre, index) => {
    if (!highlighted[index]) return
    const replacement = document.createElement('div')
    replacement.innerHTML = DOMPurify.sanitize(highlighted[index], { USE_PROFILES: { html: true }, ADD_ATTR: ['style', 'class'] })
    const highlightedPre = replacement.querySelector('pre')
    if (highlightedPre) { highlightedPre.dataset.language = pre.dataset.language ?? 'text'; pre.replaceWith(highlightedPre) }
  })
  if (!options.allowRemoteImages) container.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const source = image.getAttribute('src') ?? ''
    if (/^https?:\/\//i.test(source)) {
      const placeholder = document.createElement('span')
      placeholder.className = 'remote-image-blocked'
      placeholder.textContent = `Ảnh từ xa đã bị chặn${image.alt ? `: ${image.alt}` : ''}`
      placeholder.title = source
      image.replaceWith(placeholder)
    }
  })
  container.querySelectorAll('pre').forEach((pre) => {
    const wrapper = document.createElement('div'); wrapper.className = 'code-block'
    const toolbar = document.createElement('div'); toolbar.className = 'code-toolbar'
    const languageClass = [...(pre.querySelector('code')?.classList ?? [])].find((name) => name.startsWith('language-'))
    const label = document.createElement('span'); label.textContent = pre.dataset.language || languageClass?.slice('language-'.length) || 'text'
    const button = document.createElement('button'); button.type = 'button'; button.className = 'copy-code'; button.dataset.copyCode = ''; button.setAttribute('aria-label', 'Sao chép code'); button.textContent = 'Sao chép'
    toolbar.append(label, button)
    pre.parentNode?.insertBefore(wrapper, pre)
    wrapper.append(toolbar, pre)
  })
  const headings = [...container.querySelectorAll<HTMLElement>('h1,h2,h3')].map((node) => ({ id: node.id, level: Number(node.tagName[1]), text: node.textContent ?? '' }))
  return { html: container.innerHTML, headings }
}
