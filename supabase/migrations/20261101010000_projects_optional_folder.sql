-- Un projet peut exister sans dossier.
alter table public.projects
  alter column folder_id drop not null;
