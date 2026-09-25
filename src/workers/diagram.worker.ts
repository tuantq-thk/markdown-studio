/// <reference lib="webworker" />
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true })
self.onmessage = async (event: MessageEvent<{ id: number; definitions: string[] }>) => {
  const results: boolean[] = []
  for (const definition of event.data.definitions) {
    try { await mermaid.parse(definition); results.push(true) } catch { results.push(false) }
  }
  self.postMessage({ id: event.data.id, results })
}
