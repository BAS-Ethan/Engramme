import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { Icon, iconButtonClass, iconOutlineClass, iconPaths, iconPrimaryClass } from '../components/Icon'
import type { Idea, IdeaStatus } from '../lib/database.types'
import { supabase } from '../lib/supabase'

const inputClass =
  'min-h-11 w-full rounded-2xl border border-glass-border bg-field px-4 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent-text'

const statuses: { value: IdeaStatus; label: string; pill: string }[] = [
  { value: 'raw', label: 'Brute', pill: 'bg-field text-muted' },
  { value: 'dig', label: 'À creuser', pill: 'bg-accent/30 text-accent-text' },
  { value: 'project', label: 'En projet', pill: 'bg-accent text-on-accent' },
  { value: 'dropped', label: 'Abandonnée', pill: 'bg-field text-muted line-through' },
]
const statusOf = (value: IdeaStatus) => statuses.find((s) => s.value === value) ?? statuses[0]
const nextStatus = (value: IdeaStatus) => statuses[(statuses.indexOf(statusOf(value)) + 1) % statuses.length].value

const tagPattern = /(^|\s)#([\p{L}\p{N}_-]+)/gu

// « Appeler Paul #contact #idée » → texte sans les tags + ['contact', 'idée'].
function parseCapture(text: string) {
  const tags = [...text.matchAll(tagPattern)].map((m) => m[2].toLowerCase())
  const content = text.replace(tagPattern, '$1').replace(/[ \t]+/g, ' ').trim()
  return { content: content || text.trim(), tags: [...new Set(tags)] }
}

function parseTagList(text: string) {
  const tags = text
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, '').toLowerCase())
    .filter(Boolean)
  return [...new Set(tags)]
}

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [capture, setCapture] = useState('')
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [draftTags, setDraftTags] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setIdeas(data ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const allTags = useMemo(() => [...new Set((ideas ?? []).flatMap((i) => i.tags))].sort(), [ideas])

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return (ideas ?? []).filter(
      (i) =>
        (statusFilter === 'all' || i.status === statusFilter) &&
        (tagFilter === null || i.tags.includes(tagFilter)) &&
        (!search || i.content.toLowerCase().includes(search) || i.tags.some((t) => t.includes(search))),
    )
  }, [ideas, statusFilter, tagFilter, query])

  function replaceIdea(updated: Idea) {
    setIdeas((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)) ?? null)
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!capture.trim()) return
    const { content, tags } = parseCapture(capture)
    const { data, error } = await supabase.from('ideas').insert({ content, tags }).select().single()
    if (error) return setError(error.message)
    setError(null)
    setIdeas((prev) => [data, ...(prev ?? [])])
    setCreating(false)
  }

  function openCreate() {
    setCapture('')
    setCreating(true)
  }

  async function cycleStatus(idea: Idea) {
    const { data, error } = await supabase
      .from('ideas')
      .update({ status: nextStatus(idea.status) })
      .eq('id', idea.id)
      .select()
      .single()
    if (error) return setError(error.message)
    setError(null)
    replaceIdea(data)
  }

  function startEdit(idea: Idea) {
    setEditingId(idea.id)
    setDraft(idea.content)
    setDraftTags(idea.tags.join(' '))
  }

  async function save(e: FormEvent, id: string) {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    const { data, error } = await supabase
      .from('ideas')
      .update({ content, tags: parseTagList(draftTags) })
      .eq('id', id)
      .select()
      .single()
    if (error) return setError(error.message)
    setError(null)
    replaceIdea(data)
    setEditingId(null)
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer cette idée ?')) return
    const { error } = await supabase.from('ideas').delete().eq('id', id)
    if (error) return setError(error.message)
    setError(null)
    setIdeas((prev) => prev?.filter((i) => i.id !== id) ?? null)
  }

  const count = (status: IdeaStatus) => ideas?.filter((i) => i.status === status).length ?? 0
  const chipClass = (active: boolean) =>
    `min-h-11 rounded-2xl border px-3 text-sm transition active:scale-95 ${
      active ? 'border-accent-text bg-field text-accent-text' : 'border-glass-border text-muted'
    }`

  return (
    <main className="space-y-4 p-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Idées</h1>
          <button onClick={openCreate} aria-label="Nouvelle idée" title="Nouvelle idée" className={iconPrimaryClass}>
            <Icon d={iconPaths.plus} />
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!error && ideas === null && <p className="mt-3 text-sm text-muted">Chargement…</p>}

        {ideas && ideas.length > 0 && (
          <div className="mt-4 space-y-3">
            <input
              type="search"
              aria-label="Rechercher dans les idées"
              placeholder="Rechercher…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={inputClass}
            />
            <div className="flex flex-wrap gap-2">
              <button aria-pressed={statusFilter === 'all'} onClick={() => setStatusFilter('all')} className={chipClass(statusFilter === 'all')}>
                Toutes ({ideas.length})
              </button>
              {statuses.map((s) => (
                <button
                  key={s.value}
                  aria-pressed={statusFilter === s.value}
                  onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
                  className={chipClass(statusFilter === s.value)}
                >
                  {s.label} ({count(s.value)})
                </button>
              ))}
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    aria-pressed={tagFilter === tag}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={chipClass(tagFilter === tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {ideas?.length === 0 && <p className="px-2 text-sm text-muted">Aucune idée pour l'instant. Note la première !</p>}
      {ideas && ideas.length > 0 && visible.length === 0 && (
        <p className="px-2 text-sm text-muted">Aucune idée ne correspond à ces filtres.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((idea) => {
          const status = statusOf(idea.status)
          return (
            <Card key={idea.id} className={`flex flex-col gap-3 ${idea.status === 'dropped' ? 'opacity-60' : ''}`}>
              {editingId === idea.id ? (
                <form onSubmit={(e) => void save(e, idea.id)} className="space-y-3">
                  <textarea
                    autoFocus
                    aria-label="Modifier l'idée"
                    rows={5}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
                    className={`${inputClass} py-3`}
                  />
                  <input
                    aria-label="Tags de l'idée"
                    placeholder="Tags séparés par des espaces…"
                    value={draftTags}
                    onChange={(e) => setDraftTags(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
                    className={inputClass}
                  />
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditingId(null)} aria-label="Annuler" title="Annuler" className={iconOutlineClass}>
                      <Icon d={iconPaths.close} />
                    </button>
                    <button type="submit" aria-label="Enregistrer" title="Enregistrer" className={iconPrimaryClass}>
                      <Icon d={iconPaths.check} />
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="flex-1 whitespace-pre-wrap break-words">{idea.content}</p>
                  {idea.tags.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 text-sm text-accent-text">
                      {idea.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                          className="min-h-9"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      onClick={() => void cycleStatus(idea)}
                      aria-label={`Statut : ${status.label}. Changer de statut`}
                      title="Changer de statut"
                      className="flex min-h-11 items-center"
                    >
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.pill}`}>{status.label}</span>
                    </button>
                    <div className="flex">
                      <button onClick={() => startEdit(idea)} aria-label="Modifier l'idée" title="Modifier" className={iconButtonClass}>
                        <Icon d={iconPaths.pencil} />
                      </button>
                      <button
                        onClick={() => void remove(idea.id)}
                        aria-label="Supprimer l'idée"
                        title="Supprimer"
                        className={`${iconButtonClass} text-danger`}
                      >
                        <Icon d={iconPaths.trash} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          )
        })}
      </div>

      {creating && (
        <Modal title="Nouvelle idée" onClose={() => setCreating(false)}>
          <form onSubmit={(e) => void add(e)} className="mt-3 space-y-3">
            <textarea
              autoFocus
              aria-label="Nouvelle idée"
              placeholder="Une idée ?"
              rows={5}
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
              }}
              className={`${inputClass} py-3`}
            />
            <p className="text-xs text-muted">Astuce : écris #tag dans ton idée pour y ajouter un tag.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="min-h-11 rounded-2xl border border-glass-border bg-field px-3 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="min-h-11 rounded-2xl bg-accent px-4 font-medium text-on-accent transition active:scale-[0.98]"
              >
                Créer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  )
}
