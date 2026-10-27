alter table public.notes
  add column fts tsvector generated always as (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(content, '')), 'B')
  ) stored;

create index notes_fts_idx on public.notes using gin (fts);
