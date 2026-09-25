import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createWorkspaceBackup, createWorkspaceZip, parseWorkspaceBackup } from './workspace'

const document = { id: 'doc-1', name: 'guide.md', path: 'Docs/guide.md', content: '# Guide', updatedAt: 1 }

describe('workspace backup', () => {
  it('round-trips a versioned workspace backup', () => {
    const backup = createWorkspaceBackup({ documents: [document], folders: ['Docs'], activeId: document.id, settings: { theme: 'dark', allowRemoteImages: false, sidebarWidth: 300, tocWidth: 240 } })
    const restored = parseWorkspaceBackup(JSON.stringify(backup))
    expect(restored.documents).toEqual([document])
    expect(restored.settings.theme).toBe('dark')
  })

  it('rejects malformed backups and duplicate paths', () => {
    expect(() => parseWorkspaceBackup('{}')).toThrow()
    const backup = createWorkspaceBackup({ documents: [document, { ...document, id: 'doc-2' }], folders: ['Docs'], settings: { theme: 'light', allowRemoteImages: false, sidebarWidth: 280, tocWidth: 230 } })
    expect(() => parseWorkspaceBackup(JSON.stringify(backup))).toThrow('duplicate')
  })

  it('creates a portable ZIP with workspace and Markdown files', async () => {
    const backup = createWorkspaceBackup({ documents: [document], folders: ['Docs'], settings: { theme: 'light', allowRemoteImages: false, sidebarWidth: 280, tocWidth: 230 } })
    const zip = await JSZip.loadAsync(await createWorkspaceZip(backup))
    expect(zip.file('workspace.json')).not.toBeNull()
    expect(await zip.file('documents/Docs/guide.md')?.async('string')).toBe('# Guide')
  })
})
