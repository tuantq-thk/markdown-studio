import { beforeEach, describe, expect, it, vi } from 'vitest'

const { initialize, render } = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))

vi.mock('mermaid', () => ({ default: { initialize, render } }))

import { renderDiagrams } from './diagrams'

describe('diagram rendering', () => {
  beforeEach(() => { initialize.mockClear(); render.mockReset() })

  it('renders Mermaid nodes locally with strict security', async () => {
    render.mockResolvedValue({ svg: '<svg aria-label="diagram"></svg>' })
    const root = document.createElement('div')
    root.innerHTML = '<div class="mermaid" data-diagram="true">flowchart LR\nA--&gt;B</div>'
    await expect(renderDiagrams(root, 'dark')).resolves.toBe(1)
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict', theme: 'dark' }))
    const frame = root.querySelector<HTMLIFrameElement>('iframe')
    expect(frame).not.toBeNull()
    expect(frame?.srcdoc).toContain('<svg aria-label="diagram"></svg>')
    expect(root.querySelector('.mermaid')).toHaveClass('diagram-rendered')
  })

  it('shows a readable error without breaking the page', async () => {
    render.mockRejectedValue(new Error('invalid'))
    const root = document.createElement('div')
    root.innerHTML = '<div class="mermaid" data-diagram="true">broken diagram</div>'
    await expect(renderDiagrams(root, 'light')).resolves.toBe(0)
    expect(root.querySelector('.mermaid')).toHaveClass('diagram-error')
    expect(root.textContent).toContain('Không thể render sơ đồ')
  })
})
