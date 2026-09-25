import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('Markdown rendering', () => {
  it('renders headings, stable duplicate slugs and TOC data', async () => {
    const result = await renderMarkdown('# Tổng quan\n\n## Ví dụ\n\n## Ví dụ')
    expect(result.html).toContain('id="tong-quan"')
    expect(result.html).toContain('id="vi-du-1"')
    expect(result.headings.map((heading) => heading.id)).toEqual(['tong-quan', 'vi-du', 'vi-du-1'])
  })

  it('does not execute or retain raw script HTML', async () => {
    const result = await renderMarkdown('# Safe\n\n<script>alert(1)</script>')
    expect(result.html).not.toContain('<script')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('adds safe attributes to external links', async () => {
    const result = await renderMarkdown('[OpenAI](https://openai.com)')
    expect(result.html).toContain('target="_blank"')
    expect(result.html).toContain('rel="noopener noreferrer"')
  })

  it('highlights PHP code with Shiki', async () => {
    const result = await renderMarkdown('```php\n$posts = Post::query()->get();\n```')
    expect(result.html).toContain('class="shiki')
    expect(result.html).toContain('--shiki-dark')
    const container = document.createElement('div')
    container.innerHTML = result.html
    const tokenColors = new Set([...container.querySelectorAll<HTMLElement>('code span')].map((span) => span.style.getPropertyValue('--shiki-light')).filter(Boolean))
    expect(tokenColors.size).toBeGreaterThan(2)
  })

  it('renders an unknown code fence without crashing', async () => {
    await expect(renderMarkdown('```unknown-language\nhello\n```')).resolves.toMatchObject({ headings: [] })
  })

  it('loads bundled grammars on demand and adds copy controls', async () => {
    const result = await renderMarkdown('```python\nprint("hello")\n```\n\n```java\nclass App {}\n```')
    expect(result.html.match(/class="shiki/g)).toHaveLength(2)
    expect(result.html.match(/data-copy-code/g)).toHaveLength(2)
    expect(result.html).toContain('>python<')
    expect(result.html).toContain('>java<')
    expect(result.html).toContain('--shiki-light')
    expect(result.html).toContain('--shiki-dark')
  })

  it('keeps code labels aligned and supports tilde fences', async () => {
    const result = await renderMarkdown('```php\necho 1;\n```\n\n```\nplain\n```\n\n~~~javascript\nconst ok = true\n~~~')
    const container = document.createElement('div')
    container.innerHTML = result.html
    const labels = [...container.querySelectorAll('.code-toolbar span')].map((node) => node.textContent)
    expect(labels).toEqual(['php', 'text', 'javascript'])
  })

  it('preserves Mermaid and UML fences for the diagram renderer', async () => {
    const result = await renderMarkdown('```mermaid\nflowchart LR\n A --> B\n```\n\n```uml\nclassDiagram\n A <|-- B\n```')
    expect(result.html.match(/class="mermaid"/g)).toHaveLength(2)
    expect(result.html.match(/data-diagram="true"/g)).toHaveLength(2)
    expect(result.html).not.toContain('data-copy-code')
  })

  it('supports task lists, tables, strikethrough and footnotes', async () => {
    const source = '- [x] Done\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n~~old~~ and note[^1]\n\n[^1]: Detail'
    const result = await renderMarkdown(source)
    expect(result.html).toContain('task-list-item')
    expect(result.html).toContain('<table>')
    expect(result.html).toContain('<s>old</s>')
    expect(result.html).toContain('class="footnotes"')
  })

  it('blocks remote images by default and allows an explicit opt-in', async () => {
    const source = '![Tracking pixel](https://example.com/pixel.png)'
    const blocked = await renderMarkdown(source)
    expect(blocked.html).toContain('remote-image-blocked')
    expect(blocked.html).not.toContain('<img')
    const allowed = await renderMarkdown(source, { allowRemoteImages: true })
    expect(allowed.html).toContain('<img')
  })
})
