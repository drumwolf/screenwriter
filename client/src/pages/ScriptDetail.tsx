import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import './ScriptDetail.css'

interface Script {
  id: string
  title: string
  sceneCount: number
  lastEdited: string
}

interface Scene {
  id: string
  scriptId: string
  heading: string
  title: string
  actionContext: string
  subtext: string
  createdAt: string
}

const NEW_SCENE = 'new' as const

function ScriptDetail() {
  const { id } = useParams<{ id: string }>()
  const [script, setScript] = useState<Script | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selection, setSelection] = useState<string | typeof NEW_SCENE | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [headingDraft, setHeadingDraft] = useState('')

  useEffect(() => {
    if (!id) return

    Promise.all([
      fetch(`/api/scripts/${id}`).then((res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      }),
      fetch(`/api/scripts/${id}/scenes`).then((res) => res.json()),
    ])
      .then(([scriptData, sceneData]: [Script, Scene[]]) => {
        setScript(scriptData)
        setScenes(sceneData)
        setSelection(sceneData.length > 0 ? sceneData[0].id : NEW_SCENE)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const selectedScene = scenes.find((scene) => scene.id === selection) ?? null

  useEffect(() => {
    setTitleDraft(selectedScene?.title ?? '')
    setHeadingDraft(selectedScene?.heading ?? '')
  }, [selectedScene])

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

  async function saveField(field: 'title' | 'heading', value: string) {
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

  if (loading) return <p className="page-narrow">Loading…</p>
  if (error || !script) return <p className="page-narrow" role="alert">Couldn't load this script.</p>

  return (
    <main className="script-detail">
      <aside className="scene-sidebar">
        <Link to="/" className="back-link">
          ← All Scripts
        </Link>
        <h2>{script.title}</h2>

        <ul className="scene-list">
          {scenes.map((scene) => (
            <li key={scene.id}>
              <button
                type="button"
                className={scene.id === selection ? 'scene-item active' : 'scene-item'}
                onClick={() => setSelection(scene.id)}
              >
                {scene.title}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="new-scene-button"
          onClick={() => setSelection(NEW_SCENE)}
        >
          + New Scene
        </button>
      </aside>

      <section className="scene-main">
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
              <p>{selectedScene.actionContext}</p>
            </div>

            <div className="scene-field">
              <h3>Subtext</h3>
              <p>{selectedScene.subtext}</p>
            </div>
          </div>
        )}

        {!selectedScene && selection !== NEW_SCENE && (
          <p>No scenes yet. Use "+ New Scene" to start one.</p>
        )}
      </section>
    </main>
  )
}

export default ScriptDetail
