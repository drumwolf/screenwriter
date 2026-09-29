import { useEffect, useState, type FormEvent } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import {
  checkSceneConsistency,
  createScene,
  draftScene,
  getSceneCharacters,
  listCharacters,
  listScenes,
  reorderScenes,
  setSceneCharacters,
  updateScene,
  type Character,
  type ConsistencyIssue,
  type Scene,
} from '../api'
import ExpandableTextField from '../components/ExpandableTextField'
import type { ScriptLayoutContext } from './ScriptLayout'
import './ScriptScenes.css'
import './SplitView.css'

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
  const [creatingScene, setCreatingScene] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const [linkedCharacterIds, setLinkedCharacterIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[] | null>(null)

  useEffect(() => {
    if (!id) return

    Promise.all([listScenes(id), listCharacters(id)])
      .then(([sceneData, characterData]) => {
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
    setConsistencyIssues(null)

    if (!id || !selectedScene) {
      setLinkedCharacterIds(new Set())
      return
    }

    getSceneCharacters(id, selectedScene.id).then((linked) =>
      setLinkedCharacterIds(new Set(linked.map((c) => c.id))),
    )
  }, [id, selectedScene])

  async function handleCreateScene(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id || creatingScene) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const actionContext = String(formData.get('actionContext') ?? '').trim()
    const subtext = String(formData.get('subtext') ?? '').trim()
    if (!actionContext || !subtext) return

    setCreatingScene(true)
    try {
      const scene = await createScene(id, actionContext, subtext)
      if (!scene) return

      setScenes((prev) => [...prev, scene])
      setSelection(scene.id)
      form.reset()
    } finally {
      setCreatingScene(false)
    }
  }

  async function saveField(field: 'title' | 'heading' | 'actionContext' | 'subtext' | 'draft', value: string) {
    if (!id || !selectedScene) return
    const trimmed = value.trim()
    if (!trimmed || trimmed === selectedScene[field]) return

    const updated = await updateScene(id, selectedScene.id, { [field]: trimmed })
    if (!updated) return

    setScenes((prev) => prev.map((scene) => (scene.id === updated.id ? updated : scene)))
    if (field === 'draft') setConsistencyIssues(null)
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

    await setSceneCharacters(id, selectedScene.id, [...next])
  }

  async function handleDraft() {
    if (!id || !selectedScene) return
    const sceneId = selectedScene.id
    const previousDraft = selectedScene.draft

    setDrafting(true)
    setConsistencyIssues(null)
    setScenes((prev) => prev.map((scene) => (scene.id === sceneId ? { ...scene, draft: '' } : scene)))
    try {
      const updated = await draftScene(id, sceneId)
      if (!updated) {
        setScenes((prev) =>
          prev.map((scene) => (scene.id === sceneId ? { ...scene, draft: previousDraft } : scene)),
        )
        return
      }

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

    const updated = await reorderScenes(id, reordered.map((scene) => scene.id))
    if (!updated) return

    setScenes(updated)
  }

  async function handleCheckConsistency() {
    if (!id || !selectedScene?.draft) return

    setChecking(true)
    try {
      const issues = await checkSceneConsistency(id, selectedScene.id)
      if (issues === null) return
      setConsistencyIssues(issues)
    } finally {
      setChecking(false)
    }
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
            <li key={scene.id} className="split-list-item">
              <button
                type="button"
                className={scene.id === selection ? 'split-item active' : 'split-item'}
                onClick={() => setSelection(scene.id)}
              >
                {scene.title}
              </button>
              <div className="split-reorder">
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

            <button type="submit" disabled={creatingScene}>
              {creatingScene ? 'Creating…' : 'Create Scene'}
            </button>
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

            <div className="draft-actions">
              <button type="button" onClick={handleDraft} disabled={drafting} className="draft-button">
                {drafting ? 'Drafting…' : selectedScene.draft ? 'Redraft Scene' : 'Draft Scene'}
              </button>

              {selectedScene.draft && (
                <button
                  type="button"
                  onClick={handleCheckConsistency}
                  disabled={checking}
                  className="draft-button"
                >
                  {checking ? 'Checking…' : 'Check Consistency'}
                </button>
              )}
            </div>

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
                <ExpandableTextField
                  label="Draft"
                  value={selectedScene.draft}
                  onSave={(v) => saveField('draft', v)}
                />
              </div>
            )}

            {consistencyIssues !== null && (
              <div className="scene-field">
                <h3>Consistency Check</h3>
                {consistencyIssues.length === 0 ? (
                  <p>No inconsistencies found.</p>
                ) : (
                  <ul className="consistency-issue-list">
                    {consistencyIssues.map((issue, index) => (
                      <li key={index} className="consistency-issue">
                        <strong>{issue.character}:</strong> You established "{issue.detail}" — {issue.explanation}
                      </li>
                    ))}
                  </ul>
                )}
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
