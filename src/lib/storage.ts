import { openDB } from 'idb'
import type { DocumentRecord } from '../types'

const DATABASE = 'markdown-studio'
const STORE = 'documents'
const META = 'meta'
const TRASH = 'trash'
const HISTORY = 'history'
const DATABASE_VERSION = 3

export type TrashRecord = DocumentRecord & { deletedAt: number }
export type HistoryRecord = { key?: number; documentId: string; name: string; path: string; content: string; savedAt: number }

const db = () => openDB(DATABASE, DATABASE_VERSION, {
  upgrade(database, oldVersion) {
    if (oldVersion < 1) {
      database.createObjectStore(STORE, { keyPath: 'id' })
      database.createObjectStore(META)
    }
    if (oldVersion < 2) database.createObjectStore(TRASH, { keyPath: 'id' })
    if (oldVersion < 3) {
      const history = database.createObjectStore(HISTORY, { keyPath: 'key', autoIncrement: true })
      history.createIndex('documentId', 'documentId')
    }
  },
})

export async function getDocuments(): Promise<DocumentRecord[]> {
  return (await db()).getAll(STORE)
}

export async function saveDocument(document: DocumentRecord): Promise<void> {
  await (await db()).put(STORE, document)
}

export async function saveDocumentWithHistory(document: DocumentRecord, previous?: DocumentRecord): Promise<void> {
  const database = await db()
  const transaction = database.transaction([STORE, HISTORY], 'readwrite')
  if (previous && previous.content !== document.content) await transaction.objectStore(HISTORY).add({ documentId: previous.id, name: previous.name, path: previous.path, content: previous.content, savedAt: Date.now() })
  await transaction.objectStore(STORE).put(document)
  await transaction.done
  if (previous) await pruneHistory(previous.id, 20)
}

export async function saveDocuments(documents: DocumentRecord[]): Promise<void> {
  const database = await db()
  const transaction = database.transaction(STORE, 'readwrite')
  await Promise.all([...documents.map((document) => transaction.store.put(document)), transaction.done])
}

export async function deleteDocument(id: string): Promise<void> {
  const database = await db()
  const transaction = database.transaction([STORE, TRASH, HISTORY], 'readwrite')
  await transaction.objectStore(STORE).delete(id)
  await transaction.objectStore(TRASH).delete(id)
  const keys = await transaction.objectStore(HISTORY).index('documentId').getAllKeys(id)
  await Promise.all(keys.map((key) => transaction.objectStore(HISTORY).delete(key)))
  await transaction.done
}

export async function moveDocumentToTrash(document: DocumentRecord): Promise<void> {
  const database = await db()
  const transaction = database.transaction([STORE, TRASH], 'readwrite')
  await transaction.objectStore(TRASH).put({ ...document, deletedAt: Date.now() })
  await transaction.objectStore(STORE).delete(document.id)
  await transaction.done
}

export async function getTrash(): Promise<TrashRecord[]> {
  return (await (await db()).getAll(TRASH)).sort((a, b) => b.deletedAt - a.deletedAt)
}

export async function restoreTrashedDocument(id: string): Promise<DocumentRecord | undefined> {
  const database = await db()
  const transaction = database.transaction([STORE, TRASH], 'readwrite')
  const trashed = await transaction.objectStore(TRASH).get(id) as TrashRecord | undefined
  if (!trashed) return undefined
  const document: DocumentRecord = { id: trashed.id, name: trashed.name, path: trashed.path, content: trashed.content, updatedAt: trashed.updatedAt }
  await transaction.objectStore(STORE).put(document)
  await transaction.objectStore(TRASH).delete(id)
  await transaction.done
  return document
}

export async function getDocumentHistory(documentId: string): Promise<HistoryRecord[]> {
  const database = await db()
  const values = await database.getAllFromIndex(HISTORY, 'documentId', documentId) as HistoryRecord[]
  return values.sort((a, b) => b.savedAt - a.savedAt)
}

async function pruneHistory(documentId: string, limit: number) {
  const database = await db()
  const values = await getDocumentHistory(documentId)
  const stale = values.slice(limit).map((record) => record.key).filter((key): key is number => typeof key === 'number')
  const transaction = database.transaction(HISTORY, 'readwrite')
  await Promise.all(stale.map((key) => transaction.store.delete(key)))
  await transaction.done
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
  const transaction = database.transaction([STORE, META, TRASH, HISTORY], 'readwrite')
  await transaction.objectStore(STORE).clear()
  await transaction.objectStore(TRASH).clear()
  await transaction.objectStore(HISTORY).clear()
  await Promise.all(documents.map((document) => transaction.objectStore(STORE).put(document)))
  await transaction.objectStore(META).put([...new Set(folders)].sort(), 'folders')
  if (activeId) await transaction.objectStore(META).put(activeId, 'activeId')
  await transaction.done
}
