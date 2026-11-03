import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { FloatingPanel } from './FloatingPanel'
import { Icon } from './Icon'

type Option = { value: string; label: string }

type SelectProps = {
  label: string
  icon?: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  className?: string
}

// Menu déroulant aux couleurs de l'appli (le <select> natif ouvre une liste système qui ne suit pas le thème).
export function Select({ label, icon, value, options, onChange, className = '' }: SelectProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const [active, setActive] = useState(selectedIndex)

  function show() {
    setActive(selectedIndex)
    setOpen(true)
  }

  function choose(index: number) {
    onChange(options[index].value)
    setOpen(false)
  }

  function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        if (!open) return show()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setActive((i) => (i + step + options.length) % options.length)
        break
      }
      case 'Home':
      case 'End':
        if (!open) return
        e.preventDefault()
        setActive(e.key === 'Home' ? 0 : options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) choose(active)
        else show()
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-glass-border bg-field px-4 text-left text-base text-fg outline-none transition focus:border-accent-text"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <Icon d={icon} className="size-4 shrink-0 text-muted" />}
          <span className="truncate">{options[selectedIndex]?.label}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`size-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <FloatingPanel anchorRef={rootRef} onClose={() => setOpen(false)} matchWidth className="p-1">
          <ul id={`${id}-list`} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto">
            {options.map((option, i) => (
              <li
                key={option.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={option.value === value}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 ${
                  i === active ? 'bg-field' : ''
                } ${option.value === value ? 'font-medium text-accent-text' : ''}`}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && (
                  <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        </FloatingPanel>
      )}
    </div>
  )
}
