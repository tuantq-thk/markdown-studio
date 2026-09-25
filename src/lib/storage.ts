import { openDB } from 'idb'
import type { DocumentRecord } from '../types'

const DATABASE = 'markdown-studio'
const STORE = 'documents'
const META = 'meta'

const db = () => openDB(DATABASE, 1, {
  upgrade(database) {
    database.createObjectStore(STORE, { keyPath: 'id' })
    database.createObjectStore(META)
  },
})

export async function getDocuments(): Promise<DocumentRecord[]> {
  return (await db()).getAll(STORE)
}

export async function saveDocument(document: DocumentRecord): Promise<void> {
  await (await db()).put(STORE, document)
}

export async function saveDocuments(documents: DocumentRecord[]): Promise<void> {
  const database = await db()
  const transaction = database.transaction(STORE, 'readwrite')
  await Promise.all([...documents.map((document) => transaction.store.put(document)), transaction.done])
}

export async function deleteDocument(id: string): Promise<void> {
  await (await db()).delete(STORE, id)
}

export async function getActiveId(): Promise<string | undefined> {
  return (await db()).get(META, 'activeId')
}

export async function saveActiveId(id: string): Promise<void> {
  await (await db()).put(META, id, 'activeId')
}

export async function getFolders(): Promise<string[]> {
  return (await (await db()).get(META, 'folders')) ?? []
}

export async function saveFolders(folders: string[]): Promise<void> {
  await (await db()).put(META, [...new Set(folders)].sort(), 'folders')
}

export async function replaceWorkspace(documents: DocumentRecord[], folders: string[], activeId?: string): Promise<void> {
  const database = await db()
  const transaction = database.transaction([STORE, META], 'readwrite')
  await transaction.objectStore(STORE).clear()
  await Promise.all(documents.map((document) => transaction.objectStore(STORE).put(document)))
  await transaction.objectStore(META).put([...new Set(folders)].sort(), 'folders')
  if (activeId) await transaction.objectStore(META).put(activeId, 'activeId')
  await transaction.done
}
