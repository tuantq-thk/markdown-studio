import type { DocumentRecord } from '../types'

export type WorkspaceBackup = {
  format: 'markdown-studio-workspace'
  version: 1
  exportedAt: string
  documents: DocumentRecord[]
  folders: string[]
  activeId?: string
  settings: { theme: 'light' | 'dark'; allowRemoteImages: boolean; sidebarWidth: number; tocWidth: number }
}

const isDocument = (value: unknown): value is DocumentRecord => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.path === 'string' && typeof item.content === 'string' && typeof item.updatedAt === 'number'
}

export function createWorkspaceBackup(input: Omit<WorkspaceBackup, 'format' | 'version' | 'exportedAt'>): WorkspaceBackup {
  return { format: 'markdown-studio-workspace', version: 1, exportedAt: new Date().toISOString(), ...input }
}

export function parseWorkspaceBackup(source: string): WorkspaceBackup {
  const value = JSON.parse(source) as Partial<WorkspaceBackup>
  if (value.format !== 'markdown-studio-workspace' || value.version !== 1 || !Array.isArray(value.documents) || !value.documents.length || !value.documents.every(isDocument) || !Array.isArray(value.folders)) throw new Error('Invalid workspace backup')
  const paths = new Set<string>()
  value.documents.forEach((document) => {
    if (!/\.(md|markdown|mdown)$/i.test(document.name) || !document.path || paths.has(document.path)) throw new Error('Invalid or duplicate document path')
    paths.add(document.path)
  })
  const settings = value.settings
  return {
    format: value.format,
    version: value.version,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    documents: value.documents,
    folders: value.folders.filter((folder): folder is string => typeof folder === 'string'),
    activeId: value.documents.some((document) => document.id === value.activeId) ? value.activeId : value.documents[0].id,
    settings: {
      theme: settings?.theme === 'dark' ? 'dark' : 'light',
      allowRemoteImages: settings?.allowRemoteImages === true,
      sidebarWidth: typeof settings?.sidebarWidth === 'number' ? settings.sidebarWidth : 280,
      tocWidth: typeof settings?.tocWidth === 'number' ? settings.tocWidth : 230,
    },
  }
}

export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function createWorkspaceZip(backup: WorkspaceBackup): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('workspace.json', JSON.stringify(backup, null, 2))
  const assets = zip.folder('assets')
  backup.documents.forEach((document) => {
    zip.file(`documents/${document.path}`, document.content)
    let assetIndex = 0
    for (const match of document.content.matchAll(/data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)/g)) {
      const extension = match[1].split('/')[1].replace('svg+xml', 'svg')
      assets?.file(`${document.id}-${++assetIndex}.${extension}`, match[2], { base64: true })
    }
  })
  zip.file('README.txt', 'Markdown Studio workspace backup. Restore bằng nút Restore trong ứng dụng. Thư mục documents chứa bản Markdown dễ truy cập; assets chứa ảnh data URL được nhúng trong tài liệu.')
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function parseWorkspaceFile(file: File): Promise<WorkspaceBackup> {
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(file)
    const workspace = zip.file('workspace.json')
    if (!workspace) throw new Error('Missing workspace.json')
    return parseWorkspaceBackup(await workspace.async('string'))
  }
  return parseWorkspaceBackup(await file.text())
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
