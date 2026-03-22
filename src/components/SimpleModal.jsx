import { useEffect, useRef } from 'react'

export default function SimpleModal({ open, onClose, title, children }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simple-modal-title"
    >
      <div className="animate-float-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="simple-modal-title" className="text-xl font-bold text-on-surface">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="text-sm leading-relaxed text-on-surface-variant">{children}</div>
      </div>
    </div>
  )
}
