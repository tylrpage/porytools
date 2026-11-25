import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A modal dialog (native `<dialog>`): closes with its ✕ button, Escape, or a tap on the
 * backdrop. Dialogs opened from a dialog stack on top of it.
 */
export default function Dialog({
  label,
  className,
  onClose,
  children,
}: {
  label: string
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const d = ref.current!
    // jsdom has no showModal.
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
    const onCancel = (e: Event) => {
      e.preventDefault()
      close.current()
    }
    // A click on the dialog element itself, outside its content box, is on the backdrop.
    const onClick = (e: MouseEvent) => {
      if (e.target !== d) return
      const r = d.getBoundingClientRect()
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      if (!inside) close.current()
    }
    d.addEventListener('cancel', onCancel)
    d.addEventListener('click', onClick)
    // No close() on unmount: removing a modal dialog takes it out of the top layer, and a
    // late `close` event would close whatever is shown next.
    return () => {
      d.removeEventListener('cancel', onCancel)
      d.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <dialog ref={ref} className={className ? `dialog ${className}` : 'dialog'} aria-label={label}>
      <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      {children}
    </dialog>
  )
}
