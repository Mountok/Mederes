import { useEffect } from 'react'
import { FiX } from 'react-icons/fi'
import Button from './Button.jsx'

function Modal({ open, title, description, children, onClose }) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <div className="modal-copy">
            <h3>{title}</h3>
            {description ? <p className="helper-copy">{description}</p> : null}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Закрыть окно">
            <FiX />
          </Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export default Modal
