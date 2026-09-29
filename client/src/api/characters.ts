import type { Character } from './types'

export async function listCharacters(scriptId: string): Promise<Character[]> {
  const res = await fetch(`/api/scripts/${scriptId}/characters`)
  return res.json()
}

export async function createCharacter(
  scriptId: string,
  name: string,
  note: string,
): Promise<Character | null> {
  const res = await fetch(`/api/scripts/${scriptId}/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, note }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function updateCharacter(
  scriptId: string,
  characterId: string,
  fields: Partial<Pick<Character, 'name' | 'note'>>,
): Promise<Character | null> {
  const res = await fetch(`/api/scripts/${scriptId}/characters/${characterId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) return null
  return res.json()
}

export async function reorderCharacters(
  scriptId: string,
  characterIds: string[],
): Promise<Character[] | null> {
  const res = await fetch(`/api/scripts/${scriptId}/characters/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterIds }),
  })
  if (!res.ok) return null
  return res.json()
}
