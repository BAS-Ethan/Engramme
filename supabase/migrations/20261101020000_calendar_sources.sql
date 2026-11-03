-- Abonnements à des calendriers externes (lien ICS secret : Google, iCloud, Outlook, Proton, etc.).
create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  url text not null check (url ~* '^(https|webcal)://'),
  color text not null default '#fed766',
  created_at timestamptz not null default now()
);

create index calendar_sources_user_id_idx on public.calendar_sources (user_id);

alter table public.calendar_sources enable row level security;

create policy "calendar_sources_select_own" on public.calendar_sources
  for select to authenticated using (user_id = auth.uid());
create policy "calendar_sources_insert_own" on public.calendar_sources
  for insert to authenticated with check (user_id = auth.uid());
create policy "calendar_sources_update_own" on public.calendar_sources
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "calendar_sources_delete_own" on public.calendar_sources
  for delete to authenticated using (user_id = auth.uid());
