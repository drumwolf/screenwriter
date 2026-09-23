import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import './ScriptLayout.css'

interface Script {
  id: string
  title: string
  sceneCount: number
  lastEdited: string
}

function ScriptLayout() {
  const { id } = useParams<{ id: string }>()
  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return

    fetch(`/api/scripts/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then((data: Script) => setScript(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="page-narrow">Loading…</p>
  if (error || !script) return <p className="page-narrow" role="alert">Couldn't load this script.</p>

  return (
    <div className="script-page">
      <header className="script-page-header">
        <Link to="/" className="back-link">
          ← All Scripts
        </Link>
        <h2>{script.title}</h2>
        <nav className="script-tabs">
          <NavLink to="scenes" className={({ isActive }) => (isActive ? 'active' : '')}>
            Scenes
          </NavLink>
          <NavLink to="characters" className={({ isActive }) => (isActive ? 'active' : '')}>
            Characters
          </NavLink>
        </nav>
      </header>

      <Outlet />
    </div>
  )
}

export default ScriptLayout
