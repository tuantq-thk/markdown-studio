import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteDocument, getActiveId, getDocuments, getFolders, saveActiveId, saveDocument, saveDocuments, saveFolders } from './storage'
import type { DocumentRecord } from '../types'

const makeDocument = (id: string): DocumentRecord => ({ id, name: `${id}.md`, path: `${id}.md`, content: `# ${id}`, updatedAt: 1 })

describe('IndexedDB storage', () => {
  beforeEach(async () => {
    const docs = await getDocuments()
    await Promise.all(docs.map((doc) => deleteDocument(doc.id)))
  })

  it('saves and updates a document', async () => {
    await saveDocument(makeDocument('one'))
    await saveDocument({ ...makeDocument('one'), content: '# Updated' })
    expect(await getDocuments()).toEqual([{ ...makeDocument('one'), content: '# Updated' }])
  })

  it('saves a batch, active id, and deletes documents', async () => {
    await saveDocuments([makeDocument('one'), makeDocument('two')])
    await saveActiveId('two')
    expect(await getActiveId()).toBe('two')
    await deleteDocument('one')
    expect((await getDocuments()).map((doc) => doc.id)).toEqual(['two'])
  })

  it('deduplicates and sorts folder paths', async () => {
    await saveFolders(['Laravel/Queue', 'Laravel', 'Laravel/Queue'])
    expect(await getFolders()).toEqual(['Laravel', 'Laravel/Queue'])
  })
})
