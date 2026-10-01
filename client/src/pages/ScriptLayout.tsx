import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { getScript, listCharacters, type Character, type Script } from '../api'
import './ScriptLayout.css'

export interface HeaderAction {
  label: string
  onClick: () => void
}

export interface ScriptLayoutContext {
  setHeaderAction: (action: HeaderAction | null) => void
  characters: Character[]
  setCharacters: Dispatch<SetStateAction<Character[]>>
}

function ScriptLayout() {
  const { id } = useParams<{ id: string }>()
  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [headerAction, setHeaderAction] = useState<HeaderAction | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])

  useEffect(() => {
    if (!id) return

    Promise.all([getScript(id), listCharacters(id)])
      .then(([scriptData, characterData]) => {
        setScript(scriptData)
        setCharacters(characterData)
      })
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
            <NavLink to="documents" className={({ isActive }) => (isActive ? 'active' : '')}>
              Documents
            </NavLink>
          </nav>
          {headerAction && (
            <button type="button" className="header-action-button" onClick={headerAction.onClick}>
              {headerAction.label}
            </button>
          )}
        </div>
      </header>

      <Outlet context={{ setHeaderAction, characters, setCharacters } satisfies ScriptLayoutContext} />
    </div>
  )
}

export default ScriptLayout
