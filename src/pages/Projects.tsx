import { useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { Icon, iconButtonClass, iconPaths, iconPrimaryClass } from '../components/Icon'
import { Modal } from '../components/Modal'
import { Select } from '../components/Select'
import type { Folder, Project } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import { removeProjectFiles } from '../lib/storage'

const inputClass =
  'min-h-11 w-full rounded-2xl border border-glass-border bg-field px-4 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent-text'
const buttonClass =
  'min-h-11 shrink-0 rounded-2xl bg-accent px-4 font-medium text-on-accent transition active:scale-[0.98]'

type ProjectItem = Pick<Project, 'id' | 'folder_id' | 'name'>
type Counts = { tasks: number; openTasks: number; notes: number; files: number }

function countBy(rows: { project_id: string | null }[] | null, counts: Record<string, Counts>, key: keyof Counts) {
  for (const { project_id } of rows ?? []) {
    if (!project_id) continue
    counts[project_id] ??= { tasks: 0, openTasks: 0, notes: 0, files: 0 }
    counts[project_id][key]++
  }
}

type ProjectListProps = {
  items: ProjectItem[]
  counts: Record<string, Counts>
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

function ProjectList({ items, counts, onDragStart, onDragEnd }: ProjectListProps) {
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {items.map((p) => {
        const c = counts[p.id]
        return (
          <li key={p.id}>
            <Link
              to={`/projects/${p.id}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', p.id)
                onDragStart(p.id)
              }}
              onDragEnd={onDragEnd}
              className="flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-glass-border bg-field p-4 transition active:scale-[0.98]"
            >
              <span className="truncate font-medium">{p.name}</span>
              <span className="text-xs text-muted">
                {c?.openTasks ?? 0} tâche(s) · {c?.notes ?? 0} note(s) · {c?.files ?? 0} fichier(s)
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function Projects() {
  const [folders, setFolders] = useState<Folder[] | null>(null)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [counts, setCounts] = useState<Record<string, Counts>>({})
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<'folder' | 'project' | null>(null)
  const [name, setName] = useState('')
  const [targetFolder, setTargetFolder] = useState('')
  const [renaming, setRenaming] = useState<Folder | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Dossier survolé pendant un glisser-déposer ; 'none' = « Sans dossier ».
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('folders').select('*').order('created_at'),
      supabase.from('projects').select('id, folder_id, name').order('created_at'),
      supabase.from('tasks').select('project_id, done'),
      supabase.from('notes').select('project_id').not('project_id', 'is', null),
      supabase.from('project_documents').select('project_id'),
    ]).then(([f, p, t, n, d]) => {
      if (cancelled) return
      const failure = f.error ?? p.error ?? t.error ?? n.error ?? d.error
      if (failure) setError(failure.message)
      else {
        const next: Record<string, Counts> = {}
        countBy(t.data, next, 'tasks')
        countBy(t.data?.filter((x) => !x.done) ?? [], next, 'openTasks')
        countBy(n.data, next, 'notes')
        countBy(d.data, next, 'files')
        setFolders(f.data ?? [])
        setProjects(p.data ?? [])
        setCounts(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  function openCreate(kind: 'folder' | 'project') {
    setName('')
    setTargetFolder('')
    setCreating(kind)
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (creating === 'folder') {
      const { data, error } = await supabase.from('folders').insert({ name: trimmed }).select().single()
      if (error) return setError(error.message)
      setFolders((prev) => [...(prev ?? []), data])
    } else {
      const { data, error } = await supabase
        .from('projects')
        .insert({ folder_id: targetFolder || null, name: trimmed })
        .select('id, folder_id, name')
        .single()
      if (error) return setError(error.message)
      setProjects((prev) => [...prev, data])
    }
    setError(null)
    setCreating(null)
  }

  function openRename(folder: Folder) {
    setRenameValue(folder.name)
    setRenaming(folder)
  }

  async function renameFolder(e: FormEvent) {
    e.preventDefault()
    const trimmed = renameValue.trim()
    if (!renaming || !trimmed) return
    const { error } = await supabase.from('folders').update({ name: trimmed }).eq('id', renaming.id)
    if (error) return setError(error.message)
    setError(null)
    setFolders((prev) => prev?.map((f) => (f.id === renaming.id ? { ...f, name: trimmed } : f)) ?? null)
    setRenaming(null)
  }

  async function moveProject(projectId: string, folderId: string | null) {
    const project = projects.find((p) => p.id === projectId)
    if (!project || project.folder_id === folderId) return
    const { error } = await supabase.from('projects').update({ folder_id: folderId }).eq('id', projectId)
    if (error) return setError(error.message)
    setError(null)
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, folder_id: folderId } : p)))
  }

  // Props à poser sur une zone de dépôt (carte d'un dossier ou « Sans dossier »).
  function dropZone(folderId: string | null) {
    const key = folderId ?? 'none'
    return {
      onDragOver: (e: DragEvent) => {
        if (!draggingId) return
        e.preventDefault()
        setDropTarget(key)
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget((t) => (t === key ? null : t))
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        setDropTarget(null)
        setDraggingId(null)
        if (id) void moveProject(id, folderId)
      },
      className: dropTarget === key ? 'ring-2 ring-accent-text' : '',
    }
  }

  const listProps = {
    counts,
    onDragStart: setDraggingId,
    onDragEnd: () => {
      setDraggingId(null)
      setDropTarget(null)
    },
  }

  async function removeFolder(folder: Folder) {
    if (!window.confirm(`Supprimer le dossier « ${folder.name} » et tous ses projets ?`)) return
    const ids = projects.filter((p) => p.folder_id === folder.id).map((p) => p.id)
    const filesError = await removeProjectFiles(ids)
    if (filesError) return setError(filesError)
    const { error } = await supabase.from('folders').delete().eq('id', folder.id)
    if (error) return setError(error.message)
    setError(null)
    setFolders((prev) => prev?.filter((f) => f.id !== folder.id) ?? null)
    setProjects((prev) => prev.filter((p) => p.folder_id !== folder.id))
  }

  const unfiled = projects.filter((p) => p.folder_id === null)
  const unfiledZone = dropZone(null)

  return (
    <main className="space-y-4 p-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Projets</h1>
          <div className="flex gap-3">
            <button onClick={() => openCreate('folder')} aria-label="Nouveau dossier" title="Nouveau dossier" className={iconPrimaryClass}>
              <Icon d={iconPaths.folderPlus} />
            </button>
            <button onClick={() => openCreate('project')} aria-label="Nouveau projet" title="Nouveau projet" className={iconPrimaryClass}>
              <Icon d={iconPaths.projectPlus} />
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!error && folders === null && <p className="mt-3 text-sm text-muted">Chargement…</p>}
        {folders?.length === 0 && projects.length === 0 && (
          <p className="mt-3 text-sm text-muted">Aucun dossier ni projet pour l'instant.</p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {folders?.map((folder) => {
          const { className, ...zone } = dropZone(folder.id)
          return (
            <Card key={folder.id} className={className} {...zone}>
              <div className="flex items-center justify-between gap-1">
                <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{folder.name}</h2>
                <button
                  onClick={() => openRename(folder)}
                  aria-label={`Renommer le dossier ${folder.name}`}
                  title="Renommer"
                  className={iconButtonClass}
                >
                  <Icon d={iconPaths.pencil} />
                </button>
                <button
                  onClick={() => void removeFolder(folder)}
                  aria-label={`Supprimer le dossier ${folder.name}`}
                  title="Supprimer"
                  className={`${iconButtonClass} text-danger`}
                >
                  <Icon d={iconPaths.trash} />
                </button>
              </div>
              <ProjectList items={projects.filter((p) => p.folder_id === folder.id)} {...listProps} />
            </Card>
          )
        })}
        {(unfiled.length > 0 || draggingId) && (
          <Card {...unfiledZone}>
            <h2 className="text-lg font-semibold">Sans dossier</h2>
            <ProjectList items={unfiled} {...listProps} />
            {unfiled.length === 0 && <p className="mt-3 text-sm text-muted">Dépose un projet ici pour le sortir de son dossier.</p>}
          </Card>
        )}
      </div>

      {creating && (
        <Modal title={creating === 'folder' ? 'Nouveau dossier' : 'Nouveau projet'} onClose={() => setCreating(null)}>
          <form onSubmit={(e) => void create(e)} className="mt-3 space-y-3">
            <input
              autoFocus
              aria-label={creating === 'folder' ? 'Nom du dossier' : 'Nom du projet'}
              placeholder="Nom…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            {creating === 'project' && (
              <Select
                label="Dossier du projet"
                value={targetFolder}
                onChange={setTargetFolder}
                options={[{ value: '', label: 'Sans dossier' }, ...(folders ?? []).map((f) => ({ value: f.id, label: f.name }))]}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreating(null)}
                className="min-h-11 rounded-2xl border border-glass-border bg-field px-3 text-sm"
              >
                Annuler
              </button>
              <button type="submit" className={buttonClass}>
                Créer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {renaming && (
        <Modal title="Renommer le dossier" onClose={() => setRenaming(null)}>
          <form onSubmit={(e) => void renameFolder(e)} className="mt-3 space-y-3">
            <input
              autoFocus
              aria-label="Nouveau nom du dossier"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="min-h-11 rounded-2xl border border-glass-border bg-field px-3 text-sm"
              >
                Annuler
              </button>
              <button type="submit" className={buttonClass}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  )
}
