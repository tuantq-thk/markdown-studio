let sequence = 0

export async function renderDiagrams(root: HTMLElement, theme: 'light' | 'dark'): Promise<number> {
  const nodes = [...root.querySelectorAll<HTMLElement>('.mermaid[data-diagram]')]
  if (!nodes.length) return 0
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    suppressErrorRendering: true,
  })
  let rendered = 0
  for (const node of nodes) {
    const definition = node.textContent ?? ''
    try {
      const id = `mermaid-${Date.now()}-${sequence++}`
      const { svg, bindFunctions } = await mermaid.render(id, definition)
      node.innerHTML = svg
      node.classList.add('diagram-rendered')
      node.removeAttribute('data-diagram')
      bindFunctions?.(node)
      rendered++
    } catch {
      node.classList.add('diagram-error')
      node.textContent = `Không thể render sơ đồ. Kiểm tra lại cú pháp Mermaid.\n\n${definition}`
      node.removeAttribute('data-diagram')
    }
  }
  return rendered
}
