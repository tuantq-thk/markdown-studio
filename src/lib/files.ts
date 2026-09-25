import type { DocumentRecord } from '../types'

const MAX_FILE_BYTES = 2 * 1024 * 1024

export const isMarkdownFile = (file: File) => /\.(md|markdown|mdown)$/i.test(file.name)

const readText = (file: File): Promise<string> => {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export async function filesToDocuments(files: File[], targetFolder = ''): Promise<{ documents: DocumentRecord[]; rejected: string[] }> {
  const rejected: string[] = []
  const accepted = files.filter((file) => {
    if (!isMarkdownFile(file) || file.size > MAX_FILE_BYTES) {
      rejected.push(file.name)
      return false
    }
    return true
  })
  const results = await Promise.allSettled(accepted.map(async (file) => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const path = relativePath.includes('/') ? relativePath : [targetFolder, file.name].filter(Boolean).join('/')
    return {
    id: crypto.randomUUID(),
    name: file.name,
    path,
    content: await readText(file),
    updatedAt: Date.now(),
  }}))
  const documents: DocumentRecord[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') documents.push(result.value)
    else rejected.push(accepted[index].name)
  })
  return { documents, rejected }
}
