import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, FilePlus2, Files, FolderPlus, Menu, Moon, PanelLeftClose, PanelRightClose, Plus, Search, Sun, Trash2, Upload, X } from 'lucide-react'
import type { DocumentRecord, Heading } from './types'
import { deleteDocument, getActiveId, getDocuments, getFolders, saveActiveId, saveDocument, saveDocuments, saveFolders } from './lib/storage'
import { filesToDocuments } from './lib/files'
import { renderMarkdown } from './lib/markdown'
import { renderDiagrams } from './lib/diagrams'
import { FolderTree } from './components/FolderTree'

const WELCOME = `# Chào mừng đến Markdown Studio

Mọi nội dung được lưu **trên trình duyệt của bạn**. Hãy dán Markdown, chỉnh sửa trực tiếp hoặc kéo nhiều file \`.md\` vào cửa sổ.

## Markdown đầy đủ

- [x] Task list
- Bảng, ~~gạch ngang~~, link tự động và footnote[^1]
- Code block đa ngôn ngữ, tải grammar khi cần

| Tính năng | Trạng thái |
| --- | --- |
| Lưu cục bộ | Sẵn sàng |
| Tải file về máy | Sẵn sàng |

## PHP / Laravel

\`\`\`php
final class ArticleRepository
{
    public function published(): Collection
    {
        return Article::query()
            ->with(['author', 'category'])
            ->whereNotNull('published_at')
            ->latest('published_at')
            ->get();
    }
}
\`\`\`

## JavaScript

\`\`\`javascript
const articles = await fetch('/api/articles').then(response => response.json())
\`\`\`

## Mermaid / UML

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant M as Markdown Studio
    U->>M: Import tài liệu
    M-->>U: Preview + TOC + diagrams
\`\`\`

### Riêng tư theo mặc định

Ứng dụng không gửi tài liệu lên máy chủ. Bạn có thể dùng nó như một bàn đọc Markdown cá nhân.

[^1]: Footnote cũng được hỗ trợ.
`

const folderOf = (path: string) => path.split('/').slice(0, -1).join('/')
const createDocument = (folder = '', name = 'welcome.md', content = WELCOME): DocumentRecord => ({ id: crypto.randomUUID(), name, path: [folder, name].filter(Boolean).join('/'), content, updatedAt: Date.now() })

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [activeId, setActiveId] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('collapsedFolders') || '[]')))
  const [html, setHtml] = useState('')
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeHeading, setActiveHeading] = useState('')
  const [mode, setMode] = useState<'editor' | 'preview'>('preview')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tocOpen, setTocOpen] = useState(true)
  const [mobileLibrary, setMobileLibrary] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const previewRef = useRef<HTMLElement>(null)
  const tocRef = useRef<HTMLElement>(null)
  const active = documents.find((document) => document.id === activeId)

  useEffect(() => { void (async () => {
    const [stored, storedFolders] = await Promise.all([getDocuments(), getFolders()])
    const docs = stored.length ? stored.sort((a, b) => b.updatedAt - a.updatedAt) : [createDocument()]
    if (!stored.length) await saveDocument(docs[0])
    const inferred = docs.map((doc) => folderOf(doc.path)).filter(Boolean)
    const allFolders = [...new Set([...storedFolders, ...inferred])].sort()
    if (allFolders.length !== storedFolders.length) await saveFolders(allFolders)
    const previous = await getActiveId()
    setDocuments(docs); setFolders(allFolders); setActiveId(docs.some((item) => item.id === previous) ? previous! : docs[0].id)
  })() }, [])

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('collapsedFolders', JSON.stringify([...collapsedFolders])) }, [collapsedFolders])
  useEffect(() => () => window.clearTimeout(saveTimer.current), [])
  useEffect(() => {
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
    canonical.href = `${location.origin}${location.pathname}`
  }, [])
  useEffect(() => { document.title = active ? `${active.name.replace(/\.(md|markdown|mdown)$/i, '')} | Markdown Studio – Trình đọc Markdown` : 'Markdown Studio – Trình đọc và soạn thảo Markdown trực tuyến' }, [active])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const timer = window.setTimeout(() => { void renderMarkdown(active.content).then((result) => { if (!cancelled) { setHtml(result.html); setHeadings(result.headings); setActiveHeading(result.headings[0]?.id ?? '') } }) }, 120)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [active, theme])

  useEffect(() => {
    const root = previewRef.current
    if (!root || !html) return
    void renderDiagrams(root, theme)
  }, [html, theme])

  useEffect(() => {
    const root = previewRef.current
    if (!root || !html || typeof IntersectionObserver === 'undefined') return
    const nodes = [...root.querySelectorAll<HTMLElement>('h1,h2,h3')]
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveHeading((visible[0].target as HTMLElement).id)
    }, { root, rootMargin: '-10% 0px -75% 0px', threshold: [0, 1] })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [html])

  useEffect(() => {
    const link = tocRef.current?.querySelector<HTMLElement>(`[data-toc-id="${CSS.escape(activeHeading)}"]`)
    link?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [activeHeading])

  useEffect(() => {
    setReadingProgress(0)
    setActiveHeading('')
    previewRef.current?.scrollTo?.({ top: 0, behavior: 'auto' })
  }, [activeId])

  const notify = (message: string, duration = 1800) => { setNotice(message); window.setTimeout(() => setNotice(''), duration) }
  const selectDocument = useCallback((id: string) => { previewRef.current?.scrollTo?.({ top: 0, behavior: 'auto' }); setActiveId(id); setMobileLibrary(false); setReadingProgress(0); void saveActiveId(id) }, [])

  const updateContent = (content: string) => {
    if (!active) return
    const next = { ...active, content, updatedAt: Date.now() }
    setDocuments((items) => items.map((item) => item.id === active.id ? next : item))
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void saveDocument(next); notify('Đã lưu trên thiết bị') }, 450)
  }

  const importFiles = useCallback(async (list: FileList | File[]) => {
    const { documents: imported, rejected } = await filesToDocuments(Array.from(list), selectedFolder)
    if (imported.length) {
      await saveDocuments(imported)
      const inferred = imported.map((doc) => folderOf(doc.path)).filter(Boolean)
      const nextFolders = [...new Set([...folders, ...inferred])]
      setFolders(nextFolders); await saveFolders(nextFolders)
      setDocuments((current) => [...imported, ...current]); selectDocument(imported[0].id); notify(`Đã nhập ${imported.length} tài liệu`)
    }
    if (rejected.length) notify(`Bỏ qua ${rejected.length} file không hợp lệ hoặc quá 2 MB`, 2800)
  }, [folders, selectedFolder, selectDocument])

  const addFolder = async () => {
    const name = prompt('Tên thư mục mới:')?.trim().replace(/^\/+|\/+$/g, '')
    if (!name) return
    const path = [selectedFolder, name].filter(Boolean).join('/')
    if (folders.includes(path)) return notify('Thư mục đã tồn tại')
    const next = [...folders, path]; setFolders(next); setSelectedFolder(path); await saveFolders(next); notify('Đã tạo thư mục')
  }

  const addDocument = async () => {
    const number = documents.filter((item) => item.name.startsWith('untitled')).length + 1
    const document = createDocument(selectedFolder, `untitled-${number}.md`, '# Tài liệu mới\n')
    await saveDocument(document); setDocuments((items) => [document, ...items]); selectDocument(document.id); setMode('editor')
  }

  const moveActive = async (folder: string) => {
    if (!active) return
    const next = { ...active, path: [folder, active.name].filter(Boolean).join('/'), updatedAt: Date.now() }
    setDocuments((items) => items.map((item) => item.id === active.id ? next : item)); await saveDocument(next); notify(folder ? `Đã chuyển vào ${folder}` : 'Đã chuyển ra thư mục gốc')
  }

  const removeActive = async () => {
    if (!active || !confirm(`Xóa “${active.name}” khỏi thiết bị?`)) return
    await deleteDocument(active.id)
    const remaining = documents.filter((item) => item.id !== active.id)
    if (remaining.length) { setDocuments(remaining); selectDocument(remaining[0].id) }
    else { const fresh = createDocument('', 'untitled.md', '# Tài liệu mới\n'); await saveDocument(fresh); setDocuments([fresh]); selectDocument(fresh.id) }
  }

  const downloadActive = useCallback(() => {
    if (!active) return
    const url = URL.createObjectURL(new Blob([active.content], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = active.name; link.click(); URL.revokeObjectURL(url); notify('Đã tải file Markdown')
  }, [active])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 's') { event.preventDefault(); downloadActive() }
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); fileInput.current?.click() }
      if (event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); setMode((value) => value === 'preview' ? 'editor' : 'preview') }
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [downloadActive])

  const onPreviewClick = async (event: React.MouseEvent<HTMLElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-code]')
    if (!button) return
    const code = button.closest('.code-block')?.querySelector('code')?.textContent ?? ''
    await navigator.clipboard.writeText(code); button.textContent = 'Đã chép'; notify('Đã sao chép code'); window.setTimeout(() => { button.textContent = 'Sao chép' }, 1500)
  }

  const filtered = useMemo(() => documents.filter((document) => document.name.toLowerCase().includes(query.toLowerCase()) || document.path.toLowerCase().includes(query.toLowerCase())), [documents, query])
  const updateProgress = () => { const root = previewRef.current; if (!root) return; const max = root.scrollHeight - root.clientHeight; setReadingProgress(max > 0 ? Math.min(100, root.scrollTop / max * 100) : 0) }

  return <div className="app" onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false) }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void importFiles(event.dataTransfer.files) }}>
    <div className="reading-progress" style={{ width: `${readingProgress}%` }} />
    <header className="topbar">
      <div className="brand"><button className="icon-button mobile-only" onClick={() => setMobileLibrary(true)} aria-label="Mở thư viện"><Menu /></button><div className="brand-mark">M↓</div><span>Markdown Studio</span></div>
      <div className="document-title"><span className="status-dot" />{active?.name ?? 'Đang tải…'}</div>
      <div className="top-actions">{notice && <div className="notice"><Check /> {notice}</div>}<div className="segmented" aria-label="Chế độ hiển thị"><button className={mode === 'editor' ? 'active' : ''} onClick={() => setMode('editor')}>Editor</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>Preview</button></div><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Đổi giao diện">{theme === 'dark' ? <Sun /> : <Moon />}</button></div>
    </header>

    <div className={`workspace ${sidebarOpen ? '' : 'sidebar-collapsed'} ${tocOpen ? '' : 'toc-collapsed'}`}>
      <aside className={`sidebar ${mobileLibrary ? 'mobile-open' : ''}`}>
        <div className="sidebar-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Thư viện</h2></div><button className="icon-button mobile-only" onClick={() => setMobileLibrary(false)} aria-label="Đóng"><X /></button></div>
        <div className="library-actions"><button className="primary-button" onClick={() => fileInput.current?.click()}><Upload /> Nhập file</button><button className="icon-button bordered" onClick={addFolder} aria-label="Tạo thư mục" title="Tạo thư mục"><FolderPlus /></button><button className="icon-button bordered" onClick={addDocument} aria-label="Tạo tài liệu" title="Tạo tài liệu"><Plus /></button></div>
        <input ref={fileInput} type="file" accept=".md,.markdown,.mdown,text/markdown" multiple hidden onChange={(event) => event.target.files && void importFiles(event.target.files)} />
        <label className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tài liệu…" /></label>
        <div className="file-count"><Files /> {filtered.length} tài liệu <span>{selectedFolder ? `• ${selectedFolder}` : '• thư mục gốc'}</span></div>
        <FolderTree documents={filtered} folders={folders} activeId={activeId} selectedFolder={selectedFolder} collapsed={collapsedFolders} onSelectDocument={selectDocument} onSelectFolder={setSelectedFolder} onToggleFolder={(path) => setCollapsedFolders((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next })} />
        <div className="privacy"><span className="privacy-icon">⌁</span><div><strong>Lưu cục bộ</strong><p>Tài liệu không rời khỏi trình duyệt.</p></div></div>
      </aside>

      <main className="main-panel">
        <div className="document-toolbar"><button className="icon-button desktop-only" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Ẩn hiện thư viện">{sidebarOpen ? <PanelLeftClose /> : <ChevronRight />}</button><div className="path"><BookOpen /> {active?.path ?? ''}</div>
          <select className="folder-select" aria-label="Chuyển tài liệu vào thư mục" value={active ? folderOf(active.path) : ''} onChange={(event) => void moveActive(event.target.value)}><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select>
          <button className="icon-button" onClick={downloadActive} aria-label="Tải file về máy" title="Tải file về máy (Ctrl/⌘ S)"><ArrowDownToLine /></button><button className="icon-button danger" onClick={() => void removeActive()} aria-label="Xóa tài liệu"><Trash2 /></button><button className="icon-button desktop-only" onClick={() => setTocOpen(!tocOpen)} aria-label="Ẩn hiện mục lục">{tocOpen ? <PanelRightClose /> : <ChevronLeft />}</button>
        </div>
        {mode === 'editor' ? <textarea className="editor" aria-label="Nội dung Markdown" spellCheck={false} value={active?.content ?? ''} onChange={(event) => updateContent(event.target.value)} /> : <article ref={previewRef} className="preview markdown-body" onScroll={updateProgress} onClick={(event) => void onPreviewClick(event)} dangerouslySetInnerHTML={{ __html: html }} />}
        <div className="shortcut-hints"><span><kbd>⌘/Ctrl S</kbd> tải file</span><span><kbd>⌘/Ctrl O</kbd> mở file</span><span><kbd>⌘/Ctrl ⇧ P</kbd> đổi chế độ</span></div>
        {mode === 'preview' && readingProgress > 12 && <button className="back-to-top" onClick={() => previewRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Lên đầu trang" title="Lên đầu trang"><ArrowUp /></button>}
      </main>

      <aside ref={tocRef} className="toc"><span className="eyebrow">TRONG TRANG NÀY</span>{headings.length ? <nav>{headings.map((heading) => <a key={heading.id} data-toc-id={heading.id} className={`${heading.id === activeHeading ? 'active ' : ''}toc-level-${heading.level}`} href={`#${heading.id}`} onClick={(event) => { event.preventDefault(); previewRef.current?.querySelector(`#${CSS.escape(heading.id)}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{heading.text}</a>)}</nav> : <p className="toc-empty">Thêm tiêu đề để tạo mục lục.</p>}<div className="toc-progress"><span>{Math.round(readingProgress)}%</span><small>Đã đọc</small></div></aside>
    </div>
    {mobileLibrary && <button className="backdrop" onClick={() => setMobileLibrary(false)} aria-label="Đóng thư viện" />}
    {isDragging && <div className="drop-overlay"><div><FilePlus2 /><strong>Thả file Markdown vào đây</strong><span>Nhập vào {selectedFolder || 'thư mục gốc'} • tối đa 2 MB/file</span></div></div>}
  </div>
}
