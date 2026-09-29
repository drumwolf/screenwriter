import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createScript, deleteScript, listScripts, type Script } from '../api'
import '../App.css'

function ProjectList() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    listScripts()
      .then((data) => setScripts(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return

    setCreating(true)
    try {
      const script = await createScript(title)
      setScripts((prev) => [...prev, script])
      setNewTitle('')
    } catch {
      setError(true)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(script: Script) {
    const confirmed = window.confirm(
      `Delete "${script.title}"? This will permanently delete all its scenes and characters too. This can't be undone.`,
    )
    if (!confirmed) return

    const ok = await deleteScript(script.id)
    if (!ok) return

    setScripts((prev) => prev.filter((s) => s.id !== script.id))
  }

  return (
    <main className="page-narrow">
      <h1>Screenwriter</h1>

      {loading && <p>Loading scripts…</p>}
      {error && <p role="alert">Something went wrong talking to the server.</p>}

      {!loading && !error && scripts.length === 0 && <p>No scripts yet.</p>}

      {!loading && !error && scripts.length > 0 && (
        <ul className="script-list">
          {scripts.map((script) => (
            <li key={script.id} className="script-row">
              <Link to={`/scripts/${script.id}`} className="script-link">
                <span className="script-title">{script.title}</span>
                <span className="script-meta">
                  {script.sceneCount} scene{script.sceneCount === 1 ? '' : 's'} ·
                  edited {new Date(script.lastEdited).toLocaleDateString()}
                </span>
              </Link>
              <button
                type="button"
                className="script-delete"
                onClick={() => handleDelete(script)}
                aria-label={`Delete ${script.title}`}
                title="Delete script"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="new-script-form">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New script title"
          aria-label="New script title"
        />
        <button type="submit" disabled={creating || newTitle.trim() === ''}>
          + New Script
        </button>
      </form>
    </main>
  )
}

export default ProjectList
