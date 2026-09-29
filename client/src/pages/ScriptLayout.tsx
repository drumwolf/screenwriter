import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { getScript, type Script } from '../api'
import './ScriptLayout.css'

export interface HeaderAction {
  label: string
  onClick: () => void
}

export interface ScriptLayoutContext {
  setHeaderAction: (action: HeaderAction | null) => void
}

function ScriptLayout() {
  const { id } = useParams<{ id: string }>()
  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [headerAction, setHeaderAction] = useState<HeaderAction | null>(null)

  useEffect(() => {
    if (!id) return

    getScript(id)
      .then((data) => setScript(data))
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
        <div className="script-tabs-row">
          <nav className="script-tabs">
            <NavLink to="scenes" className={({ isActive }) => (isActive ? 'active' : '')}>
              Scenes
            </NavLink>
            <NavLink to="characters" className={({ isActive }) => (isActive ? 'active' : '')}>
              Characters
            </NavLink>
          </nav>
          {headerAction && (
            <button type="button" className="header-action-button" onClick={headerAction.onClick}>
              {headerAction.label}
            </button>
          )}
        </div>
      </header>

      <Outlet context={{ setHeaderAction } satisfies ScriptLayoutContext} />
    </div>
  )
}

export default ScriptLayout
