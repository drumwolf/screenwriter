import { useEffect, useState, type FormEvent } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import {
  createCharacter,
  createEntry,
  deleteEntry as deleteEntryApi,
  listCharacters,
  listEntries,
  reorderCharacters,
  updateCharacter,
  updateEntry,
  type Character,
  type CharacterEntry,
} from '../api'
import ExpandableTextField from '../components/ExpandableTextField'
import type { ScriptLayoutContext } from './ScriptLayout'
import './ScriptCharacters.css'
import './SplitView.css'

const NEW_CHARACTER = 'new' as const

function ScriptCharacters() {
  const { id } = useParams<{ id: string }>()
  const { setHeaderAction } = useOutletContext<ScriptLayoutContext>()
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

    listCharacters(id)
      .then((data) => {
        setCharacters(data)
        setSelection(data.length > 0 ? data[0].id : NEW_CHARACTER)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const selectedCharacter = characters.find((c) => c.id === selection) ?? null

  useEffect(() => {
    setHeaderAction({ label: '+ New Character', onClick: () => setSelection(NEW_CHARACTER) })
    return () => setHeaderAction(null)
  }, [setHeaderAction])

  useEffect(() => {
    setNameDraft(selectedCharacter?.name ?? '')
    setNoteDraft(selectedCharacter?.note ?? '')
    setNewEntry('')

    if (!id || !selectedCharacter) {
      setEntries([])
      return
    }

    listEntries(id, selectedCharacter.id).then((data) => setEntries(data))
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
      const character = await createCharacter(id, name, note)
      if (!character) return

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

    const updated = await updateCharacter(id, selectedCharacter.id, { [field]: trimmed })
    if (!updated) return

    setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  async function handleAddEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id || !selectedCharacter || addingEntry) return
    const content = newEntry.trim()
    if (!content) return

    setAddingEntry(true)
    try {
      const entry = await createEntry(id, selectedCharacter.id, content)
      if (!entry) return

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

    const updated = await updateEntry(id, selectedCharacter.id, entryId, trimmed)
    if (!updated) return

    setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)))
  }

  async function deleteEntry(entryId: string) {
    if (!id || !selectedCharacter) return

    const ok = await deleteEntryApi(id, selectedCharacter.id, entryId)
    if (!ok) return

    setEntries((prev) => prev.filter((entry) => entry.id !== entryId))
  }

  async function moveCharacter(characterId: string, direction: -1 | 1) {
    if (!id) return
    const index = characters.findIndex((character) => character.id === characterId)
    const targetIndex = index + direction
    if (index === -1 || targetIndex < 0 || targetIndex >= characters.length) return

    const reordered = [...characters]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
    setCharacters(reordered)

    const updated = await reorderCharacters(id, reordered.map((character) => character.id))
    if (!updated) return

    setCharacters(updated)
  }

  if (loading) return <p className="split-main">Loading…</p>
  if (error) return <p className="split-main" role="alert">Couldn't load characters.</p>

  return (
    <div className="split-view">
      <aside className="split-sidebar">
        <ul className="split-list">
          {characters.map((character, index) => (
            <li key={character.id} className="split-list-item">
              <button
                type="button"
                className={character.id === selection ? 'split-item active' : 'split-item'}
                onClick={() => setSelection(character.id)}
              >
                {character.name}
              </button>
              <div className="split-reorder">
                <button
                  type="button"
                  onClick={() => moveCharacter(character.id, -1)}
                  disabled={index === 0}
                  aria-label="Move character up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveCharacter(character.id, 1)}
                  disabled={index === characters.length - 1}
                  aria-label="Move character down"
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
