import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Card } from '../components/Card'
import { supabase } from '../lib/supabase'

const inputClass =
  'min-h-11 w-full rounded-2xl border border-glass-border bg-field px-4 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent-text'

export default function NoteEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [projectId, setProjectId] = useState<string | null>(searchParams.get('project'))
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(id !== undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id === undefined) return
    let cancelled = false
    supabase
      .from('notes')
      .select('title, content, project_id')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else if (!data) setError('Note introuvable.')
        else {
          setTitle(data.title)
          setContent(data.content)
          setProjectId(data.project_id)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const backPath = projectId ? `/projects/${projectId}` : '/'

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    if (id === undefined) {
      const { data, error } = await supabase
        .from('notes')
        .insert({ title, content, project_id: projectId })
        .select('id')
        .single()
      setBusy(false)
      if (error) setError(error.message)
      else navigate(`/notes/${data.id}`, { replace: true })
      return
    }

    const { error } = await supabase.from('notes').update({ title, content }).eq('id', id)
    setBusy(false)
    if (error) setError(error.message)
    else navigate(backPath)
  }

  async function remove() {
    if (id === undefined || !window.confirm('Supprimer cette note ?')) return
    setBusy(true)
    const { error } = await supabase.from('notes').delete().eq('id', id)
    setBusy(false)
    if (error) setError(error.message)
    else navigate(backPath)
  }

  return (
    <main className="p-4">
      <Card>
        <Link to={backPath} className="flex min-h-11 items-center text-sm text-accent-text">
          ← {projectId ? 'Projet' : 'Notes'}
        </Link>

        {loading ? (
          <p className="mt-3 text-sm text-muted">Chargement…</p>
        ) : (
          <form onSubmit={save} className="mt-2 space-y-3">
            <input
              aria-label="Titre"
              placeholder="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${inputClass} text-lg font-semibold`}
            />
            <textarea
              aria-label="Contenu (Markdown)"
              placeholder="Écris en Markdown…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              className={`${inputClass} py-3 font-mono text-sm`}
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 flex-1 rounded-2xl bg-accent px-4 font-medium text-on-accent transition active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {id !== undefined && (
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="min-h-11 rounded-2xl border border-danger-border px-4 text-danger disabled:opacity-50"
                >
                  Supprimer
                </button>
              )}
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </Card>
    </main>
  )
}
