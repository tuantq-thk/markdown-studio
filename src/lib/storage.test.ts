import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteDocument, getActiveId, getDocumentHistory, getDocuments, getFolders, getTrash, moveDocumentToTrash, restoreTrashedDocument, saveActiveId, saveDocument, saveDocuments, saveDocumentWithHistory, saveFolders } from './storage'
import type { DocumentRecord } from '../types'

const makeDocument = (id: string): DocumentRecord => ({ id, name: `${id}.md`, path: `${id}.md`, content: `# ${id}`, updatedAt: 1 })

describe('IndexedDB storage', () => {
  beforeEach(async () => {
    const docs = await getDocuments()
    const trash = await getTrash()
    await Promise.all([...docs, ...trash].map((doc) => deleteDocument(doc.id)))
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

  it('moves documents to trash and restores them', async () => {
    const document = makeDocument('trash-me')
    await saveDocument(document)
    await moveDocumentToTrash(document)
    expect(await getDocuments()).toHaveLength(0)
    expect((await getTrash())[0]).toMatchObject({ id: 'trash-me' })
    await restoreTrashedDocument('trash-me')
    expect((await getDocuments())[0]).toEqual(document)
  })

  it('stores the previous content as autosave history', async () => {
    const previous = makeDocument('history')
    await saveDocument(previous)
    await saveDocumentWithHistory({ ...previous, content: '# Current', updatedAt: 2 }, previous)
    expect((await getDocumentHistory('history'))[0]).toMatchObject({ content: '# history', documentId: 'history' })
  })
})
