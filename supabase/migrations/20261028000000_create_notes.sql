create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_id_updated_at_idx on public.notes (user_id, updated_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes
  for select to authenticated using (user_id = auth.uid());

create policy "notes_insert_own" on public.notes
  for insert to authenticated with check (user_id = auth.uid());

create policy "notes_update_own" on public.notes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notes_delete_own" on public.notes
  for delete to authenticated using (user_id = auth.uid());
