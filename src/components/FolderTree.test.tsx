import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FolderTree } from './FolderTree'

const document = { id: 'doc-1', name: 'guide.md', path: 'guide.md', content: '# Guide', updatedAt: 1 }

describe('FolderTree interactions', () => {
  const setup = () => {
    const callbacks = { onMoveDocument: vi.fn(), onMoveFolder: vi.fn(), onRenameFolder: vi.fn(), onDeleteFolder: vi.fn() }
    render(<FolderTree documents={[document]} folders={['Backend']} activeId="doc-1" selectedFolder="" collapsed={new Set()} onSelectDocument={vi.fn()} onSelectFolder={vi.fn()} onToggleFolder={vi.fn()} {...callbacks} />)
    return callbacks
  }

  it('moves a dragged document into a folder', () => {
    const callbacks = setup()
    const values = new Map<string, string>()
    const dataTransfer = { effectAllowed: 'none', setData: (type: string, value: string) => values.set(type, value), getData: (type: string) => values.get(type) ?? '' }
    fireEvent.dragStart(screen.getByTitle(/guide\.md/), { dataTransfer })
    const folder = screen.getByRole('button', { name: /^Backend/ }).closest('.tree-folder-group')!
    fireEvent.dragOver(folder, { dataTransfer, clientY: 30 })
    fireEvent.drop(folder, { dataTransfer })
    expect(callbacks.onMoveDocument).toHaveBeenCalledWith('doc-1', 'Backend', undefined)
  })

  it('uses a compact folder menu for rename and delete actions', async () => {
    const callbacks = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Tùy chọn thư mục Backend' }))
    await userEvent.click(screen.getByRole('button', { name: 'Đổi tên' }))
    expect(callbacks.onRenameFolder).toHaveBeenCalledWith('Backend')
  })
})
