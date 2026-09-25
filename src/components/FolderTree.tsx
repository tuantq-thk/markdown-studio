import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { DocumentRecord } from '../types'

const folderOf = (path: string) => path.split('/').slice(0, -1).join('/')

type TreeNode = { name: string; path: string; folders: TreeNode[]; documents: DocumentRecord[] }

function buildTree(documents: DocumentRecord[], knownFolders: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', folders: [], documents: [] }
  const ensureFolder = (folderPath: string) => {
    let node = root
    let current = ''
    folderPath.split('/').filter(Boolean).forEach((part) => {
      current = current ? `${current}/${part}` : part
      let child = node.folders.find((folder) => folder.name === part)
      if (!child) { child = { name: part, path: current, folders: [], documents: [] }; node.folders.push(child) }
      node = child
    })
    return node
  }
  knownFolders.forEach(ensureFolder)
  documents.forEach((document) => {
    const parts = document.path.split('/')
    const folderPath = parts.slice(0, -1).join('/')
    ensureFolder(folderPath).documents.push(document)
  })
  return root
}

type Props = {
  documents: DocumentRecord[]
  folders: string[]
  activeId: string
  selectedFolder: string
  collapsed: Set<string>
  onSelectDocument: (id: string) => void
  onSelectFolder: (path: string) => void
  onToggleFolder: (path: string) => void
  onMoveDocument: (id: string, targetFolder: string, beforeId?: string) => void
  onMoveFolder: (source: string, targetFolder: string, beforePath?: string) => void
  onRenameFolder: (path: string) => void
  onDeleteFolder: (path: string) => void
}

export function FolderTree({ documents, folders, activeId, selectedFolder, collapsed, onSelectDocument, onSelectFolder, onToggleFolder, onMoveDocument, onMoveFolder, onRenameFolder, onDeleteFolder }: Props) {
  const tree = useMemo(() => buildTree(documents, folders), [documents, folders])
  const rootCollapsed = collapsed.has('__root__')
  type Row = { type: 'root'; depth: number } | { type: 'folder'; depth: number; node: TreeNode } | { type: 'document'; depth: number; document: DocumentRecord }
  const rows = useMemo(() => {
    const result: Row[] = [{ type: 'root', depth: 0 }]
    if (rootCollapsed) return result
    const appendFolder = (node: TreeNode, depth: number) => {
      result.push({ type: 'folder', node, depth })
      if (!collapsed.has(node.path)) {
        node.folders.forEach((folder) => appendFolder(folder, depth + 1))
        node.documents.forEach((document) => result.push({ type: 'document', document, depth: depth + 1 }))
      }
    }
    tree.folders.forEach((folder) => appendFolder(folder, 0))
    tree.documents.forEach((document) => result.push({ type: 'document', document, depth: 0 }))
    return result
  }, [collapsed, rootCollapsed, tree])
  const viewport = useRef<HTMLElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(400)
  const [menuFolder, setMenuFolder] = useState('')
  const [dropTarget, setDropTarget] = useState('')
  useEffect(() => {
    const root = viewport.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(root); return () => observer.disconnect()
  }, [])
  const rowHeight = 34
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 8)
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / rowHeight) + 8)
  const dragPayload = (event: DragEvent, payload: { type: 'document'; id: string } | { type: 'folder'; path: string }) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-markdown-studio', JSON.stringify(payload)) }
  const readPayload = (event: DragEvent) => { try { return JSON.parse(event.dataTransfer.getData('application/x-markdown-studio')) as { type: 'document'; id: string } | { type: 'folder'; path: string } } catch { return undefined } }
  const dropInto = (event: DragEvent, folder: string, beforeId?: string, beforePath?: string) => {
    event.preventDefault(); event.stopPropagation(); setDropTarget('')
    const payload = readPayload(event)
    if (payload?.type === 'document') onMoveDocument(payload.id, folder, beforeId)
    if (payload?.type === 'folder') onMoveFolder(payload.path, folder, beforePath)
  }
  const renderDocument = (document: DocumentRecord, depth: number) => <button draggable onDragStart={(event) => { event.stopPropagation(); dragPayload(event, { type: 'document', id: document.id }) }} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropTarget(`file:${document.id}`) }} onDragLeave={() => setDropTarget('')} onDrop={(event) => dropInto(event, folderOf(document.path), document.id)} className={`${document.id === activeId ? 'tree-file active' : 'tree-file'} ${depth === 0 ? 'root-document' : ''} ${dropTarget === `file:${document.id}` ? 'drop-before' : ''}`} style={{ paddingLeft: depth === 0 ? 5 : 33 + (depth - 1) * 14 }} onClick={() => onSelectDocument(document.id)} title={`${document.path} • kéo để sắp xếp hoặc di chuyển`}>
    <FileText /><span>{document.name}</span>
  </button>
  const renderFolder = (node: TreeNode, depth: number) => {
    const isCollapsed = collapsed.has(node.path)
    const isSelected = selectedFolder === node.path
    return <div className="tree-folder-group" draggable onDragStart={(event) => { event.stopPropagation(); dragPayload(event, { type: 'folder', path: node.path }) }} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); const top = event.clientY - event.currentTarget.getBoundingClientRect().top < 9; setDropTarget(`${top ? 'before' : 'folder'}:${node.path}`) }} onDragLeave={() => setDropTarget('')} onDrop={(event) => { const before = dropTarget === `before:${node.path}`; dropInto(event, before ? folderOf(node.path) : node.path, undefined, before ? node.path : undefined) }}>
      <div className={`${isSelected ? 'tree-folder selected' : 'tree-folder'} ${dropTarget === `folder:${node.path}` ? 'drop-target' : ''} ${dropTarget === `before:${node.path}` ? 'drop-before' : ''}`} style={{ paddingLeft: 5 + depth * 14 }}>
        <button className="tree-toggle" onClick={() => onToggleFolder(node.path)} aria-label={`${isCollapsed ? 'Mở' : 'Đóng'} thư mục ${node.name}`}>{isCollapsed ? <ChevronRight /> : <ChevronDown />}</button>
        <button className="tree-folder-name" onClick={() => onSelectFolder(node.path)}>{isCollapsed ? <Folder /> : <FolderOpen />}<span>{node.name}</span><small>{node.documents.length + node.folders.length}</small></button>
        <button className="tree-more" onClick={(event) => { event.stopPropagation(); setMenuFolder((current) => current === node.path ? '' : node.path) }} aria-label={`Tùy chọn thư mục ${node.name}`}><MoreHorizontal /></button>
        {menuFolder === node.path && <div className="tree-menu" role="menu"><button onClick={() => { setMenuFolder(''); onRenameFolder(node.path) }}><Pencil /> Đổi tên</button><button className="danger" onClick={() => { setMenuFolder(''); onDeleteFolder(node.path) }}><Trash2 /> Chuyển vào thùng rác</button></div>}
      </div>
    </div>
  }
  return <nav ref={viewport} className="folder-tree virtual-tree" aria-label="Cây tài liệu" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <div className="virtual-tree-spacer" style={{ height: rows.length * rowHeight }}>
      <div className="virtual-tree-window" style={{ transform: `translateY(${start * rowHeight}px)` }}>
        {rows.slice(start, end).map((row) => <div className="virtual-tree-row" style={{ height: rowHeight }} key={row.type === 'root' ? '__root__' : row.type === 'folder' ? row.node.path : row.document.id}>
          {row.type === 'root' ? <div onDragOver={(event) => { event.preventDefault(); setDropTarget('folder:__root__') }} onDragLeave={() => setDropTarget('')} onDrop={(event) => dropInto(event, '')} className={`${selectedFolder === '' ? 'tree-folder tree-root selected' : 'tree-folder tree-root'} ${dropTarget === 'folder:__root__' ? 'drop-target' : ''}`}><button className="tree-toggle" onClick={() => onToggleFolder('__root__')} aria-label={`${rootCollapsed ? 'Mở' : 'Đóng'} thư mục gốc`}>{rootCollapsed ? <ChevronRight /> : <ChevronDown />}</button><button className="tree-folder-name" onClick={() => onSelectFolder('')}>{rootCollapsed ? <Folder /> : <FolderOpen />}<span>Tất cả tài liệu</span><small>{documents.length}</small></button></div> : row.type === 'folder' ? renderFolder(row.node, row.depth) : renderDocument(row.document, row.depth)}
        </div>)}
      </div>
    </div>
  </nav>
}
