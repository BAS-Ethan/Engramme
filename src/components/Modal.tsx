import { useEffect, useRef, type ReactNode } from 'react'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] overflow-visible rounded-card border border-glass-border bg-page/75 p-5 text-fg shadow-glass glass-surface backdrop:bg-black/50"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </dialog>
  )
}
