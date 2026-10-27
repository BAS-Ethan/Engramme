import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import type { Note } from '../lib/database.types'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type NoteListItem = Pick<Note, 'id' | 'title' | 'updated_at'>

export default function Home() {
  const { session } = useAuth()
  const [notes, setNotes] = useState<NoteListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

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

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-accent-strong/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 size-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      </div>

      <main className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Notes</h1>
            <Link
              to="/notes/new"
              className="flex min-h-11 items-center rounded-2xl bg-accent-strong px-4 font-medium text-white transition active:scale-[0.98]"
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
            className="mt-3 min-h-11 w-full rounded-2xl border border-white/40 bg-white/70 px-4 text-base text-slate-900 outline-none focus:border-accent dark:border-white/20 dark:bg-white/10 dark:text-slate-100"
          />

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {!error && notes === null && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Chargement…</p>
          )}
          {notes?.length === 0 && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {query.trim() ? 'Aucun résultat.' : "Aucune note pour l'instant."}
            </p>
          )}
          {notes && notes.length > 0 && (
            <ul className="mt-3 divide-y divide-white/20">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link
                    to={`/notes/${note.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 py-2"
                  >
                    <span className="truncate font-medium">{note.title || 'Sans titre'}</span>
                    <time
                      dateTime={note.updated_at}
                      className="shrink-0 text-xs text-slate-500 dark:text-slate-400"
                    >
                      {new Date(note.updated_at).toLocaleDateString('fr-FR')}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Compte</h2>
          <p className="mt-2 break-all text-sm text-slate-600 dark:text-slate-300">
            {session?.user.email}
          </p>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="mt-4 min-h-11 rounded-2xl border border-white/40 px-4 text-sm dark:border-white/20"
          >
            Se déconnecter
          </button>
        </Card>
      </main>
    </div>
  )
}
