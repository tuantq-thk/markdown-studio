let worker: Worker | undefined
let requestId = 0
const pending = new Map<number, (results: boolean[]) => void>()

export function validateDiagramsInWorker(definitions: string[]): Promise<boolean[]> {
  if (typeof Worker === 'undefined') return Promise.resolve(definitions.map(() => true))
  worker ??= new Worker(new URL('../workers/diagram.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<{ id: number; results: boolean[] }>) => {
    pending.get(event.data.id)?.(event.data.results); pending.delete(event.data.id)
  }
  const id = ++requestId
  return new Promise((resolve) => { pending.set(id, resolve); worker!.postMessage({ id, definitions }) })
}
