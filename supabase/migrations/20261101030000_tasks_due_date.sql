-- Date d'échéance optionnelle des tâches.
alter table public.tasks
  add column due_date date;

create index tasks_due_date_idx on public.tasks (due_date) where due_date is not null;
