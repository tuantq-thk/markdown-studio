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
