import { describe, expect, it } from 'vitest'
import { applyMarkdownFormat } from './editor-format'

describe('Markdown editor formatting', () => {
  it('wraps a selection and keeps the selected text selected', () => {
    expect(applyMarkdownFormat('hello world', 6, 11, 'bold')).toEqual({ value: 'hello **world**', selectionStart: 8, selectionEnd: 13 })
  })
  it('creates placeholders when there is no selection', () => expect(applyMarkdownFormat('', 0, 0, 'link').value).toBe('[liên kết](https://)'))
  it('formats multiple lines as an ordered list', () => expect(applyMarkdownFormat('one\ntwo', 0, 7, 'number').value).toBe('1. one\n2. two'))
})
