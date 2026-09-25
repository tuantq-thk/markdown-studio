import { validateDiagramsInWorker } from './diagram-client'

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
  const definitions = nodes.map((node) => node.textContent ?? '')
  const valid = await validateDiagramsInWorker(definitions)
  for (const [index, node] of nodes.entries()) {
    const definition = definitions[index]
    try {
      if (!valid[index]) throw new Error('Invalid diagram')
      const id = `mermaid-${Date.now()}-${sequence++}`
      const { svg } = await mermaid.render(id, definition)
      const iframe = document.createElement('iframe')
      iframe.className = 'diagram-frame'
      iframe.title = 'Sơ đồ Mermaid'
      iframe.setAttribute('sandbox', '')
      iframe.srcdoc = `<!doctype html><html><head><meta name="color-scheme" content="light dark"><style>html,body{margin:0;background:transparent;overflow:auto}body{display:grid;place-items:center;padding:8px;box-sizing:border-box}svg{display:block;max-width:100%;height:auto}</style></head><body>${svg}</body></html>`
      node.replaceChildren(iframe)
      node.classList.add('diagram-rendered')
      node.removeAttribute('data-diagram')
      rendered++
    } catch {
      node.classList.add('diagram-error')
      node.textContent = `Không thể render sơ đồ. Kiểm tra lại cú pháp Mermaid.\n\n${definition}`
      node.removeAttribute('data-diagram')
    }
  }
  return rendered
}
