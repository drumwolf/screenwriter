import type { CharacterEntry } from './types'

export async function listEntries(scriptId: string, characterId: string): Promise<CharacterEntry[]> {
  const res = await fetch(`/api/scripts/${scriptId}/characters/${characterId}/entries`)
  return res.json()
}

export async function createEntry(
  scriptId: string,
  characterId: string,
  content: string,
): Promise<CharacterEntry | null> {
  const res = await fetch(`/api/scripts/${scriptId}/characters/${characterId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function updateEntry(
  scriptId: string,
  characterId: string,
  entryId: string,
  content: string,
): Promise<CharacterEntry | null> {
  const res = await fetch(
    `/api/scripts/${scriptId}/characters/${characterId}/entries/${entryId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  )
  if (!res.ok) return null
  return res.json()
}

export async function deleteEntry(
  scriptId: string,
  characterId: string,
  entryId: string,
): Promise<boolean> {
  const res = await fetch(
    `/api/scripts/${scriptId}/characters/${characterId}/entries/${entryId}`,
    { method: 'DELETE' },
  )
  return res.ok
}
