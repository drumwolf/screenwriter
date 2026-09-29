import type { Character, ConsistencyIssue, Scene } from './types'

export async function listScenes(scriptId: string): Promise<Scene[]> {
  const res = await fetch(`/api/scripts/${scriptId}/scenes`)
  return res.json()
}

export async function createScene(
  scriptId: string,
  actionContext: string,
  subtext: string,
): Promise<Scene | null> {
  const res = await fetch(`/api/scripts/${scriptId}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionContext, subtext }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function updateScene(
  scriptId: string,
  sceneId: string,
  fields: Partial<Pick<Scene, 'title' | 'heading' | 'actionContext' | 'subtext' | 'draft'>>,
): Promise<Scene | null> {
  const res = await fetch(`/api/scripts/${scriptId}/scenes/${sceneId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) return null
  return res.json()
}

export async function reorderScenes(scriptId: string, sceneIds: string[]): Promise<Scene[] | null> {
  const res = await fetch(`/api/scripts/${scriptId}/scenes/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneIds }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function draftScene(scriptId: string, sceneId: string): Promise<Scene | null> {
  const res = await fetch(`/api/scripts/${scriptId}/scenes/${sceneId}/draft`, {
    method: 'POST',
  })
  if (!res.ok) return null
  return res.json()
}

export async function checkSceneConsistency(
  scriptId: string,
  sceneId: string,
): Promise<ConsistencyIssue[] | null> {
  const res = await fetch(`/api/scripts/${scriptId}/scenes/${sceneId}/check-consistency`, {
    method: 'POST',
  })
  if (!res.ok) return null
  const { issues }: { issues: ConsistencyIssue[] } = await res.json()
  return issues
}

export async function getSceneCharacters(scriptId: string, sceneId: string): Promise<Character[]> {
  const res = await fetch(`/api/scripts/${scriptId}/scenes/${sceneId}/characters`)
  return res.json()
}

export async function setSceneCharacters(
  scriptId: string,
  sceneId: string,
  characterIds: string[],
): Promise<boolean> {
  const res = await fetch(`/api/scripts/${scriptId}/scenes/${sceneId}/characters`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterIds }),
  })
  return res.ok
}
