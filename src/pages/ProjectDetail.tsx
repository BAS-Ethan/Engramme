import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../components/Card'
import { DatePicker } from '../components/DatePicker'
import { Icon, iconButtonClass, iconPaths, iconPrimaryClass } from '../components/Icon'
import { Select } from '../components/Select'
import { useAuth } from '../lib/auth'
import type { Folder, Note, Project, ProjectDocument, Task } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import { localDateString } from '../lib/dates'
import { DOCUMENTS_BUCKET, removeProjectFiles } from '../lib/storage'

const inputClass =
  'min-h-11 w-full rounded-2xl border border-glass-border bg-field px-4 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent-text'

type NoteItem = Pick<Note, 'id' | 'title' | 'updated_at'>

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function ProjectDetail() {
  const today = localDateString()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTask, setNewTask] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('projects').select('*').eq('id', id).maybeSingle(),
      supabase.from('tasks').select('*').eq('project_id', id).order('created_at'),
      supabase
        .from('notes')
        .select('id, title, updated_at')
        .eq('project_id', id)
        .order('updated_at', { ascending: false }),
      supabase.from('project_documents').select('*').eq('project_id', id).order('created_at'),
      supabase.from('folders').select('*').order('name'),
    ]).then(([p, t, n, d, f]) => {
      if (cancelled) return
      const failure = p.error ?? t.error ?? n.error ?? d.error ?? f.error
      if (failure) setError(failure.message)
      else if (!p.data) setError('Projet introuvable.')
      else {
        setProject(p.data)
        setTasks(t.data ?? [])
        setNotes(n.data ?? [])
        setDocuments(d.data ?? [])
        setFolders(f.data ?? [])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  async function addTask(e: FormEvent) {
    e.preventDefault()
    const title = newTask.trim()
    if (!title) return
    const { data, error } = await supabase
      .from('tasks')
      .insert({ project_id: id, title, due_date: newTaskDue || null })
      .select()
      .single()
    if (error) return setError(error.message)
    setError(null)
    setTasks((prev) => [...prev, data])
    setNewTask('')
    setNewTaskDue('')
  }

  async function toggleTask(task: Task) {
    const { error } = await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)
    if (error) return setError(error.message)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))
  }

  async function setTaskDue(task: Task, due: string) {
    const due_date = due || null
    const { error } = await supabase.from('tasks').update({ due_date }).eq('id', task.id)
    if (error) return setError(error.message)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, due_date } : t)))
  }

  async function moveToFolder(folderId: string) {
    if (!project) return
    const folder_id = folderId || null
    const { error } = await supabase.from('projects').update({ folder_id }).eq('id', project.id)
    if (error) return setError(error.message)
    setError(null)
    setProject({ ...project, folder_id })
  }

  async function removeTask(taskId: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) return setError(error.message)
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !session) return
    setUploading(true)
    setError(null)
    const safeName = file.name.replace(/[^\w.-]+/g, '_')
    const path = `${session.user.id}/${id}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file)
    if (uploadError) {
      setUploading(false)
      return setError(uploadError.message)
    }
    const { data, error } = await supabase
      .from('project_documents')
      .insert({ project_id: id, name: file.name, storage_path: path, size: file.size })
      .select()
      .single()
    setUploading(false)
    if (error) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
      return setError(error.message)
    }
    setDocuments((prev) => [...prev, data])
  }

  async function download(doc: ProjectDocument) {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path, 60, { download: doc.name })
    if (error) return setError(error.message)
    window.location.assign(data.signedUrl)
  }

  async function removeDocument(doc: ProjectDocument) {
    if (!window.confirm(`Supprimer « ${doc.name} » ?`)) return
    const { error: fileError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([doc.storage_path])
    if (fileError) return setError(fileError.message)
    const { error } = await supabase.from('project_documents').delete().eq('id', doc.id)
    if (error) return setError(error.message)
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
  }

  async function removeProject() {
    if (!project || !window.confirm(`Supprimer le projet « ${project.name} » ?`)) return
    const filesError = await removeProjectFiles([project.id])
    if (filesError) return setError(filesError)
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (error) return setError(error.message)
    navigate('/projects')
  }

  if (loading) return <p className="p-8 text-center text-muted">Chargement…</p>

  return (
    <main className="grid gap-4 p-4 md:grid-cols-2">
      {/* z-20 : le menu déroulant du dossier doit passer au-dessus des cartes suivantes. */}
      <Card className="relative z-20 md:col-span-2">
        <Link to="/projects" className="flex min-h-11 items-center text-sm text-accent-text">
          ← Projets
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 flex-1 basis-40 truncate text-2xl font-semibold">{project?.name ?? 'Projet'}</h1>
          {project && (
            <div className="flex items-center gap-3">
              <Select
                label="Dossier du projet"
                icon={iconPaths.folder}
                value={project.folder_id ?? ''}
                onChange={(value) => void moveToFolder(value)}
                options={[{ value: '', label: 'Sans dossier' }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
                className="w-48 sm:w-60"
              />
              <button
                onClick={() => void removeProject()}
                aria-label="Supprimer le projet"
                title="Supprimer le projet"
                className={`${iconButtonClass} border border-danger-border text-danger`}
              >
                <Icon d={iconPaths.trash} />
              </button>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </Card>

      {project && (
        <>
          <Card>
            <h2 className="font-semibold">Tâches</h2>
            <ul className="mt-2 divide-y divide-divider">
              {tasks.map((task) => (
                <li key={task.id} className="flex min-h-11 items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => void toggleTask(task)}
                    aria-label={task.title}
                    className="size-5 shrink-0 accent-accent"
                  />
                  <span className={`flex-1 ${task.done ? 'text-muted line-through' : ''}`}>
                    {task.title}
                  </span>
                  <DatePicker
                    label={`Échéance de la tâche ${task.title}`}
                    value={task.due_date ?? ''}
                    onChange={(value) => void setTaskDue(task, value)}
                    overdue={!task.done && !!task.due_date && task.due_date < today}
                    className="w-36 shrink-0"
                  />
                  <button
                    onClick={() => void removeTask(task.id)}
                    aria-label={`Supprimer la tâche ${task.title}`}
                    title="Supprimer"
                    className={`${iconButtonClass} text-danger`}
                  >
                    <Icon d={iconPaths.trash} />
                  </button>
                </li>
              ))}
            </ul>
            {tasks.length === 0 && <p className="mt-2 text-sm text-muted">Aucune tâche.</p>}
            <form onSubmit={addTask} className="mt-3 flex flex-wrap gap-3">
              <input
                aria-label="Nouvelle tâche"
                placeholder="Nouvelle tâche…"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                className={`${inputClass} min-w-0 flex-1 basis-48`}
              />
              <div className="flex gap-3">
                <DatePicker label="Échéance de la nouvelle tâche" value={newTaskDue} onChange={setNewTaskDue} className="w-44" />
                <button type="submit" aria-label="Ajouter la tâche" title="Ajouter" className={iconPrimaryClass}>
                  <Icon d={iconPaths.plus} />
                </button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Notes</h2>
              <Link
                to={`/notes/new?project=${id}`}
                aria-label="Nouvelle note"
                title="Nouvelle note"
                className={iconPrimaryClass}
              >
                <Icon d={iconPaths.notePlus} />
              </Link>
            </div>
            <ul className="mt-2 divide-y divide-divider">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link to={`/notes/${note.id}`} className="flex min-h-11 items-center py-2">
                    <span className="truncate">{note.title || 'Sans titre'}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {notes.length === 0 && <p className="mt-2 text-sm text-muted">Aucune note.</p>}
          </Card>

          <Card className="md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Documents</h2>
              <label title="Ajouter un fichier" className={`${iconPrimaryClass} cursor-pointer`}>
                <Icon d={iconPaths.upload} className={`size-5 ${uploading ? 'motion-safe:animate-pulse' : ''}`} />
                <span className="sr-only">{uploading ? 'Envoi…' : 'Ajouter un fichier'}</span>
                <input type="file" onChange={(e) => void upload(e)} disabled={uploading} className="sr-only" />
              </label>
            </div>
            <ul className="mt-2 divide-y divide-divider">
              {documents.map((doc) => (
                <li key={doc.id} className="flex min-h-11 items-center gap-3 py-1">
                  <button
                    onClick={() => void download(doc)}
                    className="min-h-11 flex-1 truncate text-left"
                  >
                    {doc.name}
                  </button>
                  <span className="shrink-0 text-xs text-muted">{formatSize(doc.size)}</span>
                  <button
                    onClick={() => void removeDocument(doc)}
                    aria-label={`Supprimer ${doc.name}`}
                    title="Supprimer"
                    className={`${iconButtonClass} text-danger`}
                  >
                    <Icon d={iconPaths.trash} />
                  </button>
                </li>
              ))}
            </ul>
            {documents.length === 0 && <p className="mt-2 text-sm text-muted">Aucun document.</p>}
          </Card>
        </>
      )}
    </main>
  )
}
