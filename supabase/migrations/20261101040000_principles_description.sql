-- Description détaillée d'un fil directeur (le champ `content` sert de titre).
alter table public.principles
  add column description text not null default '';
