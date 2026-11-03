import { useEffect, useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { Icon, iconButtonClass, iconOutlineClass, iconPaths, iconPrimaryClass } from '../components/Icon'
import type { Principle } from '../lib/database.types'
import { supabase } from '../lib/supabase'

const inputClass =
  'min-h-11 w-full rounded-2xl border border-glass-border bg-field px-4 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent-text'
const textareaClass = `${inputClass} py-3`

export default function Principles() {
  const [items, setItems] = useState<Principle[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [draftDescription, setDraftDescription] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('principles')
      .select('*')
      .order('created_at')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setItems(data ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const content = newContent.trim()
    if (!content) return
    const { data, error } = await supabase
      .from('principles')
      .insert({ content, description: newDescription.trim() })
      .select()
      .single()
    if (error) return setError(error.message)
    setError(null)
    setItems((prev) => [...(prev ?? []), data])
    setCreating(false)
  }

  function openCreate() {
    setNewContent('')
    setNewDescription('')
    setCreating(true)
  }

  function startEdit(item: Principle) {
    setEditingId(item.id)
    setDraft(item.content)
    setDraftDescription(item.description)
  }

  async function save(e: FormEvent, id: string) {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    const { data, error } = await supabase
      .from('principles')
      .update({ content, description: draftDescription.trim() })
      .eq('id', id)
      .select()
      .single()
    if (error) return setError(error.message)
    setError(null)
    setItems((prev) => prev?.map((p) => (p.id === id ? data : p)) ?? null)
    setEditingId(null)
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer ce fil directeur ?')) return
    const { error } = await supabase.from('principles').delete().eq('id', id)
    if (error) return setError(error.message)
    setError(null)
    setItems((prev) => prev?.filter((p) => p.id !== id) ?? null)
  }

  return (
    <main className="space-y-4 p-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Fils directeurs</h1>
            <p className="mt-1 text-sm text-muted">Ce qui compte vraiment, pour ne pas le perdre de vue.</p>
          </div>
          <button onClick={openCreate} aria-label="Nouveau fil directeur" title="Nouveau fil directeur" className={iconPrimaryClass}>
            <Icon d={iconPaths.plus} />
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!error && items === null && <p className="mt-3 text-sm text-muted">Chargement…</p>}
        {items?.length === 0 && <p className="mt-3 text-sm text-muted">Aucun fil directeur pour l'instant.</p>}
      </Card>

      {items && items.length > 0 && (
        <Card>
          <ol className="divide-y divide-divider">
            {items.map((item, i) => {
              const isOpen = expanded.has(item.id)
              return (
                <li key={item.id} className="py-2">
                  {editingId === item.id ? (
                    <form onSubmit={(e) => void save(e, item.id)} className="space-y-3 py-1">
                      <input
                        autoFocus
                        aria-label="Modifier le fil directeur"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
                        className={inputClass}
                      />
                      <textarea
                        aria-label="Modifier la description"
                        placeholder="Description (facultative)…"
                        rows={4}
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
                        className={textareaClass}
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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggle(item.id)}
                          aria-expanded={isOpen}
                          aria-controls={`principle-${item.id}`}
                          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="w-7 shrink-0 text-right text-sm tabular-nums text-accent-text">{i + 1}.</span>
                          <span className="min-w-0 flex-1 break-words font-medium">{item.content}</span>
                          <Icon
                            d={iconPaths.chevron}
                            className={`size-5 shrink-0 text-muted transition ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <button
                          onClick={() => startEdit(item)}
                          aria-label={`Modifier le fil directeur ${i + 1}`}
                          title="Modifier"
                          className={iconButtonClass}
                        >
                          <Icon d={iconPaths.pencil} />
                        </button>
                        <button
                          onClick={() => void remove(item.id)}
                          aria-label={`Supprimer le fil directeur ${i + 1}`}
                          title="Supprimer"
                          className={`${iconButtonClass} text-danger`}
                        >
                          <Icon d={iconPaths.trash} />
                        </button>
                      </div>
                      {isOpen && (
                        <div id={`principle-${item.id}`} className="ml-10 pb-2 pr-2">
                          {item.description ? (
                            <p className="whitespace-pre-wrap break-words text-muted">{item.description}</p>
                          ) : (
                            <p className="text-sm italic text-muted">Pas de description.</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      )}

      {creating && (
        <Modal title="Nouveau fil directeur" onClose={() => setCreating(false)}>
          <form onSubmit={(e) => void add(e)} className="mt-3 space-y-3">
            <input
              autoFocus
              aria-label="Titre du fil directeur"
              placeholder="Un point important…"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className={inputClass}
            />
            <textarea
              aria-label="Description du fil directeur"
              placeholder="Description (facultative)…"
              rows={4}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className={textareaClass}
            />
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
