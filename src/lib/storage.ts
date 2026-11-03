import { supabase } from './supabase'

export const DOCUMENTS_BUCKET = 'project-documents'

/** Supprime les fichiers Storage de ces projets (la suppression SQL ne les touche pas). */
export async function removeProjectFiles(projectIds: string[]): Promise<string | null> {
  if (projectIds.length === 0) return null
  const { data, error } = await supabase
    .from('project_documents')
    .select('storage_path')
    .in('project_id', projectIds)
  if (error) return error.message
  if (data.length === 0) return null
  const { error: removeError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove(data.map((d) => d.storage_path))
  return removeError ? removeError.message : null
}
