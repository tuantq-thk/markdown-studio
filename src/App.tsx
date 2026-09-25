import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArchiveRestore, ArrowDownToLine, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Command, DatabaseBackup, FilePlus2, Files, FolderPen, FolderPlus, FolderX, Image, ImageOff, Maximize2, Menu, Minimize2, Moon, PanelLeftClose, PanelRightClose, Pencil, Plus, Search, Sun, Trash2, Upload, X } from 'lucide-react'
import type { DocumentRecord, Heading } from './types'
import { deleteDocument, getActiveId, getDocuments, getFolders, replaceWorkspace, saveActiveId, saveDocument, saveDocuments, saveFolders } from './lib/storage'
import { filesToDocuments } from './lib/files'
import { createWorkspaceBackup, downloadJson, parseWorkspaceBackup } from './lib/workspace'
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
const storedSet = (key: string) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return new Set<string>(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  } catch { return new Set<string>() }
}
const storedTheme = (): 'light' | 'dark' => {
  const value = localStorage.getItem('theme')
  return value === 'light' || value === 'dark' ? value : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}
const storedBoolean = (key: string, fallback: boolean) => localStorage.getItem(key) === null ? fallback : localStorage.getItem(key) === 'true'
const storedNumber = (key: string, fallback: number, min: number, max: number) => {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
const basename = (path: string) => path.split('/').pop() ?? path
const uniqueDocumentName = (documents: DocumentRecord[], folder: string, requested: string, ignoredId?: string) => {
  const extension = requested.match(/\.(md|markdown|mdown)$/i)?.[0] ?? '.md'
  const stem = requested.slice(0, -extension.length) || 'untitled'
  let name = requested
  let index = 2
  const exists = (candidate: string) => documents.some((document) => document.id !== ignoredId && document.path.toLowerCase() === [folder, candidate].filter(Boolean).join('/').toLowerCase())
  while (exists(name)) name = `${stem}-${index++}${extension}`
  return name
}

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [activeId, setActiveId] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => storedSet('collapsedFolders'))
  const [html, setHtml] = useState('')
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeHeading, setActiveHeading] = useState('')
  const [mode, setMode] = useState<'editor' | 'preview'>('preview')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => storedTheme())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tocOpen, setTocOpen] = useState(true)
  const [mobileLibrary, setMobileLibrary] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const [readingMode, setReadingMode] = useState(false)
  const [allowRemoteImages, setAllowRemoteImages] = useState(() => storedBoolean('allowRemoteImages', false))
  const [storageError, setStorageError] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(() => storedNumber('sidebarWidth', 280, 220, 420))
  const [tocWidth, setTocWidth] = useState(() => storedNumber('tocWidth', 230, 190, 360))
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const restoreInput = useRef<HTMLInputElement>(null)
  const saveTimers = useRef(new Map<string, number>())
  const noticeTimer = useRef<number | undefined>(undefined)
  const previewRef = useRef<HTMLElement>(null)
  const tocRef = useRef<HTMLElement>(null)
  const active = documents.find((document) => document.id === activeId)

  useEffect(() => { void (async () => {
    try {
      const [stored, storedFolders] = await Promise.all([getDocuments(), getFolders()])
      const docs = stored.length ? stored.sort((a, b) => b.updatedAt - a.updatedAt) : [createDocument()]
      if (!stored.length) await saveDocument(docs[0])
      const inferred = docs.map((doc) => folderOf(doc.path)).filter(Boolean)
      const allFolders = [...new Set([...storedFolders, ...inferred])].sort()
      if (allFolders.length !== storedFolders.length) await saveFolders(allFolders)
      const previous = await getActiveId()
      setDocuments(docs); setFolders(allFolders); setActiveId(docs.some((item) => item.id === previous) ? previous! : docs[0].id)
    } catch {
      const fallback = createDocument()
      setDocuments([fallback]); setActiveId(fallback.id); setStorageError('Không thể truy cập IndexedDB. Thay đổi trong phiên này có thể không được lưu.')
    }
  })() }, [])

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('allowRemoteImages', String(allowRemoteImages)) }, [allowRemoteImages])
  useEffect(() => { localStorage.setItem('sidebarWidth', String(sidebarWidth)) }, [sidebarWidth])
  useEffect(() => { localStorage.setItem('tocWidth', String(tocWidth)) }, [tocWidth])
  useEffect(() => { localStorage.setItem('collapsedFolders', JSON.stringify([...collapsedFolders])) }, [collapsedFolders])
  useEffect(() => () => {
    saveTimers.current.forEach((timer) => window.clearTimeout(timer))
    window.clearTimeout(noticeTimer.current)
  }, [])
  useEffect(() => {
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
    canonical.href = `${location.origin}${location.pathname}`
  }, [])
  useEffect(() => { document.title = active ? `${active.name.replace(/\.(md|markdown|mdown)$/i, '')} | Markdown Studio – Trình đọc Markdown` : 'Markdown Studio – Trình đọc và soạn thảo Markdown trực tuyến' }, [active])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const timer = window.setTimeout(() => { void import('./lib/markdown').then(({ renderMarkdown }) => renderMarkdown(active.content, { allowRemoteImages })).then((result) => { if (!cancelled) { setHtml(result.html); setHeadings(result.headings); setActiveHeading(result.headings[0]?.id ?? '') } }).catch(() => { if (!cancelled) setHtml('<p class="render-error">Không thể render tài liệu.</p>') }) }, 120)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [active, allowRemoteImages, theme])

  useEffect(() => {
    const root = previewRef.current
    if (!root || !html) return
    if (root.querySelector('.mermaid[data-diagram]')) void import('./lib/diagrams').then(({ renderDiagrams }) => renderDiagrams(root, theme))
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

  const notify = useCallback((message: string, duration = 1800) => {
    window.clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = window.setTimeout(() => setNotice(''), duration)
  }, [])
  const selectDocument = useCallback((id: string) => { previewRef.current?.scrollTo?.({ top: 0, behavior: 'auto' }); setActiveId(id); setMobileLibrary(false); setReadingProgress(0); void saveActiveId(id) }, [])

  const updateContent = (content: string) => {
    if (!active) return
    const next = { ...active, content, updatedAt: Date.now() }
    setDocuments((items) => items.map((item) => item.id === active.id ? next : item))
    window.clearTimeout(saveTimers.current.get(active.id))
    const timer = window.setTimeout(() => {
      saveTimers.current.delete(active.id)
      void saveDocument(next).then(() => notify('Đã lưu trên thiết bị')).catch(() => notify('Không thể lưu. Hãy tải file để tránh mất dữ liệu.', 3500))
    }, 450)
    saveTimers.current.set(active.id, timer)
  }

  const importFiles = useCallback(async (list: FileList | File[]) => {
    const result = await filesToDocuments(Array.from(list), selectedFolder)
    const imported: DocumentRecord[] = []
    result.documents.forEach((document) => {
      const folder = folderOf(document.path)
      const name = uniqueDocumentName([...documents, ...imported], folder, document.name)
      imported.push({ ...document, name, path: [folder, name].filter(Boolean).join('/') })
    })
    const { rejected } = result
    if (imported.length) {
      try { await saveDocuments(imported) } catch { setStorageError('Không thể lưu file import. Hãy backup workspace để tránh mất dữ liệu.') }
      const inferred = imported.map((doc) => folderOf(doc.path)).filter(Boolean)
      const nextFolders = [...new Set([...folders, ...inferred])]
      setFolders(nextFolders); await saveFolders(nextFolders)
      setDocuments((current) => [...imported, ...current]); selectDocument(imported[0].id); notify(`Đã nhập ${imported.length} tài liệu`)
    }
    if (rejected.length) notify(`Bỏ qua ${rejected.length} file không hợp lệ hoặc quá 2 MB`, 2800)
  }, [documents, folders, notify, selectedFolder, selectDocument])

  const addFolder = async () => {
    const name = prompt('Tên thư mục mới:')?.trim().replace(/^\/+|\/+$/g, '')
    if (!name) return
    const path = [selectedFolder, name].filter(Boolean).join('/')
    if (folders.includes(path)) return notify('Thư mục đã tồn tại')
    const next = [...folders, path]; setFolders(next); setSelectedFolder(path); await saveFolders(next); notify('Đã tạo thư mục')
  }

  const addDocument = async () => {
    const name = uniqueDocumentName(documents, selectedFolder, 'untitled.md')
    const document = createDocument(selectedFolder, name, '# Tài liệu mới\n')
    try { await saveDocument(document) } catch { setStorageError('Không thể lưu tài liệu mới vào IndexedDB.') }
    setDocuments((items) => [document, ...items]); selectDocument(document.id); setMode('editor')
  }

  const moveActive = async (folder: string) => {
    if (!active) return
    const target = [folder, active.name].filter(Boolean).join('/')
    if (documents.some((document) => document.id !== active.id && document.path.toLowerCase() === target.toLowerCase())) return notify('Đã có file cùng tên trong thư mục đích', 2800)
    const next = { ...active, path: target, updatedAt: Date.now() }
    setDocuments((items) => items.map((item) => item.id === active.id ? next : item)); try { await saveDocument(next) } catch { setStorageError('Không thể lưu vị trí tài liệu mới.') }; notify(folder ? `Đã chuyển vào ${folder}` : 'Đã chuyển ra thư mục gốc')
  }

  const renameActive = async () => {
    if (!active) return
    const requested = prompt('Tên file mới:', active.name)?.trim()
    if (!requested) return
    const name = /\.(md|markdown|mdown)$/i.test(requested) ? requested : `${requested}.md`
    if (name.includes('/') || name.includes('\\')) return notify('Tên file không được chứa dấu / hoặc \\', 2800)
    const folder = folderOf(active.path)
    const target = [folder, name].filter(Boolean).join('/')
    if (documents.some((document) => document.id !== active.id && document.path.toLowerCase() === target.toLowerCase())) return notify('Đường dẫn file đã tồn tại', 2800)
    const next = { ...active, name, path: target, updatedAt: Date.now() }
    setDocuments((items) => items.map((item) => item.id === active.id ? next : item))
    try { await saveDocument(next); notify('Đã đổi tên file') } catch { setStorageError('Không thể lưu tên file mới.') }
  }

  const renameSelectedFolder = async () => {
    if (!selectedFolder) return
    const parent = selectedFolder.split('/').slice(0, -1).join('/')
    const requested = prompt('Tên thư mục mới:', basename(selectedFolder))?.trim().replace(/^\/+|\/+$/g, '')
    if (!requested || requested.includes('/')) return
    const target = [parent, requested].filter(Boolean).join('/')
    if (folders.some((folder) => folder !== selectedFolder && (folder === target || folder.startsWith(`${target}/`)))) return notify('Thư mục đích đã tồn tại', 2800)
    const rewrite = (path: string) => path === selectedFolder ? target : path.startsWith(`${selectedFolder}/`) ? `${target}${path.slice(selectedFolder.length)}` : path
    const nextFolders = folders.map(rewrite)
    const nextDocuments = documents.map((document) => document.path.startsWith(`${selectedFolder}/`) ? { ...document, path: rewrite(document.path), updatedAt: Date.now() } : document)
    if (new Set(nextDocuments.map((document) => document.path.toLowerCase())).size !== nextDocuments.length) return notify('Đổi tên sẽ tạo đường dẫn trùng', 3000)
    try { await saveDocuments(nextDocuments.filter((document) => document.path.startsWith(`${target}/`))); await saveFolders(nextFolders) } catch { setStorageError('Không thể lưu thay đổi thư mục.') }
    setFolders(nextFolders); setDocuments(nextDocuments); setSelectedFolder(target); notify('Đã đổi tên thư mục')
  }

  const deleteSelectedFolder = async () => {
    if (!selectedFolder) return
    const affected = documents.filter((document) => document.path.startsWith(`${selectedFolder}/`))
    if (!confirm(`Xóa thư mục “${selectedFolder}” và ${affected.length} tài liệu bên trong?`)) return
    affected.forEach((document) => { window.clearTimeout(saveTimers.current.get(document.id)); saveTimers.current.delete(document.id) })
    try { await Promise.all(affected.map((document) => deleteDocument(document.id))); const nextFolders = folders.filter((folder) => folder !== selectedFolder && !folder.startsWith(`${selectedFolder}/`)); await saveFolders(nextFolders); setFolders(nextFolders) } catch { setStorageError('Không thể xóa đầy đủ thư mục khỏi IndexedDB.') }
    const remaining = documents.filter((document) => !affected.some((item) => item.id === document.id))
    setDocuments(remaining); setSelectedFolder('')
    if (!remaining.length) { const fresh = createDocument('', 'untitled.md', '# Tài liệu mới\n'); setDocuments([fresh]); setActiveId(fresh.id); try { await saveDocument(fresh) } catch { setStorageError('Không thể tạo tài liệu thay thế.') } }
    else if (affected.some((document) => document.id === activeId)) selectDocument(remaining[0].id)
    notify('Đã xóa thư mục')
  }

  const removeActive = async () => {
    if (!active || !confirm(`Xóa “${active.name}” khỏi thiết bị?`)) return
    window.clearTimeout(saveTimers.current.get(active.id)); saveTimers.current.delete(active.id)
    await deleteDocument(active.id)
    const remaining = documents.filter((item) => item.id !== active.id)
    if (remaining.length) { setDocuments(remaining); selectDocument(remaining[0].id) }
    else { const fresh = createDocument('', 'untitled.md', '# Tài liệu mới\n'); await saveDocument(fresh); setDocuments([fresh]); selectDocument(fresh.id) }
  }

  const downloadActive = useCallback(() => {
    if (!active) return
    const url = URL.createObjectURL(new Blob([active.content], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = active.name; link.click(); URL.revokeObjectURL(url); notify('Đã tải file Markdown')
  }, [active, notify])

  const backupWorkspace = useCallback(() => {
    const backup = createWorkspaceBackup({ documents, folders, activeId, settings: { theme, allowRemoteImages, sidebarWidth, tocWidth } })
    downloadJson(backup, `markdown-studio-backup-${new Date().toISOString().slice(0, 10)}.json`)
    notify('Đã tải bản backup workspace')
  }, [activeId, allowRemoteImages, documents, folders, notify, sidebarWidth, theme, tocWidth])

  const restoreWorkspaceFile = async (file: File) => {
    try {
      const backup = parseWorkspaceBackup(await file.text())
      if (!confirm(`Khôi phục ${backup.documents.length} tài liệu? Workspace hiện tại sẽ được thay thế.`)) return
      saveTimers.current.forEach((timer) => window.clearTimeout(timer)); saveTimers.current.clear()
      await replaceWorkspace(backup.documents, backup.folders, backup.activeId)
      setDocuments(backup.documents); setFolders(backup.folders); setActiveId(backup.activeId ?? backup.documents[0].id); setSelectedFolder('')
      setTheme(backup.settings.theme); setAllowRemoteImages(backup.settings.allowRemoteImages); setSidebarWidth(backup.settings.sidebarWidth); setTocWidth(backup.settings.tocWidth)
      localStorage.setItem('sidebarWidth', String(backup.settings.sidebarWidth)); localStorage.setItem('tocWidth', String(backup.settings.tocWidth))
      setStorageError(''); notify('Khôi phục workspace thành công')
    } catch { notify('Backup không hợp lệ hoặc không thể khôi phục', 3500) }
    finally { if (restoreInput.current) restoreInput.current.value = '' }
  }

  const startPanelResize = (kind: 'sidebar' | 'toc', event: React.PointerEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const initial = kind === 'sidebar' ? sidebarWidth : tocWidth
    const move = (pointer: PointerEvent) => {
      const delta = kind === 'sidebar' ? pointer.clientX - startX : startX - pointer.clientX
      const value = Math.min(kind === 'sidebar' ? 420 : 360, Math.max(kind === 'sidebar' ? 220 : 190, initial + delta))
      if (kind === 'sidebar') setSidebarWidth(value); else setTocWidth(value)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop)
      const root = document.querySelector<HTMLElement>('.app')
      const value = Number.parseFloat(getComputedStyle(root ?? document.documentElement).getPropertyValue(kind === 'sidebar' ? '--sidebar-width' : '--toc-width'))
      localStorage.setItem(kind === 'sidebar' ? 'sidebarWidth' : 'tocWidth', String(Number.isFinite(value) ? value : initial))
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true })
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && readingMode) { setReadingMode(false); return }
      if (event.key === 'Escape' && commandOpen) { setCommandOpen(false); return }
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen((value) => !value); setCommandQuery(''); return }
      if (event.key.toLowerCase() === 's') { event.preventDefault(); downloadActive() }
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); fileInput.current?.click() }
      if (event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); setMode((value) => value === 'preview' ? 'editor' : 'preview') }
      if (event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); setMode('preview'); setReadingMode((value) => !value) }
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [commandOpen, downloadActive, readingMode])

  const onPreviewClick = async (event: React.MouseEvent<HTMLElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-code]')
    if (!button) return
    const code = button.closest('.code-block')?.querySelector('code')?.textContent ?? ''
    try {
      await navigator.clipboard.writeText(code); button.textContent = 'Đã chép'; notify('Đã sao chép code'); window.setTimeout(() => { button.textContent = 'Sao chép' }, 1500)
    } catch { notify('Trình duyệt không cho phép sao chép tự động', 2800) }
  }

  const filtered = useMemo(() => documents.filter((document) => document.name.toLowerCase().includes(query.toLowerCase()) || document.path.toLowerCase().includes(query.toLowerCase())), [documents, query])
  const commandDocuments = useMemo(() => {
    const needle = commandQuery.trim().toLowerCase()
    return (needle ? documents.filter((document) => document.path.toLowerCase().includes(needle)) : documents).slice(0, 6)
  }, [commandQuery, documents])
  const runCommand = (action: () => void) => { action(); setCommandOpen(false); setCommandQuery('') }
  const updateReadingState = () => {
    const root = previewRef.current
    if (!root) return
    const max = root.scrollHeight - root.clientHeight
    setReadingProgress(max > 0 ? Math.min(100, root.scrollTop / max * 100) : 0)
    const nodes = [...root.querySelectorAll<HTMLElement>('h1,h2,h3')]
    const current = nodes.reduce<HTMLElement | undefined>((found, node) => node.offsetTop <= root.scrollTop + 48 ? node : found, nodes[0])
    if (current?.id) setActiveHeading(current.id)
  }

  return <div className={`app ${readingMode ? 'reading-mode' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px`, '--toc-width': `${tocWidth}px` } as React.CSSProperties} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false) }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void importFiles(event.dataTransfer.files) }}>
    <div className="reading-progress" style={{ width: `${readingProgress}%` }} />
    <header className="topbar">
      <div className="brand"><button className="icon-button mobile-only" onClick={() => setMobileLibrary(true)} aria-label="Mở thư viện"><Menu /></button><div className="brand-mark">M↓</div><span>Markdown Studio</span></div>
      <div className="document-title"><span className="status-dot" />{active?.name ?? 'Đang tải…'}</div>
      <div className="top-actions">{notice && <div className="notice"><Check /> {notice}</div>}<button className="icon-button" onClick={() => { setCommandOpen(true); setCommandQuery('') }} aria-label="Mở bảng lệnh" title="Bảng lệnh (Ctrl/⌘ K)"><Command /></button><div className="segmented" aria-label="Chế độ hiển thị"><button className={mode === 'editor' ? 'active' : ''} onClick={() => setMode('editor')}>Editor</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>Preview</button></div><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Đổi giao diện">{theme === 'dark' ? <Sun /> : <Moon />}</button></div>
    </header>

    {storageError && <div className="recovery-banner" role="alert"><div><strong>Không thể lưu ổn định</strong><span>{storageError}</span></div><button onClick={backupWorkspace}><DatabaseBackup /> Backup ngay</button><button className="banner-close" onClick={() => setStorageError('')} aria-label="Đóng cảnh báo"><X /></button></div>}

    <div className={`workspace ${sidebarOpen ? '' : 'sidebar-collapsed'} ${tocOpen ? '' : 'toc-collapsed'}`}>
      <aside className={`sidebar ${mobileLibrary ? 'mobile-open' : ''}`}>
        <div className="sidebar-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Thư viện</h2></div><button className="icon-button mobile-only" onClick={() => setMobileLibrary(false)} aria-label="Đóng"><X /></button></div>
        <div className="library-actions"><button className="primary-button" onClick={() => fileInput.current?.click()}><Upload /> Nhập file</button><button className="icon-button bordered" onClick={addFolder} aria-label="Tạo thư mục" title="Tạo thư mục"><FolderPlus /></button><button className="icon-button bordered" onClick={addDocument} aria-label="Tạo tài liệu" title="Tạo tài liệu"><Plus /></button></div>
        <div className="workspace-actions"><button onClick={backupWorkspace} title="Backup toàn bộ workspace"><DatabaseBackup /> Backup</button><button onClick={() => restoreInput.current?.click()} title="Khôi phục workspace"><ArchiveRestore /> Restore</button></div>
        <input ref={fileInput} type="file" accept=".md,.markdown,.mdown,text/markdown" multiple hidden onChange={(event) => event.target.files && void importFiles(event.target.files)} />
        <input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={(event) => event.target.files?.[0] && void restoreWorkspaceFile(event.target.files[0])} />
        <label className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tài liệu…" /></label>
        <div className="file-count"><Files /> {filtered.length} tài liệu <span>{selectedFolder ? `• ${selectedFolder}` : '• thư mục gốc'}</span></div>
        {selectedFolder && <div className="folder-actions"><button onClick={() => void renameSelectedFolder()}><FolderPen /> Đổi tên</button><button className="danger" onClick={() => void deleteSelectedFolder()}><FolderX /> Xóa</button></div>}
        <FolderTree documents={filtered} folders={folders} activeId={activeId} selectedFolder={selectedFolder} collapsed={collapsedFolders} onSelectDocument={selectDocument} onSelectFolder={setSelectedFolder} onToggleFolder={(path) => setCollapsedFolders((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next })} />
        <div className="privacy"><span className="privacy-icon">⌁</span><div><strong>Lưu cục bộ</strong><p>Tài liệu không rời khỏi trình duyệt.</p></div></div>
        <div className="panel-resizer sidebar-resizer" onPointerDown={(event) => startPanelResize('sidebar', event)} role="separator" aria-label="Thay đổi độ rộng thư viện" />
      </aside>

      <main className="main-panel">
        <div className="document-toolbar"><button className="icon-button desktop-only" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Ẩn hiện thư viện">{sidebarOpen ? <PanelLeftClose /> : <ChevronRight />}</button><div className="path"><BookOpen /> {active?.path ?? ''}</div>
          <select className="folder-select" aria-label="Chuyển tài liệu vào thư mục" value={active ? folderOf(active.path) : ''} onChange={(event) => void moveActive(event.target.value)}><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select>
          <button className="icon-button" onClick={() => setAllowRemoteImages((value) => !value)} aria-label={allowRemoteImages ? 'Chặn ảnh từ xa' : 'Cho phép ảnh từ xa'} title={allowRemoteImages ? 'Ảnh từ xa đang được phép' : 'Ảnh từ xa đang bị chặn'}>{allowRemoteImages ? <Image /> : <ImageOff />}</button><button className="icon-button" onClick={() => void renameActive()} aria-label="Đổi tên tài liệu" title="Đổi tên"><Pencil /></button><button className="icon-button" onClick={downloadActive} aria-label="Tải file về máy" title="Tải file về máy (Ctrl/⌘ S)"><ArrowDownToLine /></button><button className="icon-button" onClick={() => { setMode('preview'); setReadingMode(true) }} aria-label="Chế độ đọc toàn trang" title="Đọc toàn trang (Ctrl/⌘ ⇧ F)"><Maximize2 /></button><button className="icon-button danger" onClick={() => void removeActive()} aria-label="Xóa tài liệu"><Trash2 /></button><button className="icon-button desktop-only" onClick={() => setTocOpen(!tocOpen)} aria-label="Ẩn hiện mục lục">{tocOpen ? <PanelRightClose /> : <ChevronLeft />}</button>
        </div>
        {mode === 'editor' ? <textarea className="editor" aria-label="Nội dung Markdown" spellCheck={false} value={active?.content ?? ''} onChange={(event) => updateContent(event.target.value)} /> : <article ref={previewRef} className="preview markdown-body" onScroll={updateReadingState} onClick={(event) => void onPreviewClick(event)} dangerouslySetInnerHTML={{ __html: html }} />}
        <div className="shortcut-hints"><span><kbd>⌘/Ctrl S</kbd> tải file</span><span><kbd>⌘/Ctrl O</kbd> mở file</span><span><kbd>⌘/Ctrl ⇧ P</kbd> đổi chế độ</span><span><kbd>⌘/Ctrl ⇧ F</kbd> đọc toàn trang</span></div>
        {mode === 'preview' && readingProgress > 12 && <button className="back-to-top" onClick={() => previewRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Lên đầu trang" title="Lên đầu trang"><ArrowUp /></button>}
        {readingMode && <button className="exit-reading" onClick={() => setReadingMode(false)} aria-label="Thoát chế độ đọc toàn trang" title="Thoát (Esc)"><Minimize2 /><span>Thoát chế độ đọc</span></button>}
      </main>

      <aside ref={tocRef} className="toc"><div className="panel-resizer toc-resizer" onPointerDown={(event) => startPanelResize('toc', event)} role="separator" aria-label="Thay đổi độ rộng mục lục" /><span className="eyebrow">TRONG TRANG NÀY</span>{headings.length ? <nav>{headings.map((heading) => <a key={heading.id} data-toc-id={heading.id} className={`${heading.id === activeHeading ? 'active ' : ''}toc-level-${heading.level}`} href={`#${heading.id}`} onClick={(event) => { event.preventDefault(); const root = previewRef.current; const target = root?.querySelector<HTMLElement>(`#${CSS.escape(heading.id)}`); if (root && target) root.scrollTo({ top: Math.max(0, target.offsetTop - 20), behavior: 'smooth' }) }}>{heading.text}</a>)}</nav> : <p className="toc-empty">Thêm tiêu đề để tạo mục lục.</p>}<div className="toc-progress"><span>{Math.round(readingProgress)}%</span><small>Đã đọc</small></div></aside>
    </div>
    {mobileLibrary && <button className="backdrop" onClick={() => setMobileLibrary(false)} aria-label="Đóng thư viện" />}
    {isDragging && <div className="drop-overlay"><div><FilePlus2 /><strong>Thả file Markdown vào đây</strong><span>Nhập vào {selectedFolder || 'thư mục gốc'} • tối đa 2 MB/file</span></div></div>}
    {commandOpen && <div className="command-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setCommandOpen(false) }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Bảng lệnh"><label><Search /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Tìm file hoặc lệnh…" /></label><div className="command-results"><span className="command-group">LỆNH NHANH</span><button onClick={() => runCommand(() => setTheme((value) => value === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? <Sun /> : <Moon />} Đổi giao diện</button><button onClick={() => runCommand(() => { setMode('preview'); setReadingMode(true) })}><Maximize2 /> Đọc toàn trang</button><button onClick={() => runCommand(backupWorkspace)}><DatabaseBackup /> Backup workspace</button><button onClick={() => runCommand(() => setAllowRemoteImages((value) => !value))}>{allowRemoteImages ? <ImageOff /> : <Image />} {allowRemoteImages ? 'Chặn ảnh từ xa' : 'Cho phép ảnh từ xa'}</button><span className="command-group">TÀI LIỆU</span>{commandDocuments.map((document) => <button key={document.id} onClick={() => runCommand(() => selectDocument(document.id))}><BookOpen /><span><strong>{document.name}</strong><small>{document.path}</small></span></button>)}</div><footer><kbd>Ctrl/⌘ K</kbd> mở bảng lệnh <kbd>Esc</kbd> đóng</footer></section></div>}
  </div>
}
