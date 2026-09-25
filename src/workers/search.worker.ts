import { createSearchIndex, searchIndex, type SearchIndexItem, type SearchSource } from '../lib/search-engine'

let documents: SearchIndexItem[] = []

self.onmessage = (event: MessageEvent<{ type: 'index'; documents: SearchSource[] } | { type: 'search'; id: number; query: string }>) => {
  if (event.data.type === 'index') {
    documents = createSearchIndex(event.data.documents)
    return
  }
  self.postMessage({ id: event.data.id, results: searchIndex(documents, event.data.query) })
}
