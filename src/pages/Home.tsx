import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { fetchFeed, parseIcs, type CalendarEvent } from '../lib/calendar'
import type { CalendarSource, Note, Principle, Project, Task } from '../lib/database.types'
import { formatDueDate, localDateString } from '../lib/dates'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type NoteListItem = Pick<Note, 'id' | 'title' | 'updated_at'>
type DatedTask = Pick<Task, 'id' | 'title' | 'due_date' | 'project_id'>
type ProjectName = Pick<Project, 'id' | 'name'>
type PrincipleItem = Pick<Principle, 'id' | 'content'>
type SourceStyle = Pick<CalendarSource, 'id' | 'color'>

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const longDateFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

// Un fil directeur par jour, stable sur la journée.
function principleOfTheDay(list: PrincipleItem[]) {
  const now = new Date()
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000)
  return list[dayNumber % list.length]
}

export default function Home() {
  const { session } = useAuth()
  const [notes, setNotes] = useState<NoteListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tasks, setTasks] = useState<DatedTask[] | null>(null)
  const [projects, setProjects] = useState<ProjectName[]>([])
  const [principles, setPrinciples] = useState<PrincipleItem[] | null>(null)
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const [sources, setSources] = useState<SourceStyle[]>([])
  const [calendarError, setCalendarError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      const search = query.trim()
      let request = supabase
        .from('notes')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
      if (search) request = request.textSearch('fts', search, { type: 'websearch', config: 'french' })
      request.then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else {
          setError(null)
          setNotes(data)
        }
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from('tasks')
        .select('id, title, due_date, project_id')
        .eq('done', false)
        .not('due_date', 'is', null)
        .order('due_date'),
      supabase.from('projects').select('id, name'),
      supabase.from('principles').select('id, content').order('created_at'),
    ]).then(([t, p, f]) => {
      if (cancelled) return
      setTasks(t.data ?? [])
      setProjects(p.data ?? [])
      setPrinciples(f.data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
    supabase
      .from('calendar_sources')
      .select('id, color')
      .order('created_at')
      .then(async ({ data, error }) => {
        if (cancelled) return
        if (error) return setCalendarError(true)
        const list = data ?? []
        const results = await Promise.all(
          list.map(async (s) => {
            const feed = await fetchFeed(s.id)
            if ('error' in feed) return null
            try {
              return parseIcs(s.id, feed.text, from, to)
            } catch {
              return null
            }
          }),
        )
        if (cancelled) return
        setSources(list)
        setCalendarError(results.some((r) => r === null))
        setEvents(
          results
            .flatMap((r) => r ?? [])
            .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime()),
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function completeTask(task: DatedTask) {
    const { error } = await supabase.from('tasks').update({ done: true }).eq('id', task.id)
    if (error) return setError(error.message)
    setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? null)
  }

  const today = localDateString()
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? ''
  const colorOf = (sourceId: string) => sources.find((s) => s.id === sourceId)?.color ?? '#999999'
  const overdue = tasks?.filter((t) => t.due_date !== null && t.due_date < today) ?? []
  const upcoming = tasks?.filter((t) => t.due_date !== null && t.due_date >= today) ?? []
  const principle = principles && principles.length > 0 ? principleOfTheDay(principles) : null

  const taskRow = (task: DatedTask, late: boolean) => (
    <li key={task.id} className="flex min-h-11 items-center gap-3 py-1">
      <input
        type="checkbox"
        onChange={() => void completeTask(task)}
        aria-label={`Terminer ${task.title}`}
        className="size-5 shrink-0 accent-accent"
      />
      <Link to={`/projects/${task.project_id}`} className="min-w-0 flex-1">
        <span className="block truncate">{task.title}</span>
        <span className="block truncate text-xs text-muted">{projectName(task.project_id)}</span>
      </Link>
      <time className={`shrink-0 text-xs ${late ? 'text-danger' : 'text-muted'}`}>
        {task.due_date === today ? "Aujourd'hui" : formatDueDate(task.due_date ?? '')}
      </time>
    </li>
  )

  return (
    <main className="grid gap-4 p-4 md:grid-cols-3 xl:grid-cols-4">
      <Card className="md:col-span-2">
        <h1 className="text-2xl font-semibold">Aujourd'hui</h1>
        <p className="text-sm capitalize text-muted">{longDateFormat.format(new Date())}</p>
        {events === null && <p className="mt-3 text-sm text-muted">Chargement…</p>}
        {events?.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            {sources.length === 0 ? (
              <>
                Aucun calendrier connecté. <Link to="/calendar" className="text-accent-text underline">En ajouter un</Link>
              </>
            ) : (
              "Rien de prévu aujourd'hui."
            )}
          </p>
        )}
        {events && events.length > 0 && (
          <ul className="mt-3 space-y-2">
            {events.map((event) => (
              <li
                key={event.key}
                className="rounded-2xl border border-glass-border bg-field p-3"
                style={{ borderLeftColor: colorOf(event.sourceId), borderLeftWidth: 4 }}
              >
                <p className="font-medium">{event.title}</p>
                <p className="text-xs text-muted">
                  {event.allDay ? 'Toute la journée' : `${timeFormat.format(event.start)} – ${timeFormat.format(event.end)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {calendarError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            Certains calendriers n'ont pas pu être chargés.
          </p>
        )}
      </Card>

      <Card className="md:col-span-1 xl:col-span-2">
        <h2 className="font-semibold">Fil directeur du jour</h2>
        {principles === null && <p className="mt-3 text-sm text-muted">Chargement…</p>}
        {principle ? (
          <blockquote className="mt-3 whitespace-pre-wrap break-words text-lg">{principle.content}</blockquote>
        ) : (
          principles && (
            <p className="mt-3 text-sm text-muted">
              Aucun fil directeur. <Link to="/principles" className="text-accent-text underline">En ajouter</Link>
            </p>
          )
        )}
      </Card>

      <Card className="md:col-span-2 md:row-span-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Notes</h2>
          <Link
            to="/notes/new"
            className="flex min-h-11 items-center rounded-2xl bg-accent px-4 font-medium text-on-accent transition active:scale-[0.98]"
          >
            Nouvelle note
          </Link>
        </div>

        <input
          type="search"
          aria-label="Rechercher dans les notes"
          placeholder="Rechercher…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 min-h-11 w-full rounded-2xl border border-glass-border bg-field px-4 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent-text"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!error && notes === null && <p className="mt-3 text-sm text-muted">Chargement…</p>}
        {notes?.length === 0 && (
          <p className="mt-3 text-sm text-muted">{query.trim() ? 'Aucun résultat.' : "Aucune note pour l'instant."}</p>
        )}
        {notes && notes.length > 0 && (
          <ul className="mt-3 max-h-[28rem] divide-y divide-divider overflow-y-auto">
            {notes.map((note) => (
              <li key={note.id}>
                <Link to={`/notes/${note.id}`} className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <span className="truncate font-medium">{note.title || 'Sans titre'}</span>
                  <time dateTime={note.updated_at} className="shrink-0 text-xs text-muted">
                    {new Date(note.updated_at).toLocaleDateString('fr-FR')}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="xl:col-span-2">
        <h2 className="font-semibold">Tâches datées</h2>
        {tasks === null && <p className="mt-3 text-sm text-muted">Chargement…</p>}
        {tasks?.length === 0 && (
          <p className="mt-3 text-sm text-muted">Aucune tâche avec échéance. Ajoute une date depuis un projet.</p>
        )}
        {tasks && tasks.length > 0 && (
          <ul className="mt-2 max-h-80 divide-y divide-divider overflow-y-auto">
            {overdue.map((t) => taskRow(t, true))}
            {upcoming.map((t) => taskRow(t, false))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Compte</h2>
        <p className="mt-2 break-all text-sm text-muted">{session?.user.email}</p>
      </Card>
    </main>
  )
}
