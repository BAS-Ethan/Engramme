import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

type FloatingPanelProps = {
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  matchWidth?: boolean
  className?: string
  children: ReactNode
}

// Panneau en verre ancré sous un élément (menu déroulant, sélecteur de date).
// Il est rendu hors de la carte parente : un flou d'arrière-plan imbriqué dans une autre surface en verre
// ne verrait pas le reste de la page, et la carte suivante passerait par-dessus. Dans une modale, il reste
// dans le <dialog> pour rester visible (la modale occupe la couche supérieure du navigateur).
export function FloatingPanel({ anchorRef, onClose, matchWidth = false, className = '', children }: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: 0, left: 0, visibility: 'hidden' })

  useLayoutEffect(() => {
    setContainer(anchorRef.current?.closest('dialog') ?? document.body)
  }, [anchorRef])

  useLayoutEffect(() => {
    if (!container) return
    const gap = 8

    const place = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return
      const rect = anchor.getBoundingClientRect()
      let top = rect.bottom + gap
      if (top + panel.offsetHeight > window.innerHeight - gap && rect.top - gap - panel.offsetHeight > 0) {
        top = rect.top - gap - panel.offsetHeight
      }
      let left = matchWidth ? rect.left : Math.min(rect.left, window.innerWidth - panel.offsetWidth - gap)
      left = Math.max(gap, left)
      // Dans un <dialog> à fond flouté, `fixed` se repère par rapport à la modale et non à l'écran.
      if (container !== document.body) {
        const box = container.getBoundingClientRect()
        top -= box.top + container.clientTop
        left -= box.left + container.clientLeft
      }
      setStyle({ position: 'fixed', top, left, width: matchWidth ? rect.width : undefined })
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) onClose()
    }
    // Dans une modale, Échap ne doit fermer que le panneau.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [anchorRef, container, matchWidth, onClose])

  if (!container) return null

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className={`z-50 rounded-2xl border border-glass-border bg-page/60 shadow-glass glass-surface ${className}`}
    >
      {children}
    </div>,
    container,
  )
}
