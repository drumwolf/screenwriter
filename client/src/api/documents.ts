import type { ScriptDocument } from './types'

export async function listDocuments(scriptId: string): Promise<ScriptDocument[]> {
  const res = await fetch(`/api/scripts/${scriptId}/documents`)
  return res.json()
}

export async function createDocument(
  scriptId: string,
  name: string,
  content: string,
): Promise<ScriptDocument | null> {
  const res = await fetch(`/api/scripts/${scriptId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function deleteDocument(scriptId: string, documentId: string): Promise<boolean> {
  const res = await fetch(`/api/scripts/${scriptId}/documents/${documentId}`, {
    method: 'DELETE',
  })
  return res.ok
}
