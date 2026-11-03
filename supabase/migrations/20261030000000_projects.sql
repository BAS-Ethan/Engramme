create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  storage_path text not null,
  size bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.notes
  add column project_id uuid references public.projects (id) on delete set null;

create index folders_user_id_idx on public.folders (user_id);
create index projects_folder_id_idx on public.projects (folder_id);
create index tasks_project_id_idx on public.tasks (project_id);
create index project_documents_project_id_idx on public.project_documents (project_id);
create index notes_project_id_idx on public.notes (project_id);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- RLS : chaque utilisateur ne voit et ne modifie que ses lignes.
alter table public.folders enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.project_documents enable row level security;

create policy "folders_select_own" on public.folders
  for select to authenticated using (user_id = auth.uid());
create policy "folders_insert_own" on public.folders
  for insert to authenticated with check (user_id = auth.uid());
create policy "folders_update_own" on public.folders
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "folders_delete_own" on public.folders
  for delete to authenticated using (user_id = auth.uid());

create policy "projects_select_own" on public.projects
  for select to authenticated using (user_id = auth.uid());
create policy "projects_insert_own" on public.projects
  for insert to authenticated with check (user_id = auth.uid());
create policy "projects_update_own" on public.projects
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "projects_delete_own" on public.projects
  for delete to authenticated using (user_id = auth.uid());

create policy "tasks_select_own" on public.tasks
  for select to authenticated using (user_id = auth.uid());
create policy "tasks_insert_own" on public.tasks
  for insert to authenticated with check (user_id = auth.uid());
create policy "tasks_update_own" on public.tasks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_delete_own" on public.tasks
  for delete to authenticated using (user_id = auth.uid());

create policy "project_documents_select_own" on public.project_documents
  for select to authenticated using (user_id = auth.uid());
create policy "project_documents_insert_own" on public.project_documents
  for insert to authenticated with check (user_id = auth.uid());
create policy "project_documents_update_own" on public.project_documents
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "project_documents_delete_own" on public.project_documents
  for delete to authenticated using (user_id = auth.uid());

-- Stockage des fichiers : bucket privé, chemin `<user_id>/<project_id>/<fichier>`.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-documents', 'project-documents', false, 20971520);

create policy "project_documents_files_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "project_documents_files_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "project_documents_files_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-documents' and (storage.foldername(name))[1] = auth.uid()::text);
