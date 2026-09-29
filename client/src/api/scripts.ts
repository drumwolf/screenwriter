import type { Script } from './types'

export async function listScripts(): Promise<Script[]> {
  const res = await fetch('/api/scripts')
  return res.json()
}

export async function getScript(scriptId: string): Promise<Script> {
  const res = await fetch(`/api/scripts/${scriptId}`)
  if (!res.ok) throw new Error('script not found')
  return res.json()
}

export async function createScript(title: string): Promise<Script> {
  const res = await fetch('/api/scripts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return res.json()
}

export async function deleteScript(scriptId: string): Promise<boolean> {
  const res = await fetch(`/api/scripts/${scriptId}`, { method: 'DELETE' })
  return res.ok
}
