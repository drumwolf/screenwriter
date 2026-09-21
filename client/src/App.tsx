import { useEffect, useState, type FormEvent } from 'react'
import './App.css'

interface Script {
  id: string
  title: string
  sceneCount: number
  lastEdited: string
}

function App() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/scripts')
      .then((res) => res.json())
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
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const script: Script = await res.json()
      setScripts((prev) => [...prev, script])
      setNewTitle('')
    } catch {
      setError(true)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main>
      <h1>Screenwriter</h1>

      {loading && <p>Loading scripts…</p>}
      {error && <p role="alert">Something went wrong talking to the server.</p>}

      {!loading && !error && scripts.length === 0 && <p>No scripts yet.</p>}

      {!loading && !error && scripts.length > 0 && (
        <ul className="script-list">
          {scripts.map((script) => (
            <li key={script.id} className="script-row">
              <span className="script-title">{script.title}</span>
              <span className="script-meta">
                {script.sceneCount} scene{script.sceneCount === 1 ? '' : 's'} ·
                edited {new Date(script.lastEdited).toLocaleDateString()}
              </span>
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

export default App
