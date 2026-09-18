import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import type { DocumentRecord } from '../types'

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
  const sort = (node: TreeNode) => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    node.documents.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    node.folders.forEach(sort)
  }
  sort(root)
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
}

export function FolderTree({ documents, folders, activeId, selectedFolder, collapsed, onSelectDocument, onSelectFolder, onToggleFolder }: Props) {
  const tree = buildTree(documents, folders)
  const rootCollapsed = collapsed.has('__root__')
  const renderDocument = (document: DocumentRecord, depth: number) => <button key={document.id} className={document.id === activeId ? 'tree-file active' : 'tree-file'} style={{ paddingLeft: 9 + depth * 14 }} onClick={() => onSelectDocument(document.id)} title={document.path}>
    <FileText /><span>{document.name}</span>
  </button>
  const renderFolder = (node: TreeNode, depth: number) => {
    const isCollapsed = collapsed.has(node.path)
    const isSelected = selectedFolder === node.path
    return <div key={node.path} className="tree-folder-group">
      <div className={isSelected ? 'tree-folder selected' : 'tree-folder'} style={{ paddingLeft: 5 + depth * 14 }}>
        <button className="tree-toggle" onClick={() => onToggleFolder(node.path)} aria-label={`${isCollapsed ? 'Mở' : 'Đóng'} thư mục ${node.name}`}>{isCollapsed ? <ChevronRight /> : <ChevronDown />}</button>
        <button className="tree-folder-name" onClick={() => onSelectFolder(node.path)}>{isCollapsed ? <Folder /> : <FolderOpen />}<span>{node.name}</span><small>{node.documents.length + node.folders.length}</small></button>
      </div>
      {!isCollapsed && <div>{node.folders.map((folder) => renderFolder(folder, depth + 1))}{node.documents.map((document) => renderDocument(document, depth + 1))}</div>}
    </div>
  }
  return <nav className="folder-tree" aria-label="Cây tài liệu">
    <div className={selectedFolder === '' ? 'tree-folder tree-root selected' : 'tree-folder tree-root'}>
      <button className="tree-toggle" onClick={() => onToggleFolder('__root__')} aria-label={`${rootCollapsed ? 'Mở' : 'Đóng'} thư mục gốc`}>{rootCollapsed ? <ChevronRight /> : <ChevronDown />}</button>
      <button className="tree-folder-name" onClick={() => onSelectFolder('')}>{rootCollapsed ? <Folder /> : <FolderOpen />}<span>Tất cả tài liệu</span><small>{documents.length}</small></button>
    </div>
    {!rootCollapsed && <>{tree.folders.map((folder) => renderFolder(folder, 0))}{tree.documents.map((document) => renderDocument(document, 0))}</>}
  </nav>
}
