import { useRef, useState } from 'react'
import { formatDueDate, localDateString } from '../lib/dates'
import { FloatingPanel } from './FloatingPanel'
import { Icon, iconButtonClass, iconPaths } from './Icon'

type DatePickerProps = {
  label: string
  placeholder?: string
  // Date au format YYYY-MM-DD, ou '' si aucune.
  value: string
  onChange: (value: string) => void
  overdue?: boolean
  className?: string
}

const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

function parse(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Sélecteur de date aux couleurs de l'appli (le calendrier natif de <input type="date"> ne suit pas le thème).
export function DatePicker({ label, placeholder = 'Échéance', value, onChange, overdue = false, className = '' }: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => new Date())

  const today = localDateString()

  function toggle() {
    if (!open) {
      const base = value ? parse(value) : new Date()
      setMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    }
    setOpen(!open)
  }

  function pick(next: string) {
    onChange(next)
    setOpen(false)
  }

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  const shiftMonth = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={value ? `${label} : ${formatDueDate(value)}` : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className={`flex min-h-11 w-full items-center gap-2 rounded-2xl border border-glass-border bg-field px-3 text-left text-base outline-none transition focus:border-accent-text ${
          overdue ? 'text-danger' : value ? 'text-fg' : 'text-muted/70'
        }`}
      >
        <Icon d={iconPaths.calendar} className="size-4 shrink-0 text-muted" />
        <span className="truncate">{value ? formatDueDate(value) : placeholder}</span>
      </button>

      {open && (
        <FloatingPanel anchorRef={rootRef} onClose={() => setOpen(false)} className="w-72 p-3">
          <div role="dialog" aria-label={label}>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mois précédent" className={iconButtonClass}>
                <Icon d={iconPaths.prev} />
              </button>
              <span className="font-medium capitalize">{monthFormat.format(month)}</span>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Mois suivant" className={iconButtonClass}>
                <Icon d={iconPaths.next} />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted">
              {weekdays.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7">
              {days.map((d) => {
                const key = localDateString(d)
                const selected = key === value
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pick(key)}
                    aria-label={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    aria-pressed={selected}
                    className={`flex h-11 items-center justify-center rounded-xl text-sm transition active:scale-95 ${
                      selected ? 'bg-accent font-medium text-on-accent' : d.getMonth() === month.getMonth() ? '' : 'text-muted/60'
                    } ${key === today && !selected ? 'font-bold text-accent-text' : ''}`}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex justify-between">
              <button type="button" onClick={() => pick(today)} className="min-h-11 rounded-2xl px-3 text-sm text-accent-text">
                Aujourd'hui
              </button>
              {value && (
                <button type="button" onClick={() => pick('')} className="min-h-11 rounded-2xl px-3 text-sm text-danger">
                  Effacer
                </button>
              )}
            </div>
          </div>
        </FloatingPanel>
      )}
    </div>
  )
}
