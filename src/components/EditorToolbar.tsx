import { Bold, Braces, Code2, Heading1, Heading2, Heading3, Italic, Link, List, ListChecks, ListOrdered, Minus, Quote, Strikethrough } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MarkdownFormat } from '../lib/editor-format'

const actions: Array<{ format: MarkdownFormat; label: string; icon: ReactNode }> = [
  { format: 'h1', label: 'Heading 1', icon: <Heading1 /> }, { format: 'h2', label: 'Heading 2', icon: <Heading2 /> }, { format: 'h3', label: 'Heading 3', icon: <Heading3 /> },
  { format: 'bold', label: 'In đậm', icon: <Bold /> }, { format: 'italic', label: 'In nghiêng', icon: <Italic /> }, { format: 'strike', label: 'Gạch ngang', icon: <Strikethrough /> },
  { format: 'code', label: 'Code inline', icon: <Code2 /> }, { format: 'codeblock', label: 'Khối code', icon: <Braces /> }, { format: 'link', label: 'Liên kết', icon: <Link /> },
  { format: 'quote', label: 'Trích dẫn', icon: <Quote /> }, { format: 'bullet', label: 'Danh sách', icon: <List /> }, { format: 'number', label: 'Danh sách đánh số', icon: <ListOrdered /> },
  { format: 'task', label: 'Checklist', icon: <ListChecks /> }, { format: 'rule', label: 'Đường phân cách', icon: <Minus /> },
]

export function EditorToolbar({ onFormat }: { onFormat: (format: MarkdownFormat) => void }) {
  return <div className="editor-toolbar" role="toolbar" aria-label="Công cụ soạn thảo Markdown">{actions.map((action) => <button key={action.format} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onFormat(action.format)} title={action.label} aria-label={action.label}>{action.icon}</button>)}</div>
}
