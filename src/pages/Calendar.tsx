import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import { Icon, iconButtonClass, iconOutlineClass, iconPaths, iconPrimaryClass } from '../components/Icon'
import { Modal } from '../components/Modal'
import { fetchFeed, parseIcs, type CalendarEvent } from '../lib/calendar'
import type { CalendarSource } from '../lib/database.types'
import { supabase } from '../lib/supabase'

const inputClass =
  'min-h-11 w-full rounded-2xl border border-glass-border bg-field px-4 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent-text'
const buttonClass =
  'min-h-11 shrink-0 rounded-2xl bg-accent px-4 font-medium text-on-accent transition active:scale-[0.98]'
const ghostButtonClass = 'min-h-11 shrink-0 rounded-2xl border border-glass-border bg-field px-4 text-sm'

const HOUR_PX = 56
const hours = Array.from({ length: 24 }, (_, h) => h)
const MIN_VISIBLE_MINUTES = 30
const weekdays = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// Grille de 6 semaines (lundi en premier) qui contient le mois affiché.
function gridStart(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  return addDays(first, -((first.getDay() + 6) % 7))
}

type PlacedEvent = { event: CalendarEvent; start: number; end: number; column: number; columns: number }

// Place les événements horaires d'un jour sur la grille ; ceux qui se chevauchent se partagent la largeur.
function layoutDay(events: CalendarEvent[], day: Date): PlacedEvent[] {
  const dayStart = day.getTime()
  const toMinutes = (t: number) => Math.min(1440, Math.max(0, (t - dayStart) / 60_000))
  const items = events
    .filter((e) => !e.allDay)
    .map((event) => {
      const start = toMinutes(event.start.getTime())
      return { event, start, end: Math.max(toMinutes(event.end.getTime()), start + MIN_VISIBLE_MINUTES) }
    })
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const placed: (PlacedEvent & { clusterId: number })[] = []
  const clusterColumns: number[] = []
  let columnEnds: number[] = []
  let clusterEnd = -1
  let clusterId = -1
  for (const { event, start, end } of items) {
    if (start >= clusterEnd) {
      clusterId++
      columnEnds = []
    }
    clusterEnd = Math.max(clusterEnd, end)
    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start)
    if (column === -1) column = columnEnds.length
    columnEnds[column] = end
    clusterColumns[clusterId] = columnEnds.length
    placed.push({
      event,
      start,
      end,
      column,
      columns: 0,
      clusterId,
    })
  }
  return placed.map((p) => ({ ...p, columns: clusterColumns[p.clusterId] }))
}

export default function Calendar() {
  const [sources, setSources] = useState<CalendarSource[] | null>(null)
  const [feeds, setFeeds] = useState<Record<string, string>>({})
  const [feedErrors, setFeedErrors] = useState<Record<string, string>>({})
  const [loadingFeeds, setLoadingFeeds] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [managing, setManaging] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState('#fed766')

  const loadFeed = useCallback(async (id: string) => {
    const result = await fetchFeed(id)
    if ('error' in result) {
      setFeedErrors((prev) => ({ ...prev, [id]: result.error }))
    } else {
      setFeeds((prev) => ({ ...prev, [id]: result.text }))
      setFeedErrors(({ [id]: _removed, ...rest }) => rest)
    }
  }, [])

  const loadAll = useCallback(
    async (list: CalendarSource[]) => {
      setLoadingFeeds(true)
      await Promise.all(list.map((s) => loadFeed(s.id)))
      setLoadingFeeds(false)
    },
    [loadFeed],
  )

  useEffect(() => {
    let cancelled = false
    supabase
      .from('calendar_sources')
      .select('*')
      .order('created_at')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) return setError(error.message)
        setSources(data)
        void loadAll(data)
      })
    return () => {
      cancelled = true
    }
  }, [loadAll])

  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart(month), i)), [month])

  const eventsByDay = useMemo(() => {
    const from = days[0]
    const to = addDays(days[41], 1)
    const byDay = new Map<string, CalendarEvent[]>()
    for (const [sourceId, text] of Object.entries(feeds)) {
      let events: CalendarEvent[]
      try {
        events = parseIcs(sourceId, text, from, to)
      } catch {
        continue
      }
      for (const event of events) {
        // Un événement multi-jours apparaît chaque jour ; la fin d'un « toute la journée » est exclusive.
        const last = startOfDay(new Date(event.end.getTime() - (event.end > event.start ? 1 : 0)))
        for (let d = startOfDay(event.start); d <= last; d = addDays(d, 1)) {
          const list = byDay.get(dayKey(d)) ?? []
          list.push(event)
          byDay.set(dayKey(d), list)
        }
      }
    }
    for (const list of byDay.values()) {
      list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
    }
    return byDay
  }, [days, feeds])

  const colorOf = (sourceId: string) => sources?.find((s) => s.id === sourceId)?.color ?? '#999999'
  const selectedEvents = useMemo(() => eventsByDay.get(dayKey(selected)) ?? [], [eventsByDay, selected])
  const allDayEvents = selectedEvents.filter((e) => e.allDay)
  const placed = useMemo(() => layoutDay(selectedEvents, selected), [selectedEvents, selected])
  const selectedEvent = selectedEvents.find((e) => e.key === selectedKey)
  const firstStart = placed[0]?.start
  const isSelectedToday = selected.getTime() === startOfDay(new Date()).getTime()

  // Remonte la grille horaire sur l'heure utile : maintenant (aujourd'hui), le premier événement, sinon 8 h.
  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    const now = new Date()
    const minutes = isSelectedToday ? now.getHours() * 60 + now.getMinutes() : null
    const target = ((minutes ?? firstStart ?? 8 * 60) / 60) * HOUR_PX
    el.scrollTop = Math.max(0, target - HOUR_PX)
  }, [selected, firstStart, isSelectedToday])

  useEffect(() => {
    if (selectedKey) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedKey])
  const today = startOfDay(new Date())

  function goToMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setMonth(next)
    setSelected(next)
  }

  async function addSource(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()
    if (!trimmedName || !trimmedUrl) return
    const { data, error } = await supabase
      .from('calendar_sources')
      .insert({ name: trimmedName, url: trimmedUrl, color })
      .select()
      .single()
    if (error) return setError(error.message)
    setError(null)
    setSources((prev) => [...(prev ?? []), data])
    setName('')
    setUrl('')
    void loadFeed(data.id)
  }

  async function removeSource(source: CalendarSource) {
    if (!window.confirm(`Retirer le calendrier « ${source.name} » ?`)) return
    const { error } = await supabase.from('calendar_sources').delete().eq('id', source.id)
    if (error) return setError(error.message)
    setError(null)
    setSources((prev) => prev?.filter((s) => s.id !== source.id) ?? null)
    setFeeds(({ [source.id]: _removed, ...rest }) => rest)
    setFeedErrors(({ [source.id]: _removed, ...rest }) => rest)
  }

  function eventTime(event: CalendarEvent) {
    if (event.allDay) return 'Toute la journée'
    return `${timeFormat.format(event.start)} – ${timeFormat.format(event.end)}`
  }

  return (
    <main className="space-y-4 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-wrap items-center justify-between gap-3 py-6 md:col-span-2">
          <h1 className="text-2xl font-semibold">Calendrier</h1>
          <div className="flex gap-3">
            <button
              onClick={() => sources && void loadAll(sources)}
              disabled={loadingFeeds || !sources?.length}
              aria-label="Actualiser les calendriers"
              title="Actualiser"
              className={`${iconOutlineClass} disabled:opacity-50`}
            >
              <Icon d={iconPaths.refresh} className={`size-5 ${loadingFeeds ? 'motion-safe:animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setManaging(true)}
              aria-label="Ajouter ou gérer les calendriers"
              title="Calendriers"
              className={iconPrimaryClass}
            >
              <Icon d={iconPaths.calendarPlus} />
            </button>
          </div>
          {error && (
            <p role="alert" className="w-full text-sm text-danger">
              {error}
            </p>
          )}
          {sources?.length === 0 && (
            <p className="w-full text-sm text-muted">
              Aucun calendrier connecté. Ajoutes-en un avec le bouton « Calendriers ».
            </p>
          )}
          {Object.keys(feedErrors).length > 0 && (
            <p role="alert" className="w-full text-sm text-danger">
              {sources
                ?.filter((s) => feedErrors[s.id])
                .map((s) => `${s.name} : ${feedErrors[s.id]}`)
                .join(' · ')}
            </p>
          )}
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => goToMonth(-1)} aria-label="Mois précédent" className={ghostButtonClass}>
              ‹
            </button>
            <button
              onClick={() => {
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                setSelected(today)
              }}
              className="min-h-11 rounded-2xl px-3 text-lg font-semibold capitalize"
            >
              {monthFormat.format(month)}
            </button>
            <button onClick={() => goToMonth(1)} aria-label="Mois suivant" className={ghostButtonClass}>
              ›
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {weekdays.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const events = eventsByDay.get(dayKey(d)) ?? []
              const isSelected = d.getTime() === selected.getTime()
              const isToday = d.getTime() === today.getTime()
              const sourceIds = [...new Set(events.map((e) => e.sourceId))].slice(0, 4)
              return (
                <button
                  key={d.getTime()}
                  onClick={() => setSelected(d)}
                  aria-label={`${dayFormat.format(d)}, ${events.length} événement(s)`}
                  aria-pressed={isSelected}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-sm transition active:scale-95 ${
                    isSelected ? 'border-accent-text bg-field' : 'border-transparent'
                  } ${d.getMonth() === month.getMonth() ? '' : 'text-muted/60'} ${
                    isToday ? 'font-bold text-accent-text' : ''
                  }`}
                >
                  {d.getDate()}
                  <span className="flex h-1.5 gap-0.5">
                    {sourceIds.map((id) => (
                      <span key={id} className="size-1.5 rounded-full" style={{ backgroundColor: colorOf(id) }} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="flex h-[32rem] flex-col md:col-start-3 md:row-span-2 md:row-start-1 md:h-auto">
          <h2 className="text-lg font-semibold capitalize">{dayFormat.format(selected)}</h2>

          {allDayEvents.length > 0 && (
            <ul className="mt-3 space-y-2">
              {allDayEvents.map((event) => (
                <li key={event.key}>
                  <button
                    onClick={() => setSelectedKey(event.key)}
                    aria-pressed={event.key === selectedKey}
                    className={`min-h-11 w-full rounded-2xl border border-glass-border bg-field px-3 text-left text-sm ${
                      event.key === selectedKey ? 'ring-2 ring-accent-text' : ''
                    }`}
                    style={{ borderLeftColor: colorOf(event.sourceId), borderLeftWidth: 4 }}
                  >
                    <span className="font-medium">{event.title}</span>
                    <span className="block text-xs text-muted">Toute la journée</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="relative mt-3 min-h-0 flex-1">
          <div ref={timelineRef} className="no-scrollbar absolute inset-0 overflow-y-auto rounded-2xl">
            <div className="relative" style={{ height: 24 * HOUR_PX }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 flex border-t border-divider"
                  style={{ top: h * HOUR_PX, height: HOUR_PX }}
                >
                  <span className="w-12 shrink-0 -translate-y-2 pr-2 text-right text-xs tabular-nums text-muted">
                    {String(h).padStart(2, '0')}:00
                  </span>
                </div>
              ))}

              {isSelectedToday && (
                <div
                  aria-hidden
                  className="absolute inset-x-0 z-10 flex items-center"
                  style={{ top: ((new Date().getHours() * 60 + new Date().getMinutes()) / 60) * HOUR_PX }}
                >
                  <span className="ml-11 size-2 rounded-full bg-danger" />
                  <span className="h-px flex-1 bg-danger" />
                </div>
              )}

              <div className="absolute inset-y-0 left-14 right-1">
                {placed.map(({ event, start, end, column, columns }) => {
                  const top = (start / 60) * HOUR_PX
                  const height = ((end - start) / 60) * HOUR_PX
                  return (
                  <button
                    key={event.key}
                    onClick={() => setSelectedKey(event.key)}
                    aria-pressed={event.key === selectedKey}
                    aria-label={`${event.title}, ${eventTime(event)}`}
                    className={`absolute overflow-hidden rounded-xl border border-glass-border bg-field px-2 py-0.5 text-left text-xs leading-tight transition active:scale-[0.98] ${
                      event.key === selectedKey ? 'z-10 ring-2 ring-accent-text' : ''
                    }`}
                    style={{
                      top,
                      height: height - 2,
                      left: `${(column / columns) * 100}%`,
                      width: `calc(${100 / columns}% - 2px)`,
                      borderLeftColor: colorOf(event.sourceId),
                      borderLeftWidth: 4,
                    }}
                  >
                    <span className="block truncate font-medium">{event.title}</span>
                    {height >= 40 && <span className="block truncate text-muted">{eventTime(event)}</span>}
                  </button>
                  )
                })}
              </div>
            </div>
          </div>
          </div>
          {selectedEvents.length === 0 && <p className="mt-3 text-sm text-muted">Rien de prévu.</p>}
        </Card>
      </div>

      {selectedEvent && (
        <div ref={detailRef}>
        <Card aria-label="Détails de l'événement">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold">{selectedEvent.title}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: colorOf(selectedEvent.sourceId) }} />
                {sources?.find((s) => s.id === selectedEvent.sourceId)?.name}
              </p>
            </div>
            <button onClick={() => setSelectedKey(null)} aria-label="Fermer les détails" className={`${ghostButtonClass} px-3`}>
              ✕
            </button>
          </div>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Quand</dt>
              <dd className="capitalize">
                {dayFormat.format(selectedEvent.start)}
                {selectedEvent.allDay ? '' : ` · ${eventTime(selectedEvent)}`}
                {selectedEvent.allDay ? ' · toute la journée' : ''}
              </dd>
            </div>
            {selectedEvent.location && (
              <div>
                <dt className="text-xs text-muted">Lieu</dt>
                <dd className="break-words">{selectedEvent.location}</dd>
              </div>
            )}
            {selectedEvent.description && (
              <div>
                <dt className="text-xs text-muted">Description</dt>
                <dd className="whitespace-pre-wrap break-words">{selectedEvent.description}</dd>
              </div>
            )}
          </dl>
        </Card>
        </div>
      )}

      {managing && (
        <Modal title="Calendriers connectés" onClose={() => setManaging(false)}>
          <ul className="mt-3 space-y-2">
            {sources?.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <button
                  onClick={() => void removeSource(s)}
                  aria-label={`Retirer le calendrier ${s.name}`}
                  title="Retirer"
                  className={`${iconButtonClass} text-danger`}
                >
                  <Icon d={iconPaths.trash} />
                </button>
              </li>
            ))}
            {sources?.length === 0 && <li className="text-sm text-muted">Aucun calendrier.</li>}
          </ul>

          <form onSubmit={(e) => void addSource(e)} className="mt-4 space-y-3 border-t border-glass-divider pt-4">
            <input
              aria-label="Nom du calendrier"
              placeholder="Nom (ex. Perso, Travail)…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            <input
              aria-label="Lien ICS du calendrier"
              placeholder="Lien ICS secret (https:// ou webcal://)…"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={inputClass}
            />
            <div className="flex gap-3">
              <input
                aria-label="Couleur du calendrier"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-11 shrink-0 rounded-2xl border border-glass-border bg-field p-1"
              />
              <button type="submit" className={`${buttonClass} flex-1`}>
                Connecter
              </button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted">
            Google Agenda : Paramètres → ton calendrier → « Adresse secrète au format iCal ». iCloud : Calendrier →
            Partager → Calendrier public. Outlook : Calendriers publiés → ICS.
          </p>
          <button onClick={() => setManaging(false)} className={`${ghostButtonClass} mt-3 w-full`}>
            Fermer
          </button>
        </Modal>
      )}
    </main>
  )
}
