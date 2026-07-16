begin;

do $$
begin
  create type public.recurrence_type as enum ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly');
exception when duplicate_object then null;
end $$;

create table if not exists public.recurrent_tasks (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  assignee text not null default '',
  tags jsonb not null default '[]'::jsonb,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrent_tasks_title_length check (length(btrim(title)) between 1 and 240),
  constraint recurrent_tasks_tags_array check (jsonb_typeof(tags) = 'array')
);

create table if not exists public.recurrent_subtasks (
  id uuid primary key default gen_random_uuid(),
  recurrent_task_id uuid not null references public.recurrent_tasks(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  assignee text not null default '',
  tags jsonb not null default '[]'::jsonb,
  notes text not null default '',
  recurrence public.recurrence_type not null,
  anchor_date date not null,
  weekdays smallint[] not null default '{}'::smallint[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrent_subtasks_title_length check (length(btrim(title)) between 1 and 240),
  constraint recurrent_subtasks_tags_array check (jsonb_typeof(tags) = 'array'),
  constraint recurrent_subtasks_weekdays_valid check (
    cardinality(weekdays) <= 7
    and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  constraint recurrent_subtasks_weekdays_required check (
    recurrence not in ('weekly', 'bi-weekly') or cardinality(weekdays) > 0
  )
);

create index if not exists recurrent_tasks_notebook_order_idx
  on public.recurrent_tasks (notebook_id, sort_order, created_at);
create index if not exists recurrent_subtasks_task_order_idx
  on public.recurrent_subtasks (recurrent_task_id, sort_order, created_at);
create index if not exists recurrent_tasks_space_idx on public.recurrent_tasks (space_id);
create index if not exists recurrent_subtasks_space_idx on public.recurrent_subtasks (space_id);

create or replace function private.set_recurrent_task_space()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select notebook.space_id into new.space_id from public.notebooks notebook where notebook.id = new.notebook_id;
  if new.space_id is null then raise exception 'Unable to resolve recurrent task space' using errcode = '23503'; end if;
  return new;
end;
$$;

create or replace function private.set_recurrent_subtask_space()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select task.space_id into new.space_id from public.recurrent_tasks task where task.id = new.recurrent_task_id;
  if new.space_id is null then raise exception 'Unable to resolve recurrent subtask space' using errcode = '23503'; end if;
  return new;
end;
$$;

drop trigger if exists recurrent_tasks_set_space on public.recurrent_tasks;
create trigger recurrent_tasks_set_space before insert or update of notebook_id, space_id on public.recurrent_tasks
  for each row execute function private.set_recurrent_task_space();
drop trigger if exists recurrent_subtasks_set_space on public.recurrent_subtasks;
create trigger recurrent_subtasks_set_space before insert or update of recurrent_task_id, space_id on public.recurrent_subtasks
  for each row execute function private.set_recurrent_subtask_space();
drop trigger if exists recurrent_tasks_set_updated_at on public.recurrent_tasks;
create trigger recurrent_tasks_set_updated_at before update on public.recurrent_tasks
  for each row execute function private.set_updated_at();
drop trigger if exists recurrent_subtasks_set_updated_at on public.recurrent_subtasks;
create trigger recurrent_subtasks_set_updated_at before update on public.recurrent_subtasks
  for each row execute function private.set_updated_at();

alter table public.recurrent_tasks enable row level security;
alter table public.recurrent_subtasks enable row level security;

create policy recurrent_tasks_select_members on public.recurrent_tasks for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy recurrent_tasks_manage_task_users on public.recurrent_tasks for all to authenticated
  using (private.has_notebook_permission(notebook_id, 'manage_tasks'))
  with check (private.has_notebook_permission(notebook_id, 'manage_tasks'));
create policy recurrent_subtasks_select_members on public.recurrent_subtasks for select to authenticated
  using (exists (select 1 from public.recurrent_tasks task where task.id = recurrent_subtasks.recurrent_task_id and private.can_access_notebook(task.notebook_id)));
create policy recurrent_subtasks_manage_task_users on public.recurrent_subtasks for all to authenticated
  using (exists (select 1 from public.recurrent_tasks task where task.id = recurrent_subtasks.recurrent_task_id and private.has_notebook_permission(task.notebook_id, 'manage_tasks')))
  with check (exists (select 1 from public.recurrent_tasks task where task.id = recurrent_subtasks.recurrent_task_id and private.has_notebook_permission(task.notebook_id, 'manage_tasks')));

create or replace function public.save_recurrent_task_bundle(
  requested_notebook_id uuid,
  task_data jsonb,
  subtask_data jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_task_id uuid;
begin
  if not private.has_notebook_permission(requested_notebook_id, 'manage_tasks') then
    raise exception 'Not authorized to manage recurrent tasks' using errcode = '42501';
  end if;
  if jsonb_typeof(task_data) <> 'object' or jsonb_typeof(subtask_data) <> 'array'
    or length(btrim(coalesce(task_data ->> 'title', ''))) not between 1 and 240 then
    raise exception 'Invalid recurrent task bundle' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(subtask_data) item
    where jsonb_typeof(item) <> 'object'
      or length(btrim(coalesce(item ->> 'title', ''))) not between 1 and 240
      or coalesce(item ->> 'recurrence', '') not in ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly')
      or coalesce(item ->> 'anchorDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or jsonb_typeof(coalesce(item -> 'weekdays', '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'Invalid recurrent subtask bundle' using errcode = '22023';
  end if;

  saved_task_id := coalesce(nullif(task_data ->> 'id', '')::uuid, gen_random_uuid());
  insert into public.recurrent_tasks (id, notebook_id, title, assignee, tags, notes, sort_order)
  values (
    saved_task_id, requested_notebook_id, btrim(task_data ->> 'title'),
    left(coalesce(task_data ->> 'assignee', ''), 160),
    coalesce(task_data -> 'tags', '[]'::jsonb), left(coalesce(task_data ->> 'notes', ''), 12000),
    greatest(coalesce((task_data ->> 'sortOrder')::integer, 0), 0)
  )
  on conflict (id) do update set title = excluded.title, assignee = excluded.assignee, tags = excluded.tags, notes = excluded.notes, sort_order = excluded.sort_order
  where recurrent_tasks.notebook_id = requested_notebook_id;

  if not found then raise exception 'Recurrent task was not found in this notebook' using errcode = 'P0002'; end if;

  delete from public.recurrent_subtasks subtask
  where subtask.recurrent_task_id = saved_task_id
    and not exists (select 1 from jsonb_array_elements(subtask_data) item where nullif(item ->> 'id', '')::uuid = subtask.id);

  insert into public.recurrent_subtasks (id, recurrent_task_id, title, assignee, tags, notes, recurrence, anchor_date, weekdays, sort_order)
  select
    coalesce(nullif(item ->> 'id', '')::uuid, gen_random_uuid()), saved_task_id, btrim(item ->> 'title'),
    left(coalesce(item ->> 'assignee', ''), 160), coalesce(item -> 'tags', '[]'::jsonb), left(coalesce(item ->> 'notes', ''), 12000),
    (item ->> 'recurrence')::public.recurrence_type, (item ->> 'anchorDate')::date,
    coalesce(array(select jsonb_array_elements_text(item -> 'weekdays')::smallint), '{}'::smallint[]),
    greatest(coalesce((item ->> 'sortOrder')::integer, 0), 0)
  from jsonb_array_elements(subtask_data) item
  on conflict (id) do update set title = excluded.title, assignee = excluded.assignee, tags = excluded.tags, notes = excluded.notes,
    recurrence = excluded.recurrence, anchor_date = excluded.anchor_date, weekdays = excluded.weekdays, sort_order = excluded.sort_order
  where recurrent_subtasks.recurrent_task_id = saved_task_id;

  return saved_task_id;
end;
$$;

revoke all on function public.save_recurrent_task_bundle(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_recurrent_task_bundle(uuid, jsonb, jsonb) to authenticated;

commit;
