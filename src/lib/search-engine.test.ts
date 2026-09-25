import { describe, expect, it } from 'vitest'
import { createSearchIndex, searchIndex } from './search-engine'

const index = createSearchIndex([
  { id: 'laravel', name: 'eloquent.md', path: 'backend/eloquent.md', content: '# Eloquent\nKhắc phục N+1 bằng eager loading.' },
  { id: 'react', name: 'hooks.md', path: 'frontend/hooks.md', content: '# React hooks\nQuản lý state phía client.' },
])

describe('workspace full-text search', () => {
  it('matches Vietnamese content without accents and returns a snippet', () => {
    const [result] = searchIndex(index, 'khac phuc eager')
    expect(result.id).toBe('laravel')
    expect(result.snippet).toContain('Khắc phục N+1')
  })

  it('weights file name and path above repeated body matches', () => {
    expect(searchIndex(index, 'eloquent')[0].id).toBe('laravel')
  })

  it('requires every query term and ignores one-character noise', () => {
    expect(searchIndex(index, 'react database')).toEqual([])
    expect(searchIndex(index, 'a')).toEqual([])
  })
})
