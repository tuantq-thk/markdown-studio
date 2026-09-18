import { describe, expect, it, vi } from 'vitest'
import { filesToDocuments, isMarkdownFile } from './files'

describe('file import', () => {
  it('accepts supported Markdown extensions', () => {
    expect(isMarkdownFile(new File(['# A'], 'guide.md'))).toBe(true)
    expect(isMarkdownFile(new File(['# A'], 'guide.markdown'))).toBe(true)
    expect(isMarkdownFile(new File(['x'], 'script.js'))).toBe(false)
  })

  it('imports valid files and rejects unsupported files', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'document-id' })
    const result = await filesToDocuments([new File(['# Guide'], 'guide.md'), new File(['x'], 'note.txt')])
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0]).toMatchObject({ id: 'document-id', name: 'guide.md', content: '# Guide' })
    expect(result.rejected).toEqual(['note.txt'])
  })

  it('places uploaded files inside the selected folder', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'folder-document' })
    const result = await filesToDocuments([new File(['# Queue'], 'queue.md')], 'Laravel/Runtime')
    expect(result.documents[0].path).toBe('Laravel/Runtime/queue.md')
  })

  it('rejects files over 2 MB', async () => {
    const huge = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'huge.md')
    const result = await filesToDocuments([huge])
    expect(result.documents).toHaveLength(0)
    expect(result.rejected).toEqual(['huge.md'])
  })
})
