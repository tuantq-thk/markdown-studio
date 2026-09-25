export type MarkdownFormat = 'h1' | 'h2' | 'h3' | 'bold' | 'italic' | 'strike' | 'code' | 'codeblock' | 'link' | 'quote' | 'bullet' | 'number' | 'task' | 'rule'
export type FormatResult = { value: string; selectionStart: number; selectionEnd: number }

const wrap = (value: string, start: number, end: number, before: string, after = before, placeholder = 'văn bản'): FormatResult => {
  const selected = value.slice(start, end) || placeholder
  const replacement = `${before}${selected}${after}`
  const cursorStart = start + before.length
  return { value: value.slice(0, start) + replacement + value.slice(end), selectionStart: cursorStart, selectionEnd: cursorStart + selected.length }
}

const prefixLines = (value: string, start: number, end: number, prefix: (index: number) => string): FormatResult => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak < 0 ? value.length : nextBreak
  const selected = value.slice(lineStart, lineEnd)
  const replacement = selected.split('\n').map((line, index) => `${prefix(index)}${line}`).join('\n')
  return { value: value.slice(0, lineStart) + replacement + value.slice(lineEnd), selectionStart: lineStart, selectionEnd: lineStart + replacement.length }
}

export function applyMarkdownFormat(value: string, start: number, end: number, format: MarkdownFormat): FormatResult {
  if (format === 'bold') return wrap(value, start, end, '**', '**')
  if (format === 'italic') return wrap(value, start, end, '_', '_')
  if (format === 'strike') return wrap(value, start, end, '~~', '~~')
  if (format === 'code') return wrap(value, start, end, '`', '`', 'code')
  if (format === 'link') return wrap(value, start, end, '[', '](https://)', 'liên kết')
  if (format === 'codeblock') return wrap(value, start, end, '```text\n', '\n```', 'code')
  if (format === 'rule') return { value: `${value.slice(0, start)}\n\n---\n\n${value.slice(end)}`, selectionStart: start + 7, selectionEnd: start + 7 }
  const prefixes: Record<Exclude<MarkdownFormat, 'bold' | 'italic' | 'strike' | 'code' | 'codeblock' | 'link' | 'rule'>, (index: number) => string> = {
    h1: () => '# ', h2: () => '## ', h3: () => '### ', quote: () => '> ', bullet: () => '- ', number: (index) => `${index + 1}. `, task: () => '- [ ] ',
  }
  return prefixLines(value, start, end, prefixes[format])
}
