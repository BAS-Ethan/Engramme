create table public.principles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index principles_user_id_idx on public.principles (user_id);

alter table public.principles enable row level security;

create policy "principles_select_own" on public.principles
  for select to authenticated using (user_id = auth.uid());
create policy "principles_insert_own" on public.principles
  for insert to authenticated with check (user_id = auth.uid());
create policy "principles_update_own" on public.principles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "principles_delete_own" on public.principles
  for delete to authenticated using (user_id = auth.uid());
