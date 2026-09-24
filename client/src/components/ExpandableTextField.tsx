import { useCallback, useEffect, useState } from 'react'
import './ExpandableTextField.css'

interface ExpandableTextFieldProps {
  label: string
  value: string
  placeholder?: string
  onSave: (value: string) => void
}

function ExpandableTextField({ label, value, placeholder, onSave }: ExpandableTextFieldProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  function openModal() {
    setDraft(value)
    setOpen(true)
  }

  const close = useCallback(() => {
    onSave(draft)
    setOpen(false)
  }, [draft, onSave])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, close])

  return (
    <>
      <button type="button" className="expandable-preview" onClick={openModal}>
        {value ? (
          <span className="expandable-preview-text">{value}</span>
        ) : (
          <span className="expandable-preview-placeholder">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="expandable-backdrop" onClick={close}>
          <div
            className="expandable-modal"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="expandable-modal-header">
              <h3>{label}</h3>
              <button type="button" className="expandable-close" onClick={close} aria-label="Close">
                ×
              </button>
            </div>
            <textarea
              className="expandable-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </div>
        </div>
      )}
    </>
  )
}

export default ExpandableTextField
