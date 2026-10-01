import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { createDocument, deleteDocument, listDocuments, type ScriptDocument } from '../api'
import type { ScriptLayoutContext } from './ScriptLayout'
import './ScriptDocuments.css'
import './SplitView.css'

const NEW_DOCUMENT = 'new' as const

function ScriptDocuments() {
  const { id } = useParams<{ id: string }>()
  const { setHeaderAction } = useOutletContext<ScriptLayoutContext>()
  const [documents, setDocuments] = useState<ScriptDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<string | typeof NEW_DOCUMENT | null>(null)

  const [nameDraft, setNameDraft] = useState('')
  const [contentDraft, setContentDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [createFailed, setCreateFailed] = useState(false)

  const selectedDocument = documents.find((d) => d.id === selection) ?? null

  useEffect(() => {
    setHeaderAction({ label: '+ Add Document', onClick: () => setSelection(NEW_DOCUMENT) })
    return () => setHeaderAction(null)
  }, [setHeaderAction])

  useEffect(() => {
    if (!id) return

    listDocuments(id)
      .then((data) => {
        setDocuments(data)
        setSelection(data.length > 0 ? data[0].id : NEW_DOCUMENT)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setContentDraft(await file.text())
    setNameDraft(file.name.replace(/\.(md|txt)$/i, ''))
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id || creating) return
    const name = nameDraft.trim()
    if (!name || !contentDraft.trim()) return

    const form = e.currentTarget
    setCreating(true)
    setCreateFailed(false)
    try {
      const document = await createDocument(id, name, contentDraft)
      if (!document) {
        setCreateFailed(true)
        return
      }

      setDocuments((prev) => [...prev, document])
      setSelection(document.id)
      setNameDraft('')
      setContentDraft('')
      form.reset()
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!id || !selectedDocument) return
    if (!window.confirm(`Remove "${selectedDocument.name}" from this script's documents?`)) return

    const ok = await deleteDocument(id, selectedDocument.id)
    if (!ok) return

    const remaining = documents.filter((d) => d.id !== selectedDocument.id)
    setDocuments(remaining)
    setSelection(remaining.length > 0 ? remaining[0].id : NEW_DOCUMENT)
  }

  if (loading) return <p className="split-main">Loading…</p>

  return (
    <div className="split-view">
      <aside className="split-sidebar">
        <ul className="split-list">
          {documents.map((document) => (
            <li key={document.id} className="split-list-item">
              <button
                type="button"
                className={document.id === selection ? 'split-item active' : 'split-item'}
                onClick={() => setSelection(document.id)}
              >
                {document.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="split-main">
        {selection === NEW_DOCUMENT && (
          <form onSubmit={handleCreate} className="new-document-form">
            <label htmlFor="file">Upload a file (.md or .txt)</label>
            <input
              id="file"
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              onChange={handleFileChosen}
            />

            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="e.g. David Morris bio"
              required
            />

            <label htmlFor="content">Content</label>
            <textarea
              id="content"
              value={contentDraft}
              onChange={(e) => setContentDraft(e.target.value)}
              placeholder="Choose a file above, or paste your notes, bios, or scenes here."
              rows={14}
              required
            />

            {createFailed && <p role="alert">Couldn't save the document. Try again.</p>}

            <button type="submit" disabled={creating}>
              {creating ? 'Saving…' : 'Save Document'}
            </button>
          </form>
        )}

        {selectedDocument && (
          <div className="document-view">
            <div className="document-view-header">
              <h3>{selectedDocument.name}</h3>
              <button type="button" className="document-delete" onClick={handleDelete}>
                Remove
              </button>
            </div>
            <p className="document-meta">
              Added {new Date(selectedDocument.createdAt).toLocaleDateString()} ·{' '}
              {selectedDocument.content.length.toLocaleString()} characters
            </p>
            <pre className="document-content">{selectedDocument.content}</pre>
          </div>
        )}
      </section>
    </div>
  )
}

export default ScriptDocuments
