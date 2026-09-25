export type SearchSource = { id: string; name: string; path: string; content: string }
export type SearchIndexItem = SearchSource & { normalized: string; title: string }
export type SearchResult = { id: string; score: number; snippet: string }

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const terms = (value: string) => normalize(value).split(/[^a-z0-9_+#.-]+/).filter((term) => term.length > 1)

export const createSearchIndex = (documents: SearchSource[]): SearchIndexItem[] => documents.map((document) => ({ ...document, title: normalize(`${document.name} ${document.path}`), normalized: normalize(document.content) }))

export function searchIndex(documents: SearchIndexItem[], query: string): SearchResult[] {
  const queryTerms = [...new Set(terms(query))]
  if (!queryTerms.length) return []
  return documents.flatMap((document) => {
    let score = 0
    let first = -1
    for (const term of queryTerms) {
      const titleMatches = document.title.split(term).length - 1
      const contentMatches = document.normalized.split(term).length - 1
      if (!titleMatches && !contentMatches) return []
      score += titleMatches * 25 + Math.min(contentMatches, 12) * 3
      const position = document.normalized.indexOf(term)
      if (first < 0 || (position >= 0 && position < first)) first = position
    }
    const start = Math.max(0, first - 70)
    const snippet = document.content.slice(start, start + 190).replace(/\s+/g, ' ').trim()
    return [{ id: document.id, score, snippet: `${start > 0 ? '…' : ''}${snippet}${start + 190 < document.content.length ? '…' : ''}` }]
  }).sort((a, b) => b.score - a.score).slice(0, 200)
}
