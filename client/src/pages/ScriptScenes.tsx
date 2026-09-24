import { useEffect, useState, type FormEvent } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import ExpandableTextField from '../components/ExpandableTextField'
import type { ScriptLayoutContext } from './ScriptLayout'
import './ScriptScenes.css'
import './SplitView.css'

interface Scene {
  id: string
  scriptId: string
  heading: string
  title: string
  actionContext: string
  subtext: string
  draft: string
  orderIndex: number
  createdAt: string
}

interface Character {
  id: string
  scriptId: string
  name: string
  note: string
  createdAt: string
}

const NEW_SCENE = 'new' as const

function ScriptScenes() {
  const { id } = useParams<{ id: string }>()
  const { setHeaderAction } = useOutletContext<ScriptLayoutContext>()
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selection, setSelection] = useState<string | typeof NEW_SCENE | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [headingDraft, setHeadingDraft] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const [linkedCharacterIds, setLinkedCharacterIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return

    Promise.all([
      fetch(`/api/scripts/${id}/scenes`).then((res) => res.json()),
      fetch(`/api/scripts/${id}/characters`).then((res) => res.json()),
    ])
      .then(([sceneData, characterData]: [Scene[], Character[]]) => {
        setScenes(sceneData)
        setCharacters(characterData)
        setSelection(sceneData.length > 0 ? sceneData[0].id : NEW_SCENE)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const selectedScene = scenes.find((scene) => scene.id === selection) ?? null

  useEffect(() => {
    setHeaderAction({ label: '+ New Scene', onClick: () => setSelection(NEW_SCENE) })
    return () => setHeaderAction(null)
  }, [setHeaderAction])

  useEffect(() => {
    setTitleDraft(selectedScene?.title ?? '')
    setHeadingDraft(selectedScene?.heading ?? '')

    if (!id || !selectedScene) {
      setLinkedCharacterIds(new Set())
      return
    }

    fetch(`/api/scripts/${id}/scenes/${selectedScene.id}/characters`)
      .then((res) => res.json())
      .then((linked: Character[]) => setLinkedCharacterIds(new Set(linked.map((c) => c.id))))
  }, [id, selectedScene])

  async function handleCreateScene(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const actionContext = String(formData.get('actionContext') ?? '').trim()
    const subtext = String(formData.get('subtext') ?? '').trim()
    if (!actionContext || !subtext) return

    const res = await fetch(`/api/scripts/${id}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionContext, subtext }),
    })
    if (!res.ok) return

    const scene: Scene = await res.json()
    setScenes((prev) => [...prev, scene])
    setSelection(scene.id)
    form.reset()
  }

  async function saveField(field: 'title' | 'heading' | 'actionContext' | 'subtext', value: string) {
    if (!id || !selectedScene) return
    const trimmed = value.trim()
    if (!trimmed || trimmed === selectedScene[field]) return

    const res = await fetch(`/api/scripts/${id}/scenes/${selectedScene.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: trimmed }),
    })
    if (!res.ok) return

    const updated: Scene = await res.json()
    setScenes((prev) => prev.map((scene) => (scene.id === updated.id ? updated : scene)))
  }

  async function toggleCharacter(characterId: string) {
    if (!id || !selectedScene) return

    const next = new Set(linkedCharacterIds)
    if (next.has(characterId)) {
      next.delete(characterId)
    } else {
      next.add(characterId)
    }
    setLinkedCharacterIds(next)

    await fetch(`/api/scripts/${id}/scenes/${selectedScene.id}/characters`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterIds: [...next] }),
    })
  }

  async function handleDraft() {
    if (!id || !selectedScene) return
    const sceneId = selectedScene.id
    const previousDraft = selectedScene.draft

    setDrafting(true)
    setScenes((prev) => prev.map((scene) => (scene.id === sceneId ? { ...scene, draft: '' } : scene)))
    try {
      const res = await fetch(`/api/scripts/${id}/scenes/${sceneId}/draft`, {
        method: 'POST',
      })
      if (!res.ok) {
        setScenes((prev) =>
          prev.map((scene) => (scene.id === sceneId ? { ...scene, draft: previousDraft } : scene)),
        )
        return
      }

      const updated: Scene = await res.json()
      setScenes((prev) => prev.map((scene) => (scene.id === updated.id ? updated : scene)))
    } finally {
      setDrafting(false)
    }
  }

  async function moveScene(sceneId: string, direction: -1 | 1) {
    if (!id) return
    const index = scenes.findIndex((scene) => scene.id === sceneId)
    const targetIndex = index + direction
    if (index === -1 || targetIndex < 0 || targetIndex >= scenes.length) return

    const reordered = [...scenes]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
    setScenes(reordered)

    const res = await fetch(`/api/scripts/${id}/scenes/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneIds: reordered.map((scene) => scene.id) }),
    })
    if (!res.ok) return

    const updated: Scene[] = await res.json()
    setScenes(updated)
  }

  async function handleCopyDraft() {
    if (!selectedScene?.draft) return
    await navigator.clipboard.writeText(selectedScene.draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <p className="split-main">Loading…</p>
  if (error) return <p className="split-main" role="alert">Couldn't load scenes.</p>

  return (
    <div className="split-view">
      <aside className="split-sidebar">
        <ul className="split-list">
          {scenes.map((scene, index) => (
            <li key={scene.id} className="scene-list-item">
              <button
                type="button"
                className={scene.id === selection ? 'split-item active' : 'split-item'}
                onClick={() => setSelection(scene.id)}
              >
                {scene.title}
              </button>
              <div className="scene-reorder">
                <button
                  type="button"
                  onClick={() => moveScene(scene.id, -1)}
                  disabled={index === 0}
                  aria-label="Move scene up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveScene(scene.id, 1)}
                  disabled={index === scenes.length - 1}
                  aria-label="Move scene down"
                  title="Move down"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className="split-main">
        {selection === NEW_SCENE && (
          <form onSubmit={handleCreateScene} className="new-scene-form">
            <label htmlFor="actionContext">Action / context</label>
            <textarea
              id="actionContext"
              name="actionContext"
              placeholder="What's physically happening in this scene?"
              rows={3}
              required
            />

            <label htmlFor="subtext">Subtext</label>
            <textarea
              id="subtext"
              name="subtext"
              placeholder="What's really going on underneath, unspoken?"
              rows={3}
              required
            />

            <button type="submit">Create Scene</button>
          </form>
        )}

        {selectedScene && (
          <div className="scene-view">
            <input
              className="scene-title"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => saveField('title', titleDraft)}
              aria-label="Scene title"
            />

            <input
              className="scene-heading"
              value={headingDraft}
              onChange={(e) => setHeadingDraft(e.target.value)}
              onBlur={() => saveField('heading', headingDraft)}
              aria-label="Scene heading"
            />

            <div className="scene-field">
              <h3>Action / context</h3>
              <ExpandableTextField
                label="Action / context"
                value={selectedScene.actionContext}
                placeholder="What's physically happening in this scene?"
                onSave={(v) => saveField('actionContext', v)}
              />
            </div>

            <div className="scene-field">
              <h3>Subtext</h3>
              <ExpandableTextField
                label="Subtext"
                value={selectedScene.subtext}
                placeholder="What's really going on underneath, unspoken?"
                onSave={(v) => saveField('subtext', v)}
              />
            </div>

            <div className="scene-field">
              <h3>Characters in this scene</h3>
              {characters.length === 0 && <p>No characters yet — add some on the Characters tab.</p>}
              <ul className="character-checklist">
                {characters.map((character) => (
                  <li key={character.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={linkedCharacterIds.has(character.id)}
                        onChange={() => toggleCharacter(character.id)}
                      />
                      {character.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <button type="button" onClick={handleDraft} disabled={drafting} className="draft-button">
              {drafting ? 'Drafting…' : selectedScene.draft ? 'Redraft Scene' : 'Draft Scene'}
            </button>

            {selectedScene.draft && (
              <div className="scene-field">
                <div className="scene-field-header">
                  <h3>Draft</h3>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={handleCopyDraft}
                    aria-label="Copy draft to clipboard"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="scene-draft">{selectedScene.draft}</p>
              </div>
            )}
          </div>
        )}

        {!selectedScene && selection !== NEW_SCENE && (
          <p>No scenes yet. Use "+ New Scene" to start one.</p>
        )}
      </section>
    </div>
  )
}

export default ScriptScenes
