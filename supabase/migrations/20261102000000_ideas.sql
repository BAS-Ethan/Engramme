create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null,
  status text not null default 'raw' check (status in ('raw', 'dig', 'project', 'dropped')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ideas_user_id_idx on public.ideas (user_id);

create trigger ideas_set_updated_at
before update on public.ideas
for each row execute function public.set_updated_at();

alter table public.ideas enable row level security;

create policy "ideas_select_own" on public.ideas
  for select to authenticated using (user_id = auth.uid());
create policy "ideas_insert_own" on public.ideas
  for insert to authenticated with check (user_id = auth.uid());
create policy "ideas_update_own" on public.ideas
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ideas_delete_own" on public.ideas
  for delete to authenticated using (user_id = auth.uid());
