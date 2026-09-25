import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { deleteDocument, getDocuments } from './lib/storage'

describe('Markdown Studio', () => {
  beforeEach(async () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `id-${Math.random()}`) })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    Object.assign(HTMLElement.prototype, { scrollTo: vi.fn(), scrollIntoView: vi.fn() })
    const documents = await getDocuments()
    await Promise.all(documents.map((document) => deleteDocument(document.id)))
    localStorage.clear()
  })

  it('creates a welcome document and switches between editor and preview', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Chào mừng đến Markdown Studio' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chào mừng đến Markdown Studio' })).toHaveClass('active')
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Editor' }))
    const editor = screen.getByLabelText('Nội dung Markdown')
    fireEvent.change(editor, { target: { value: '# Eloquent sâu hơn\n\nNội dung kiểm thử.' } })
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByRole('heading', { name: 'Eloquent sâu hơn' })).toBeInTheDocument()
    await waitFor(async () => expect((await getDocuments())[0].content).toContain('Eloquent sâu hơn'), { timeout: 2000 })
  })

  it('toggles dark theme and exposes document actions', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Chào mừng đến Markdown Studio' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Đổi giao diện' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Tạo tài liệu' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Xóa tài liệu' })).toBeEnabled()
  })

  it('copies highlighted code and toggles mode with the keyboard shortcut', async () => {
    render(<App />)
    const copy = await screen.findAllByRole('button', { name: 'Sao chép code' }, { timeout: 5000 })
    await userEvent.click(copy[0])
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('ArticleRepository'))
    fireEvent.keyDown(window, { key: 'P', ctrlKey: true, shiftKey: true })
    expect(screen.getByLabelText('Nội dung Markdown')).toBeInTheDocument()
  })

  it('creates a folder and a document inside it', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Laravel')
    render(<App />)
    await screen.findByRole('heading', { name: 'Chào mừng đến Markdown Studio' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Tạo thư mục' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tạo tài liệu' }))
    expect((await screen.findAllByText('Laravel')).length).toBeGreaterThanOrEqual(1)
    expect((await getDocuments()).some((document) => document.path.startsWith('Laravel/untitled-'))).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Đóng thư mục Laravel' }))
    expect(screen.queryByRole('button', { name: /untitled-1\.md/ })).not.toBeInTheDocument()
  })

  it('downloads the active Markdown file', async () => {
    const createObjectURL = vi.fn(() => 'blob:markdown')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<App />)
    await screen.findByRole('heading', { name: 'Chào mừng đến Markdown Studio' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Tải file về máy' }))
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:markdown')
  })

  it('can collapse the root and resets scroll when selecting another file', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Chào mừng đến Markdown Studio' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Đóng thư mục gốc' }))
    expect(screen.queryByRole('button', { name: 'welcome.md' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mở thư mục gốc' }))
    await userEvent.click(screen.getByRole('button', { name: 'welcome.md' }))
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('enters and exits full-page reading mode', async () => {
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: 'Chào mừng đến Markdown Studio' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Chế độ đọc toàn trang' }))
    expect(container.firstElementChild).toHaveClass('reading-mode')
    expect(screen.getByRole('button', { name: 'Thoát chế độ đọc toàn trang' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container.firstElementChild).not.toHaveClass('reading-mode')
  })

  it('keeps independent autosave timers for edits across documents', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Notes')
    render(<App />)
    await screen.findByRole('heading', { name: 'Chào mừng đến Markdown Studio' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Nội dung Markdown'), { target: { value: '# File đầu tiên đã sửa' } })
    await userEvent.click(screen.getByRole('button', { name: 'Tạo thư mục' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tạo tài liệu' }))
    fireEvent.change(screen.getByLabelText('Nội dung Markdown'), { target: { value: '# File thứ hai đã sửa' } })
    await waitFor(async () => {
      const stored = await getDocuments()
      expect(stored.some((document) => document.content === '# File đầu tiên đã sửa')).toBe(true)
      expect(stored.some((document) => document.content === '# File thứ hai đã sửa')).toBe(true)
    }, { timeout: 2500 })
  })
})
