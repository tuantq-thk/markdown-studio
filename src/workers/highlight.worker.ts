/// <reference lib="webworker" />
import { highlightBlocks } from '../lib/highlighter'

self.onmessage = async (event: MessageEvent<{ id: number; blocks: Array<{ source: string; language: string }> }>) => {
  try { self.postMessage({ id: event.data.id, result: await highlightBlocks(event.data.blocks) }) }
  catch (error) { self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Highlight failed' }) }
}
