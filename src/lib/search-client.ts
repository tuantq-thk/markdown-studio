import type { DocumentRecord } from '../types'

export type SearchHit = { id: string; score: number; snippet: string }
let worker: Worker | undefined
let requestId = 0
const pending = new Map<number, (results: SearchHit[]) => void>()

const getWorker = () => {
  if (typeof Worker === 'undefined') return undefined
  if (!worker) {
    worker = new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; results: SearchHit[] }>) => {
      pending.get(event.data.id)?.(event.data.results)
      pending.delete(event.data.id)
    }
  }
  return worker
}

export function indexWorkspace(documents: DocumentRecord[]) {
  getWorker()?.postMessage({ type: 'index', documents: documents.map(({ id, name, path, content }) => ({ id, name, path, content })) })
}

export function searchWorkspace(query: string): Promise<SearchHit[]> {
  const instance = getWorker()
  if (!instance) return Promise.resolve([])
  const id = ++requestId
  return new Promise((resolve) => { pending.set(id, resolve); instance.postMessage({ type: 'search', id, query }) })
}
