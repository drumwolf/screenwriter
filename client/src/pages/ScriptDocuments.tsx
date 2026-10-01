import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import {
  createCharacter,
  createDocument,
  createEntry,
  deleteDocument,
  listDocuments,
  proposeCharacters,
  type CharacterProposal,
  type ScriptDocument,
} from '../api'
import type { ScriptLayoutContext } from './ScriptLayout'
import './ScriptDocuments.css'
import './SplitView.css'

const NEW_DOCUMENT = 'new' as const

interface ProposalRun {
  documentId: string
  proposals: CharacterProposal[]
  dropped: number
}

function ScriptDocuments() {
  const { id } = useParams<{ id: string }>()
  const { setHeaderAction, setCharacters } = useOutletContext<ScriptLayoutContext>()
  const [documents, setDocuments] = useState<ScriptDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<string | typeof NEW_DOCUMENT | null>(null)

  const [nameDraft, setNameDraft] = useState('')
  const [contentDraft, setContentDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [createFailed, setCreateFailed] = useState(false)

  const [proposalRun, setProposalRun] = useState<ProposalRun | null>(null)
  const [proposingFor, setProposingFor] = useState<string | null>(null)
  const [proposeFailed, setProposeFailed] = useState(false)
  const [accepting, setAccepting] = useState(false)

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

  async function handleProposeCharacters() {
    if (!id || !selectedDocument || proposingFor) return

    const documentId = selectedDocument.id
    setProposingFor(documentId)
    setProposeFailed(false)
    try {
      const result = await proposeCharacters(id, documentId)
      if (!result) {
        setProposeFailed(true)
        return
      }
      setProposalRun({ documentId, ...result })
    } finally {
      setProposingFor(null)
    }
  }

  function removePassages(name: string, passages: string[]) {
    setProposalRun((prev) => {
      if (!prev) return prev
      const proposals = prev.proposals
        .map((p) => (p.name === name ? { ...p, passages: p.passages.filter((x) => !passages.includes(x)) } : p))
        .filter((p) => p.passages.length > 0)
      return { ...prev, proposals }
    })
  }

  async function acceptPassages(proposal: CharacterProposal, passages: string[]) {
    if (!id || accepting) return

    setAccepting(true)
    try {
      let characterId = proposal.characterId
      if (!characterId) {
        const character = await createCharacter(id, proposal.name, proposal.note)
        if (!character) return
        characterId = character.id
        setCharacters((prev) => [...prev, character])
        // Later accepts for this character add to the one just created.
        setProposalRun((prev) =>
          prev && {
            ...prev,
            proposals: prev.proposals.map((p) =>
              p.name === proposal.name ? { ...p, characterId: character.id, note: '' } : p,
            ),
          },
        )
      }

      const saved: string[] = []
      for (const passage of passages) {
        const entry = await createEntry(id, characterId, passage)
        if (!entry) break
        saved.push(passage)
      }
      removePassages(proposal.name, saved)
    } finally {
      setAccepting(false)
    }
  }

  const visibleRun = proposalRun && proposalRun.documentId === selectedDocument?.id ? proposalRun : null

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
              <div className="document-actions">
                <button
                  type="button"
                  className="document-propose"
                  onClick={handleProposeCharacters}
                  disabled={proposingFor !== null}
                >
                  {proposingFor === selectedDocument.id ? 'Reading document…' : 'Find Character Details'}
                </button>
                <button type="button" className="document-delete" onClick={handleDelete}>
                  Remove
                </button>
              </div>
            </div>
            <p className="document-meta">
              Added {new Date(selectedDocument.createdAt).toLocaleDateString()} ·{' '}
              {selectedDocument.content.length.toLocaleString()} characters
            </p>
            {proposingFor === selectedDocument.id && (
              <p className="document-meta">This can take a minute or two for a long document.</p>
            )}
            {proposeFailed && <p role="alert">Couldn't read the document for character details. Try again.</p>}

            {visibleRun && (
              <section className="proposals">
                <h4>Proposed character details</h4>
                {visibleRun.proposals.length === 0 && <p className="document-meta">Nothing left to review.</p>}
                {visibleRun.dropped > 0 && (
                  <p className="document-meta">
                    {visibleRun.dropped} passage{visibleRun.dropped === 1 ? ' was' : 's were'} left out: already in
                    the notebook, repeated, or not found word for word in the document.
                  </p>
                )}

                {visibleRun.proposals.map((proposal) => (
                  <div key={proposal.name} className="proposal">
                    <div className="proposal-header">
                      <div>
                        <strong>{proposal.name}</strong>
                        <span className="proposal-badge">
                          {proposal.characterId ? 'Existing character' : 'New character'}
                        </span>
                        {!proposal.characterId && proposal.note && (
                          <p className="document-meta">{proposal.note}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => acceptPassages(proposal, proposal.passages)}
                        disabled={accepting}
                      >
                        Accept all ({proposal.passages.length})
                      </button>
                    </div>

                    <ul className="proposal-passages">
                      {proposal.passages.map((passage) => (
                        <li key={passage}>
                          <pre className="proposal-passage">{passage}</pre>
                          <div className="proposal-passage-actions">
                            <button
                              type="button"
                              onClick={() => acceptPassages(proposal, [passage])}
                              disabled={accepting}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="proposal-reject"
                              onClick={() => removePassages(proposal.name, [passage])}
                            >
                              Reject
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            <pre className="document-content">{selectedDocument.content}</pre>
          </div>
        )}
      </section>
    </div>
  )
}

export default ScriptDocuments
