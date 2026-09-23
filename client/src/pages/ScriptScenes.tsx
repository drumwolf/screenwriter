import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
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
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selection, setSelection] = useState<string | typeof NEW_SCENE | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [headingDraft, setHeadingDraft] = useState('')
  const [actionContextDraft, setActionContextDraft] = useState('')
  const [subtextDraft, setSubtextDraft] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const [linkedCharacterIds, setLinkedCharacterIds] = useState<Set<string>>(new Set())

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
    setTitleDraft(selectedScene?.title ?? '')
    setHeadingDraft(selectedScene?.heading ?? '')
    setActionContextDraft(selectedScene?.actionContext ?? '')
    setSubtextDraft(selectedScene?.subtext ?? '')

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

  if (loading) return <p className="split-main">Loading…</p>
  if (error) return <p className="split-main" role="alert">Couldn't load scenes.</p>

  return (
    <div className="split-view">
      <aside className="split-sidebar">
        <ul className="split-list">
          {scenes.map((scene) => (
            <li key={scene.id}>
              <button
                type="button"
                className={scene.id === selection ? 'split-item active' : 'split-item'}
                onClick={() => setSelection(scene.id)}
              >
                {scene.title}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="split-add-button"
          onClick={() => setSelection(NEW_SCENE)}
        >
          + New Scene
        </button>
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
              <textarea
                className="scene-textarea"
                value={actionContextDraft}
                onChange={(e) => setActionContextDraft(e.target.value)}
                onBlur={() => saveField('actionContext', actionContextDraft)}
                rows={3}
                aria-label="Action / context"
              />
            </div>

            <div className="scene-field">
              <h3>Subtext</h3>
              <textarea
                className="scene-textarea"
                value={subtextDraft}
                onChange={(e) => setSubtextDraft(e.target.value)}
                onBlur={() => saveField('subtext', subtextDraft)}
                rows={3}
                aria-label="Subtext"
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
                <h3>Draft</h3>
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
