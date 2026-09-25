let worker: Worker | undefined
let requestId = 0
const pending = new Map<number, { resolve: (value: string[]) => void; reject: (error: Error) => void }>()

export async function highlightInWorker(blocks: Array<{ source: string; language: string }>): Promise<string[]> {
  if (!blocks.length) return []
  if (typeof Worker === 'undefined') return (await import('./highlighter')).highlightBlocks(blocks)
  worker ??= new Worker(new URL('../workers/highlight.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<{ id: number; result?: string[]; error?: string }>) => {
    const task = pending.get(event.data.id)
    if (!task) return
    pending.delete(event.data.id)
    if (event.data.result) task.resolve(event.data.result); else task.reject(new Error(event.data.error || 'Highlight failed'))
  }
  const id = ++requestId
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker!.postMessage({ id, blocks }) })
}
