import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArchiveRestore, ArrowDownToLine, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Command, DatabaseBackup, FilePlus2, Files, FolderInput, FolderPlus, HardDrive, History, Image, ImageOff, Maximize2, Menu, Minimize2, Moon, PanelLeftClose, PanelRightClose, Pencil, Plus, RotateCcw, Save, Search, Sun, Trash2, Upload, X } from 'lucide-react'
import type { DocumentRecord, Heading } from './types'
import { deleteDocument, getActiveId, getDocumentHistory, getDocumentOrder, getDocuments, getFolders, getTrash, moveDocumentToTrash, replaceWorkspace, restoreTrashedDocument, saveActiveId, saveDocument, saveDocumentOrder, saveDocuments, saveDocumentWithHistory, saveFolders, type HistoryRecord, type TrashRecord } from './lib/storage'
import { filesToDocuments } from './lib/files'
import { createWorkspaceBackup, createWorkspaceZip, downloadBlob, parseWorkspaceFile } from './lib/workspace'
import { FolderTree } from './components/FolderTree'
import { indexWorkspace, searchWorkspace, type SearchHit } from './lib/search-client'
import { EditorToolbar } from './components/EditorToolbar'
import { applyMarkdownFormat, type MarkdownFormat } from './lib/editor-format'

const WELCOME = `# Chào mừng đến Markdown Studio

Markdown Studio là workspace đọc và chỉnh sửa Markdown chạy hoàn toàn trên trình duyệt. Hãy bắt đầu bằng **Mở file**, kéo thả nhiều file hoặc chuyển sang **Editor** để viết ngay.

> [!NOTE]
> Tài liệu, thùng rác và lịch sử phiên bản được lưu trong IndexedDB của browser hiện tại. Hãy dùng **Backup ZIP** định kỳ cho nội dung quan trọng.

## Bắt đầu nhanh

1. Nhấn **Mở file** hoặc nút folder để nhập nguyên cây thư mục bằng File System Access API trên Chrome/Edge.
2. Chọn **Editor** để chỉnh sửa và **Preview** để đọc kết quả.
3. Nhấn biểu tượng **Save** để ghi trực tiếp vào file đã mở, hoặc biểu tượng download để tải một bản \`.md\`.
4. Tạo folder, đổi tên, di chuyển và tìm full-text trong toàn bộ nội dung từ sidebar.
5. Nhấn \`Ctrl/⌘ + K\` để mở command palette.

Khi ở **Editor**, dùng thanh công cụ để chèn heading, bold, italic, code, link, quote, danh sách và checklist. Bôi đen nội dung trước khi chọn định dạng để giữ đúng selection.

## Đọc tập trung

- Nút mở rộng hoặc \`Ctrl/⌘ + Shift + F\` bật chế độ đọc toàn trang.
- TOC có vùng cuộn riêng, tự active và tự cuộn theo heading đang đọc.
- Thanh tiến trình và nút trở về đầu trang giúp theo dõi tài liệu dài.
- Kéo mép sidebar/TOC để đổi độ rộng; app tự ghi nhớ kích thước.
- Kéo file lên file khác để đổi thứ tự, kéo file vào folder để di chuyển; kéo folder vào folder hoặc về root để đổi cấp.
- Menu ba chấm trên từng folder chứa thao tác đổi tên và chuyển vào thùng rác.

## Markdown, code và diagram

- CommonMark, table, task list, ~~strikethrough~~, autolink và footnote[^1].
- Shiki highlight nhiều ngôn ngữ trong Web Worker để giảm block giao diện.
- Mermaid/UML được parse trong Worker và hiển thị SVG trong iframe sandbox cách ly.
- Code block có nhãn ngôn ngữ và nút sao chép.

\`\`\`php
final class ArticleRepository
{
    public function published(): Collection
    {
        return Article::query()->with(['author'])->latest()->get();
    }
}
\`\`\`

\`\`\`mermaid
flowchart LR
    A[Open or drop Markdown] --> B[Edit and autosave]
    B --> C[Shiki + Mermaid workers]
    C --> D[Focused reading]
\`\`\`

## An toàn dữ liệu

| Tính năng | Cách sử dụng |
| --- | --- |
| Autosave | Tự lưu sau khi ngừng gõ |
| Lịch sử | Nhấn biểu tượng đồng hồ để xem tối đa 20 snapshot |
| Thùng rác | Xóa file/folder rồi hoàn tác hoặc khôi phục sau |
| Backup ZIP | Lưu workspace JSON, từng file Markdown và ảnh data-URL |
| Restore | Chọn backup ZIP/JSON và xác nhận thay thế workspace |
| Recovery | Khi IndexedDB lỗi, banner nhắc backup ngay |
| Storage | Dashboard báo dung lượng và cảnh báo khi dùng từ 80% quota |

> [!WARNING]
> Xóa vĩnh viễn trong thùng rác và restore workspace là thao tác không thể tự hoàn tác. Luôn tạo backup trước.

## Quyền riêng tư và offline

Ảnh HTTP/HTTPS bị chặn mặc định để tài liệu không âm thầm gửi request ra ngoài. Bật biểu tượng ảnh nếu bạn tin nguồn tài liệu. Sau lần tải đầu, PWA có thể mở offline; khi có phiên bản mới app sẽ hiện nút **Cập nhật ngay**.

## Phím tắt

| Phím | Tác dụng |
| --- | --- |
| \`Ctrl/⌘ + S\` | Tải file Markdown hiện tại |
| \`Ctrl/⌘ + O\` | Mở file |
| \`Ctrl/⌘ + Shift + P\` | Đổi Editor/Preview |
| \`Ctrl/⌘ + Shift + F\` | Đọc toàn trang |
| \`Ctrl/⌘ + K\` | Command palette; dùng ↑ ↓ Enter và Esc |

### Lưu ý tương thích

File System Access API cần Chrome/Edge trên HTTPS hoặc localhost. Safari/Firefox tự fallback sang tải file. Dữ liệu IndexedDB gắn với domain và browser profile.

[^1]: Footnote được hiển thị cuối tài liệu.
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
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [storageEstimate, setStorageEstimate] = useState({ usage: 0, quota: 0 })
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
  const [commandIndex, setCommandIndex] = useState(-1)
  const [trash, setTrash] = useState<TrashRecord[]>([])
  const [trashOpen, setTrashOpen] = useState(false)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [lastTrashed, setLastTrashed] = useState<string[]>([])
  const [pwaUpdate, setPwaUpdate] = useState<ServiceWorkerRegistration | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const restoreInput = useRef<HTMLInputElement>(null)
  const saveTimers = useRef(new Map<string, number>())
  const historyBases = useRef(new Map<string, DocumentRecord>())
  const fileHandles = useRef(new Map<string, FileSystemFileHandle>())
  const noticeTimer = useRef<number | undefined>(undefined)
  const previewRef = useRef<HTMLElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const tocRef = useRef<HTMLElement>(null)
  const commandPaletteRef = useRef<HTMLElement>(null)
  const active = documents.find((document) => document.id === activeId)

  useEffect(() => { void (async () => {
    try {
      const [stored, storedFolders, storedTrash, storedOrder] = await Promise.all([getDocuments(), getFolders(), getTrash(), getDocumentOrder()])
      const order = new Map(storedOrder.map((id, index) => [id, index]))
      const docs = stored.length ? stored.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || b.updatedAt - a.updatedAt) : [createDocument()]
      if (!stored.length) await saveDocument(docs[0])
      const inferred = docs.map((doc) => folderOf(doc.path)).filter(Boolean)
      const allFolders = [...new Set([...storedFolders, ...inferred])].sort()
      if (allFolders.length !== storedFolders.length) await saveFolders(allFolders)
      const previous = await getActiveId()
      setDocuments(docs); setFolders(allFolders); setTrash(storedTrash); setActiveId(docs.some((item) => item.id === previous) ? previous! : docs[0].id)
    } catch {
      const fallback = createDocument()
      setDocuments([fallback]); setActiveId(fallback.id); setStorageError('Không thể truy cập IndexedDB. Thay đổi trong phiên này có thể không được lưu.')
    }
  })() }, [])

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme) }, [theme])
  useEffect(() => {
    const handler = (event: Event) => setPwaUpdate((event as CustomEvent<ServiceWorkerRegistration>).detail)
    window.addEventListener('markdown-studio:update', handler); return () => window.removeEventListener('markdown-studio:update', handler)
  }, [])
  useEffect(() => { localStorage.setItem('allowRemoteImages', String(allowRemoteImages)) }, [allowRemoteImages])
  useEffect(() => { localStorage.setItem('sidebarWidth', String(sidebarWidth)) }, [sidebarWidth])
  useEffect(() => { localStorage.setItem('tocWidth', String(tocWidth)) }, [tocWidth])
  useEffect(() => { localStorage.setItem('collapsedFolders', JSON.stringify([...collapsedFolders])) }, [collapsedFolders])
  useEffect(() => { indexWorkspace(documents) }, [documents])
  useEffect(() => {
    let cancelled = false
    const value = query.trim()
    if (!value) { setSearchHits([]); return }
    const timer = window.setTimeout(() => {
      if (typeof Worker === 'undefined') {
        const normalized = value.toLowerCase()
        setSearchHits(documents.filter((item) => `${item.name} ${item.path} ${item.content}`.toLowerCase().includes(normalized)).map((item) => ({ id: item.id, score: 1, snippet: item.content.slice(0, 150).replace(/\s+/g, ' ') })))
      } else void searchWorkspace(value).then((results) => { if (!cancelled) setSearchHits(results) })
    }, 120)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [documents, query])
  useEffect(() => {
    const update = () => void navigator.storage?.estimate?.().then(({ usage = 0, quota = 0 }) => setStorageEstimate({ usage, quota })).catch(() => undefined)
    update(); const timer = window.setTimeout(update, 700)
    return () => window.clearTimeout(timer)
  }, [documents, trash, history])
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
    if (!historyBases.current.has(active.id)) historyBases.current.set(active.id, active)
    setDocuments((items) => items.map((item) => item.id === active.id ? next : item))
    window.clearTimeout(saveTimers.current.get(active.id))
    const timer = window.setTimeout(() => {
      saveTimers.current.delete(active.id)
      const previous = historyBases.current.get(active.id); historyBases.current.delete(active.id)
      void saveDocumentWithHistory(next, previous).then(() => notify('Đã lưu trên thiết bị')).catch(() => notify('Không thể lưu. Hãy tải file để tránh mất dữ liệu.', 3500))
    }, 450)
    saveTimers.current.set(active.id, timer)
  }

  const formatEditor = (format: MarkdownFormat) => {
    const editor = editorRef.current
    if (!editor || !active) return
    const result = applyMarkdownFormat(active.content, editor.selectionStart, editor.selectionEnd, format)
    updateContent(result.value)
    requestAnimationFrame(() => { editor.focus(); editor.setSelectionRange(result.selectionStart, result.selectionEnd) })
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

  const importDirectory = async () => {
    if (!window.showDirectoryPicker) return notify('Trình duyệt chưa hỗ trợ mở thư mục. Hãy dùng Chrome/Edge trên HTTPS hoặc localhost.', 3800)
    try {
      const root = await window.showDirectoryPicker()
      const files: File[] = []
      const walk = async (directory: FileSystemDirectoryHandle, relative: string) => {
        for await (const entry of directory.values()) {
          if (entry.kind === 'directory') await walk(entry, `${relative}/${entry.name}`)
          else if (/\.(md|markdown|mdown)$/i.test(entry.name)) {
            const file = await entry.getFile()
            Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: [selectedFolder, root.name, relative, entry.name].filter(Boolean).join('/') })
            files.push(file)
          }
        }
      }
      await walk(root, '')
      if (!files.length) return notify('Thư mục không có file Markdown', 2800)
      await importFiles(files)
    } catch (error) { if ((error as DOMException).name !== 'AbortError') notify('Không thể đọc thư mục đã chọn', 3000) }
  }

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

  const moveDocumentFromTree = async (id: string, targetFolder: string, beforeId?: string) => {
    if (id === beforeId) return
    const source = documents.find((document) => document.id === id)
    if (!source) return
    const targetPath = [targetFolder, source.name].filter(Boolean).join('/')
    if (documents.some((document) => document.id !== id && document.path.toLowerCase() === targetPath.toLowerCase())) return notify('Đã có file cùng tên tại vị trí đích', 2800)
    const moved = { ...source, path: targetPath, updatedAt: Date.now() }
    const reordered = documents.filter((document) => document.id !== id)
    const beforeIndex = beforeId ? reordered.findIndex((document) => document.id === beforeId) : -1
    reordered.splice(beforeIndex >= 0 ? beforeIndex : reordered.length, 0, moved)
    setDocuments(reordered)
    try { await saveDocument(moved); await saveDocumentOrder(reordered.map((document) => document.id)); notify(targetFolder === folderOf(source.path) ? 'Đã sắp xếp tài liệu' : `Đã chuyển vào ${targetFolder || 'thư mục gốc'}`) } catch { setStorageError('Không thể lưu thứ tự hoặc vị trí tài liệu.') }
  }

  const moveFolderFromTree = async (source: string, targetParent: string, beforePath?: string) => {
    if (source === beforePath) return
    if (!source || targetParent === source || targetParent.startsWith(`${source}/`)) return notify('Không thể chuyển folder vào chính nó', 2800)
    const sourceParent = folderOf(source)
    const target = [targetParent, basename(source)].filter(Boolean).join('/')
    if (target !== source && folders.some((folder) => folder !== source && (folder === target || folder.startsWith(`${target}/`)))) return notify('Folder đích đã tồn tại', 2800)
    const rewrite = (path: string) => path === source ? target : path.startsWith(`${source}/`) ? `${target}${path.slice(source.length)}` : path
    const nextFolders = folders.filter((folder) => folder !== source && !folder.startsWith(`${source}/`))
    const movedFolders = folders.filter((folder) => folder === source || folder.startsWith(`${source}/`)).map(rewrite)
    const beforeIndex = beforePath ? nextFolders.indexOf(beforePath) : -1
    nextFolders.splice(beforeIndex >= 0 ? beforeIndex : nextFolders.length, 0, ...movedFolders)
    const nextDocuments = documents.map((document) => document.path.startsWith(`${source}/`) ? { ...document, path: rewrite(document.path), updatedAt: Date.now() } : document)
    if (new Set(nextDocuments.map((document) => document.path.toLowerCase())).size !== nextDocuments.length) return notify('Di chuyển sẽ tạo đường dẫn trùng', 2800)
    try { await saveFolders(nextFolders); await saveDocuments(nextDocuments.filter((document) => document.path.startsWith(`${target}/`))) } catch { return setStorageError('Không thể lưu vị trí folder mới.') }
    setFolders(nextFolders); setDocuments(nextDocuments)
    if (selectedFolder === source || selectedFolder.startsWith(`${source}/`)) setSelectedFolder(rewrite(selectedFolder))
    notify(targetParent === sourceParent ? 'Đã sắp xếp folder' : `Đã chuyển folder vào ${targetParent || 'thư mục gốc'}`)
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

  const renameSelectedFolder = async (folderPath = selectedFolder) => {
    if (!folderPath) return
    const parent = folderPath.split('/').slice(0, -1).join('/')
    const requested = prompt('Tên thư mục mới:', basename(folderPath))?.trim().replace(/^\/+|\/+$/g, '')
    if (!requested || requested.includes('/')) return
    const target = [parent, requested].filter(Boolean).join('/')
    if (folders.some((folder) => folder !== folderPath && (folder === target || folder.startsWith(`${target}/`)))) return notify('Thư mục đích đã tồn tại', 2800)
    const rewrite = (path: string) => path === folderPath ? target : path.startsWith(`${folderPath}/`) ? `${target}${path.slice(folderPath.length)}` : path
    const nextFolders = folders.map(rewrite)
    const nextDocuments = documents.map((document) => document.path.startsWith(`${selectedFolder}/`) ? { ...document, path: rewrite(document.path), updatedAt: Date.now() } : document)
    if (new Set(nextDocuments.map((document) => document.path.toLowerCase())).size !== nextDocuments.length) return notify('Đổi tên sẽ tạo đường dẫn trùng', 3000)
    try { await saveDocuments(nextDocuments.filter((document) => document.path.startsWith(`${target}/`))); await saveFolders(nextFolders) } catch { setStorageError('Không thể lưu thay đổi thư mục.') }
    setFolders(nextFolders); setDocuments(nextDocuments); if (selectedFolder === folderPath) setSelectedFolder(target); notify('Đã đổi tên thư mục')
  }

  const deleteSelectedFolder = async (folderPath = selectedFolder) => {
    if (!folderPath) return
    const affected = documents.filter((document) => document.path.startsWith(`${folderPath}/`))
    if (!confirm(`Xóa thư mục “${folderPath}” và ${affected.length} tài liệu bên trong?`)) return
    affected.forEach((document) => { window.clearTimeout(saveTimers.current.get(document.id)); saveTimers.current.delete(document.id) })
    try { await Promise.all(affected.map((document) => moveDocumentToTrash(document))); const nextFolders = folders.filter((folder) => folder !== folderPath && !folder.startsWith(`${folderPath}/`)); await saveFolders(nextFolders); setFolders(nextFolders); setTrash((items) => [...affected.map((document) => ({ ...document, deletedAt: Date.now() })), ...items]); setLastTrashed(affected.map((document) => document.id)) } catch { setStorageError('Không thể chuyển đầy đủ thư mục vào thùng rác.') }
    const remaining = documents.filter((document) => !affected.some((item) => item.id === document.id))
    setDocuments(remaining); if (selectedFolder === folderPath || selectedFolder.startsWith(`${folderPath}/`)) setSelectedFolder('')
    if (!remaining.length) { const fresh = createDocument('', 'untitled.md', '# Tài liệu mới\n'); setDocuments([fresh]); setActiveId(fresh.id); try { await saveDocument(fresh) } catch { setStorageError('Không thể tạo tài liệu thay thế.') } }
    else if (affected.some((document) => document.id === activeId)) selectDocument(remaining[0].id)
    notify('Đã chuyển thư mục vào thùng rác — có thể hoàn tác', 5000)
  }

  const removeActive = async () => {
    if (!active || !confirm(`Chuyển “${active.name}” vào thùng rác?`)) return
    window.clearTimeout(saveTimers.current.get(active.id)); saveTimers.current.delete(active.id)
    historyBases.current.delete(active.id)
    await moveDocumentToTrash(active); setTrash((items) => [{ ...active, deletedAt: Date.now() }, ...items]); setLastTrashed([active.id])
    const remaining = documents.filter((item) => item.id !== active.id)
    if (remaining.length) { setDocuments(remaining); selectDocument(remaining[0].id) }
    else { const fresh = createDocument('', 'untitled.md', '# Tài liệu mới\n'); await saveDocument(fresh); setDocuments([fresh]); selectDocument(fresh.id) }
    notify('Đã chuyển vào thùng rác — có thể hoàn tác', 5000)
  }

  const downloadActive = useCallback(() => {
    if (!active) return
    const url = URL.createObjectURL(new Blob([active.content], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = active.name; link.click(); URL.revokeObjectURL(url); notify('Đã tải file Markdown')
  }, [active, notify])

  const backupWorkspace = useCallback(() => { void (async () => {
    const backup = createWorkspaceBackup({ documents, folders, activeId, settings: { theme, allowRemoteImages, sidebarWidth, tocWidth } })
    const blob = await createWorkspaceZip(backup)
    downloadBlob(blob, `markdown-studio-backup-${new Date().toISOString().slice(0, 10)}.zip`)
    notify('Đã tải backup ZIP của workspace')
  })().catch(() => notify('Không thể tạo backup ZIP', 3000)) }, [activeId, allowRemoteImages, documents, folders, notify, sidebarWidth, theme, tocWidth])

  const restoreWorkspaceFile = async (file: File) => {
    try {
      const backup = await parseWorkspaceFile(file)
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

  const restoreTrashItems = async (ids: string[]) => {
    const restored: DocumentRecord[] = []
    for (const id of ids) {
      const item = trash.find((entry) => entry.id === id)
      if (!item) continue
      const document = await restoreTrashedDocument(id)
      if (!document) continue
      const folder = folderOf(document.path)
      const name = uniqueDocumentName([...documents, ...restored], folder, document.name)
      const safe = name === document.name ? document : { ...document, name, path: [folder, name].filter(Boolean).join('/') }
      if (safe !== document) await saveDocument(safe)
      restored.push(safe)
    }
    if (!restored.length) return
    const restoredFolders = restored.map((document) => folderOf(document.path)).filter(Boolean)
    const nextFolders = [...new Set([...folders, ...restoredFolders])]
    await saveFolders(nextFolders)
    setFolders(nextFolders); setDocuments((items) => [...restored, ...items]); setTrash((items) => items.filter((item) => !ids.includes(item.id))); setLastTrashed([]); selectDocument(restored[0].id); notify(`Đã khôi phục ${restored.length} tài liệu`)
  }

  const permanentlyDeleteTrashItem = async (id: string) => {
    if (!confirm('Xóa vĩnh viễn tài liệu này? Thao tác không thể hoàn tác.')) return
    await deleteDocument(id); setTrash((items) => items.filter((item) => item.id !== id)); notify('Đã xóa vĩnh viễn')
  }

  const openHistory = async () => {
    if (!active) return
    setHistory(await getDocumentHistory(active.id)); setHistoryOpen(true)
  }

  const restoreHistoryVersion = async (version: HistoryRecord) => {
    if (!active || !confirm(`Khôi phục phiên bản lúc ${new Date(version.savedAt).toLocaleString('vi-VN')}?`)) return
    const next = { ...active, content: version.content, updatedAt: Date.now() }
    await saveDocumentWithHistory(next, active); setDocuments((items) => items.map((item) => item.id === active.id ? next : item)); setHistory(await getDocumentHistory(active.id)); notify('Đã khôi phục phiên bản cũ')
  }

  const openFromDisk = async () => {
    if (!window.showOpenFilePicker) return fileInput.current?.click()
    try {
      const handles = await window.showOpenFilePicker({ multiple: true, types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdown'] } }] })
      const files = await Promise.all(handles.map((handle) => handle.getFile()))
      const result = await filesToDocuments(files, selectedFolder)
      const imported = result.documents.map((document, index) => {
        const name = uniqueDocumentName([...documents], selectedFolder, document.name)
        const next = { ...document, name, path: [selectedFolder, name].filter(Boolean).join('/') }
        fileHandles.current.set(next.id, handles[index])
        return next
      })
      await saveDocuments(imported); setDocuments((items) => [...imported, ...items]); if (imported[0]) selectDocument(imported[0].id); notify(`Đã mở ${imported.length} file từ máy`)
    } catch (error) { if ((error as DOMException).name !== 'AbortError') notify('Không thể mở file từ máy', 2800) }
  }

  const saveToDisk = async () => {
    if (!active) return
    if (!window.showSaveFilePicker) return downloadActive()
    try {
      let handle = fileHandles.current.get(active.id)
      handle ??= await window.showSaveFilePicker({ suggestedName: active.name, types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }] })
      const writable = await handle.createWritable(); await writable.write(active.content); await writable.close(); fileHandles.current.set(active.id, handle); notify('Đã ghi trực tiếp vào file trên máy')
    } catch (error) { if ((error as DOMException).name !== 'AbortError') notify('Không thể ghi file lên máy', 2800) }
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

  const filtered = useMemo(() => {
    if (!query.trim()) return documents
    const byId = new Map(documents.map((document) => [document.id, document]))
    return searchHits.map((hit) => byId.get(hit.id)).filter((document): document is DocumentRecord => Boolean(document))
  }, [documents, query, searchHits])
  const storagePercent = storageEstimate.quota ? Math.min(100, storageEstimate.usage / storageEstimate.quota * 100) : 0
  const formatBytes = (value: number) => value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(1)} GB` : `${(value / 1024 ** 2).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)} MB`
  const trashFolders = useMemo(() => [...new Set(trash.map((item) => folderOf(item.path)).filter(Boolean))].sort(), [trash])
  const commandDocuments = useMemo(() => {
    const needle = commandQuery.trim().toLowerCase()
    return (needle ? documents.filter((document) => document.path.toLowerCase().includes(needle)) : documents).slice(0, 6)
  }, [commandQuery, documents])
  const runCommand = (action: () => void) => { action(); setCommandOpen(false); setCommandQuery('') }
  const navigateCommands = (event: React.KeyboardEvent<HTMLElement>) => {
    const buttons = [...(commandPaletteRef.current?.querySelectorAll<HTMLButtonElement>('.command-results button') ?? [])]
    if (!buttons.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const next = commandIndex < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (commandIndex + delta + buttons.length) % buttons.length
      setCommandIndex(next); buttons[next].focus()
    } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault(); buttons[Math.max(0, commandIndex)]?.click()
    }
  }
  useEffect(() => {
    if (!commandOpen) return
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
      const buttons = [...(commandPaletteRef.current?.querySelectorAll<HTMLButtonElement>('.command-results button') ?? [])]
      if (!buttons.length) return
      event.preventDefault()
      setCommandIndex((current) => {
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const next = current < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (current + delta + buttons.length) % buttons.length
        buttons[next].focus(); return next
      })
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [commandOpen])
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
      <div className="top-actions">{notice && <div className="notice"><Check /> {notice}{lastTrashed.length > 0 && <button onClick={() => void restoreTrashItems(lastTrashed)}>Hoàn tác</button>}</div>}<button className="icon-button" onClick={() => { setCommandOpen(true); setCommandQuery('') }} aria-label="Mở bảng lệnh" title="Bảng lệnh (Ctrl/⌘ K)"><Command /></button><div className="segmented" aria-label="Chế độ hiển thị"><button className={mode === 'editor' ? 'active' : ''} onClick={() => setMode('editor')}>Editor</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>Preview</button></div><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Đổi giao diện">{theme === 'dark' ? <Sun /> : <Moon />}</button></div>
    </header>

    {storageError && <div className="recovery-banner" role="alert"><div><strong>Không thể lưu ổn định</strong><span>{storageError}</span></div><button onClick={backupWorkspace}><DatabaseBackup /> Backup ngay</button><button className="banner-close" onClick={() => setStorageError('')} aria-label="Đóng cảnh báo"><X /></button></div>}
    {pwaUpdate && <div className="update-banner" role="status"><div><strong>Có phiên bản mới</strong><span>Cập nhật để nhận tính năng và bản sửa lỗi mới nhất.</span></div><button onClick={() => pwaUpdate.waiting?.postMessage('SKIP_WAITING')}>Cập nhật ngay</button><button className="banner-close" onClick={() => setPwaUpdate(null)} aria-label="Đóng thông báo cập nhật"><X /></button></div>}

    <div className={`workspace ${sidebarOpen ? '' : 'sidebar-collapsed'} ${tocOpen ? '' : 'toc-collapsed'}`}>
      <aside className={`sidebar ${mobileLibrary ? 'mobile-open' : ''}`}>
        <div className="sidebar-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Thư viện</h2></div><button className="icon-button mobile-only" onClick={() => setMobileLibrary(false)} aria-label="Đóng"><X /></button></div>
        <div className="library-actions"><button className="primary-button" onClick={() => void openFromDisk()}><Upload /> Mở file</button><button className="icon-button bordered" onClick={() => void importDirectory()} aria-label="Nhập thư mục" title="Nhập toàn bộ thư mục Markdown"><FolderInput /></button><button className="icon-button bordered" onClick={addFolder} aria-label="Tạo thư mục" title="Tạo thư mục"><FolderPlus /></button><button className="icon-button bordered" onClick={addDocument} aria-label="Tạo tài liệu" title="Tạo tài liệu"><Plus /></button></div>
        <div className="workspace-actions"><button onClick={backupWorkspace} title="Backup toàn bộ workspace"><DatabaseBackup /> Backup ZIP</button><button onClick={() => restoreInput.current?.click()} title="Khôi phục workspace"><ArchiveRestore /> Restore</button><button onClick={() => setTrashOpen(true)} title="Mở thùng rác"><Trash2 /> {trash.length}</button></div>
        <input ref={fileInput} type="file" accept=".md,.markdown,.mdown,text/markdown" multiple hidden onChange={(event) => event.target.files && void importFiles(event.target.files)} />
        <input ref={restoreInput} type="file" accept="application/json,.json,application/zip,.zip" hidden onChange={(event) => event.target.files?.[0] && void restoreWorkspaceFile(event.target.files[0])} />
        <label className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, path hoặc nội dung…" /></label>
        <div className="file-count"><Files /> {filtered.length} tài liệu <span>{query ? '• full-text' : selectedFolder ? `• ${selectedFolder}` : '• thư mục gốc'}</span></div>
        {query && searchHits[0]?.snippet && <button className="search-best-hit" onClick={() => selectDocument(searchHits[0].id)}><strong>Kết quả phù hợp nhất</strong><span>{searchHits[0].snippet}</span></button>}
        <FolderTree documents={filtered} folders={folders} activeId={activeId} selectedFolder={selectedFolder} collapsed={collapsedFolders} onSelectDocument={selectDocument} onSelectFolder={setSelectedFolder} onToggleFolder={(path) => setCollapsedFolders((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next })} onMoveDocument={(id, folder, beforeId) => void moveDocumentFromTree(id, folder, beforeId)} onMoveFolder={(source, target, beforePath) => void moveFolderFromTree(source, target, beforePath)} onRenameFolder={(path) => void renameSelectedFolder(path)} onDeleteFolder={(path) => void deleteSelectedFolder(path)} />
        <div className={`storage-dashboard ${storagePercent >= 80 ? 'warning' : ''}`} title={`${formatBytes(storageEstimate.usage)} / ${formatBytes(storageEstimate.quota)}`}><div><HardDrive /><strong>Dung lượng</strong><span>{storageEstimate.quota ? `${storagePercent.toFixed(1)}%` : 'N/A'}</span></div><div className="storage-meter"><i style={{ width: `${storagePercent}%` }} /></div><small>{formatBytes(storageEstimate.usage)} / {storageEstimate.quota ? formatBytes(storageEstimate.quota) : 'không xác định'}{storagePercent >= 80 ? ' • Nên backup và dọn thùng rác' : ''}</small></div>
        <div className="privacy"><span className="privacy-icon">⌁</span><div><strong>Lưu cục bộ</strong><p>Tài liệu không rời khỏi trình duyệt.</p></div></div>
        <div className="panel-resizer sidebar-resizer" onPointerDown={(event) => startPanelResize('sidebar', event)} role="separator" aria-label="Thay đổi độ rộng thư viện" />
      </aside>

      <main className="main-panel">
        <div className="document-toolbar"><button className="icon-button desktop-only" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Ẩn hiện thư viện">{sidebarOpen ? <PanelLeftClose /> : <ChevronRight />}</button><div className="path"><BookOpen /> {active?.path ?? ''}</div>
          <select className="folder-select" aria-label="Chuyển tài liệu vào thư mục" value={active ? folderOf(active.path) : ''} onChange={(event) => void moveActive(event.target.value)}><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select>
          <button className="icon-button" onClick={() => setAllowRemoteImages((value) => !value)} aria-label={allowRemoteImages ? 'Chặn ảnh từ xa' : 'Cho phép ảnh từ xa'} title={allowRemoteImages ? 'Ảnh từ xa đang được phép' : 'Ảnh từ xa đang bị chặn'}>{allowRemoteImages ? <Image /> : <ImageOff />}</button><button className="icon-button" onClick={() => void openHistory()} aria-label="Lịch sử tài liệu" title="Lịch sử phiên bản"><History /></button><button className="icon-button" onClick={() => void renameActive()} aria-label="Đổi tên tài liệu" title="Đổi tên"><Pencil /></button><button className="icon-button" onClick={() => void saveToDisk()} aria-label="Lưu trực tiếp về máy" title="Lưu trực tiếp bằng File System Access API"><Save /></button><button className="icon-button" onClick={downloadActive} aria-label="Tải file về máy" title="Tải file về máy (Ctrl/⌘ S)"><ArrowDownToLine /></button><button className="icon-button" onClick={() => { setMode('preview'); setReadingMode(true) }} aria-label="Chế độ đọc toàn trang" title="Đọc toàn trang (Ctrl/⌘ ⇧ F)"><Maximize2 /></button><button className="icon-button danger" onClick={() => void removeActive()} aria-label="Chuyển vào thùng rác"><Trash2 /></button><button className="icon-button desktop-only" onClick={() => setTocOpen(!tocOpen)} aria-label="Ẩn hiện mục lục">{tocOpen ? <PanelRightClose /> : <ChevronLeft />}</button>
        </div>
        {mode === 'editor' ? <div className="editor-shell"><EditorToolbar onFormat={formatEditor} /><textarea ref={editorRef} className="editor" aria-label="Nội dung Markdown" spellCheck={false} value={active?.content ?? ''} onChange={(event) => updateContent(event.target.value)} /></div> : <article ref={previewRef} className="preview markdown-body" onScroll={updateReadingState} onClick={(event) => void onPreviewClick(event)} dangerouslySetInnerHTML={{ __html: html }} />}
        <div className="shortcut-hints"><span><kbd>⌘/Ctrl S</kbd> tải file</span><span><kbd>⌘/Ctrl O</kbd> mở file</span><span><kbd>⌘/Ctrl ⇧ P</kbd> đổi chế độ</span><span><kbd>⌘/Ctrl ⇧ F</kbd> đọc toàn trang</span></div>
        {mode === 'preview' && readingProgress > 12 && <button className="back-to-top" onClick={() => previewRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Lên đầu trang" title="Lên đầu trang"><ArrowUp /></button>}
        {readingMode && <button className="exit-reading" onClick={() => setReadingMode(false)} aria-label="Thoát chế độ đọc toàn trang" title="Thoát (Esc)"><Minimize2 /><span>Thoát chế độ đọc</span></button>}
      </main>

      <aside ref={tocRef} className="toc"><div className="panel-resizer toc-resizer" onPointerDown={(event) => startPanelResize('toc', event)} role="separator" aria-label="Thay đổi độ rộng mục lục" /><span className="eyebrow">TRONG TRANG NÀY</span>{headings.length ? <nav>{headings.map((heading) => <a key={heading.id} data-toc-id={heading.id} className={`${heading.id === activeHeading ? 'active ' : ''}toc-level-${heading.level}`} href={`#${heading.id}`} onClick={(event) => { event.preventDefault(); const root = previewRef.current; const target = root?.querySelector<HTMLElement>(`#${CSS.escape(heading.id)}`); if (root && target) root.scrollTo({ top: Math.max(0, target.offsetTop - 20), behavior: 'smooth' }) }}>{heading.text}</a>)}</nav> : <p className="toc-empty">Thêm tiêu đề để tạo mục lục.</p>}<div className="toc-progress"><span>{Math.round(readingProgress)}%</span><small>Đã đọc</small></div></aside>
    </div>
    {mobileLibrary && <button className="backdrop" onClick={() => setMobileLibrary(false)} aria-label="Đóng thư viện" />}
    {isDragging && <div className="drop-overlay"><div><FilePlus2 /><strong>Thả file Markdown vào đây</strong><span>Nhập vào {selectedFolder || 'thư mục gốc'} • tối đa 2 MB/file</span></div></div>}
    {trashOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setTrashOpen(false) }}><section className="manager-modal" role="dialog" aria-modal="true" aria-label="Thùng rác"><header><div><span className="eyebrow">WORKSPACE</span><h2>Thùng rác</h2></div><button className="icon-button" onClick={() => setTrashOpen(false)} aria-label="Đóng thùng rác"><X /></button></header>{trashFolders.length > 0 && <div className="trash-folder-actions">{trashFolders.map((folder) => { const ids = trash.filter((item) => folderOf(item.path) === folder || folderOf(item.path).startsWith(`${folder}/`)).map((item) => item.id); return <button key={folder} onClick={() => void restoreTrashItems(ids)}><FolderInput /><span><strong>{folder}</strong><small>Khôi phục {ids.length} file trong folder</small></span></button> })}</div>}<div className="manager-list">{trash.length ? trash.map((item) => <article key={item.id}><Trash2 /><div><strong>{item.name}</strong><small>{item.path} • {new Date(item.deletedAt).toLocaleString('vi-VN')}</small></div><button onClick={() => void restoreTrashItems([item.id])} title="Khôi phục"><RotateCcw /></button><button className="danger" onClick={() => void permanentlyDeleteTrashItem(item.id)} title="Xóa vĩnh viễn"><X /></button></article>) : <p className="empty-state">Thùng rác đang trống.</p>}</div></section></div>}
    {historyOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setHistoryOpen(false) }}><section className="manager-modal" role="dialog" aria-modal="true" aria-label="Lịch sử tài liệu"><header><div><span className="eyebrow">{active?.name}</span><h2>Lịch sử phiên bản</h2></div><button className="icon-button" onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử"><X /></button></header><div className="manager-list">{history.length ? history.map((version) => <article key={version.key}><Clock3 /><div><strong>{new Date(version.savedAt).toLocaleString('vi-VN')}</strong><small>{version.content.length.toLocaleString('vi-VN')} ký tự</small></div><button onClick={() => void restoreHistoryVersion(version)} title="Khôi phục phiên bản"><RotateCcw /></button></article>) : <p className="empty-state">Chưa có phiên bản cũ. Lịch sử được tạo sau mỗi đợt autosave có thay đổi.</p>}</div></section></div>}
    {commandOpen && <div className="command-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setCommandOpen(false) }}><section ref={commandPaletteRef} className="command-palette" role="dialog" aria-modal="true" aria-label="Bảng lệnh"><label><Search /><input autoFocus value={commandQuery} onChange={(event) => { setCommandQuery(event.target.value); setCommandIndex(-1) }} onKeyDown={navigateCommands} placeholder="Tìm file hoặc lệnh…" /></label><div className="command-results"><span className="command-group">LỆNH NHANH</span><button onClick={() => runCommand(() => setTheme((value) => value === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? <Sun /> : <Moon />} Đổi giao diện</button><button onClick={() => runCommand(() => { setMode('preview'); setReadingMode(true) })}><Maximize2 /> Đọc toàn trang</button><button onClick={() => runCommand(backupWorkspace)}><DatabaseBackup /> Backup workspace</button><button onClick={() => runCommand(() => setAllowRemoteImages((value) => !value))}>{allowRemoteImages ? <ImageOff /> : <Image />} {allowRemoteImages ? 'Chặn ảnh từ xa' : 'Cho phép ảnh từ xa'}</button><span className="command-group">TÀI LIỆU</span>{commandDocuments.map((document) => <button key={document.id} onClick={() => runCommand(() => selectDocument(document.id))}><BookOpen /><span><strong>{document.name}</strong><small>{document.path}</small></span></button>)}</div><footer><kbd>↑↓</kbd> di chuyển <kbd>Enter</kbd> chọn <kbd>Esc</kbd> đóng</footer></section></div>}
  </div>
}
