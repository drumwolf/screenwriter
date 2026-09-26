import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import ExpandableTextField from '../components/ExpandableTextField'
import './ScriptCharacters.css'
import './SplitView.css'

interface Character {
  id: string
  scriptId: string
  name: string
  note: string
  createdAt: string
}

interface CharacterEntry {
  id: string
  characterId: string
  content: string
  source: 'manual' | 'auto'
  createdAt: string
}

const NEW_CHARACTER = 'new' as const

function ScriptCharacters() {
  const { id } = useParams<{ id: string }>()
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selection, setSelection] = useState<string | typeof NEW_CHARACTER | null>(null)

  const [entries, setEntries] = useState<CharacterEntry[]>([])
  const [nameDraft, setNameDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [newEntry, setNewEntry] = useState('')
  const [creatingCharacter, setCreatingCharacter] = useState(false)
  const [addingEntry, setAddingEntry] = useState(false)

  useEffect(() => {
    if (!id) return

    fetch(`/api/scripts/${id}/characters`)
      .then((res) => res.json())
      .then((data: Character[]) => {
        setCharacters(data)
        setSelection(data.length > 0 ? data[0].id : NEW_CHARACTER)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const selectedCharacter = characters.find((c) => c.id === selection) ?? null

  useEffect(() => {
    setNameDraft(selectedCharacter?.name ?? '')
    setNoteDraft(selectedCharacter?.note ?? '')
    setNewEntry('')

    if (!id || !selectedCharacter) {
      setEntries([])
      return
    }

    fetch(`/api/scripts/${id}/characters/${selectedCharacter.id}/entries`)
      .then((res) => res.json())
      .then((data: CharacterEntry[]) => setEntries(data))
  }, [id, selectedCharacter])

  async function handleCreateCharacter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id || creatingCharacter) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const name = String(formData.get('name') ?? '').trim()
    const note = String(formData.get('note') ?? '').trim()
    if (!name) return

    setCreatingCharacter(true)
    try {
      const res = await fetch(`/api/scripts/${id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, note }),
      })
      if (!res.ok) return

      const character: Character = await res.json()
      setCharacters((prev) => [...prev, character])
      setSelection(character.id)
      form.reset()
    } finally {
      setCreatingCharacter(false)
    }
  }

  async function saveField(field: 'name' | 'note', value: string) {
    if (!id || !selectedCharacter) return
    const trimmed = value.trim()
    if (field === 'name' && !trimmed) return
    if (trimmed === selectedCharacter[field]) return

    const res = await fetch(`/api/scripts/${id}/characters/${selectedCharacter.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: trimmed }),
    })
    if (!res.ok) return

    const updated: Character = await res.json()
    setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  async function handleAddEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id || !selectedCharacter || addingEntry) return
    const content = newEntry.trim()
    if (!content) return

    setAddingEntry(true)
    try {
      const res = await fetch(`/api/scripts/${id}/characters/${selectedCharacter.id}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) return

      const entry: CharacterEntry = await res.json()
      setEntries((prev) => [...prev, entry])
      setNewEntry('')
    } finally {
      setAddingEntry(false)
    }
  }

  async function saveEntry(entryId: string, content: string) {
    if (!id || !selectedCharacter) return
    const original = entries.find((entry) => entry.id === entryId)
    const trimmed = content.trim()
    if (!original || !trimmed || trimmed === original.content) return

    const res = await fetch(
      `/api/scripts/${id}/characters/${selectedCharacter.id}/entries/${entryId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      },
    )
    if (!res.ok) return

    const updated: CharacterEntry = await res.json()
    setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)))
  }

  async function deleteEntry(entryId: string) {
    if (!id || !selectedCharacter) return

    const res = await fetch(
      `/api/scripts/${id}/characters/${selectedCharacter.id}/entries/${entryId}`,
      { method: 'DELETE' },
    )
    if (!res.ok) return

    setEntries((prev) => prev.filter((entry) => entry.id !== entryId))
  }

  if (loading) return <p className="split-main">Loading…</p>
  if (error) return <p className="split-main" role="alert">Couldn't load characters.</p>

  return (
    <div className="split-view">
      <aside className="split-sidebar">
        <ul className="split-list">
          {characters.map((character) => (
            <li key={character.id}>
              <button
                type="button"
                className={character.id === selection ? 'split-item active' : 'split-item'}
                onClick={() => setSelection(character.id)}
              >
                {character.name}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="split-add-button"
          onClick={() => setSelection(NEW_CHARACTER)}
        >
          + New Character
        </button>
      </aside>

      <section className="split-main">
        {selection === NEW_CHARACTER && (
          <form onSubmit={handleCreateCharacter} className="new-character-form">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" placeholder="Character name" required />

            <label htmlFor="note">Note (optional)</label>
            <input id="note" name="note" placeholder="A one-line broad note, if you have one" />

            <button type="submit" disabled={creatingCharacter}>
              {creatingCharacter ? 'Creating…' : 'Create Character'}
            </button>
          </form>
        )}

        {selectedCharacter && (
          <div className="character-view">
            <input
              className="character-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => saveField('name', nameDraft)}
              aria-label="Character name"
            />

            <input
              className="character-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => saveField('note', noteDraft)}
              placeholder="A one-line broad note"
              aria-label="Character note"
            />

            <h3>Notebook</h3>
            <ul className="entry-list">
              {entries.map((entry) => (
                <li key={entry.id} className="entry-item">
                  <ExpandableTextField
                    label="Notebook entry"
                    value={entry.content}
                    onSave={(v) => saveEntry(entry.id, v)}
                  />
                  <button
                    type="button"
                    className="entry-delete"
                    onClick={() => deleteEntry(entry.id)}
                    aria-label="Delete entry"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddEntry} className="new-entry-form">
              <textarea
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                placeholder="Add a detail or anecdote…"
                rows={2}
              />
              <button type="submit" disabled={addingEntry}>
                {addingEntry ? 'Adding…' : 'Add'}
              </button>
            </form>
          </div>
        )}

        {!selectedCharacter && selection !== NEW_CHARACTER && (
          <p>No characters yet. Use "+ New Character" to start one.</p>
        )}
      </section>
    </div>
  )
}

export default ScriptCharacters
