begin;

alter table public.subtasks
  add column if not exists is_today boolean not null default false,
  add column if not exists completed_at timestamptz;

update public.subtasks
set completed_at = updated_at
where completed
  and completed_at is null;

create index if not exists subtasks_today_idx
  on public.subtasks (task_id, completed, completed_at desc)
  where is_today;

create table if not exists public.subtask_completion_events (
  id bigint generated always as identity primary key,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  subtask_id uuid references public.subtasks(id) on delete set null,
  parent_task_title text not null,
  subtask_title text not null,
  from_completed boolean not null,
  to_completed boolean not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists subtask_completion_events_notebook_changed_idx
  on public.subtask_completion_events (notebook_id, changed_at desc);

create or replace function private.set_subtask_completion_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.completed_at := case
      when new.completed then coalesce(new.completed_at, now())
      else null
    end;
  elsif new.completed is distinct from old.completed then
    new.completed_at := case when new.completed then now() else null end;
  end if;
  return new;
end;
$$;

create or replace function private.record_subtask_completion_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_notebook_id uuid;
  parent_title text;
begin
  if old.completed is not distinct from new.completed then
    return new;
  end if;

  select task.notebook_id, task.title
  into parent_notebook_id, parent_title
  from public.tasks task
  where task.id = new.task_id;

  if parent_notebook_id is null then
    raise exception 'Unable to resolve the parent task for subtask completion log'
      using errcode = '23503';
  end if;

  insert into public.subtask_completion_events (
    notebook_id,
    task_id,
    subtask_id,
    parent_task_title,
    subtask_title,
    from_completed,
    to_completed,
    changed_by
  ) values (
    parent_notebook_id,
    new.task_id,
    new.id,
    parent_title,
    new.title,
    old.completed,
    new.completed,
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists subtasks_set_completion_metadata on public.subtasks;
create trigger subtasks_set_completion_metadata
  before insert or update of completed on public.subtasks
  for each row execute function private.set_subtask_completion_metadata();

drop trigger if exists subtasks_record_completion on public.subtasks;
create trigger subtasks_record_completion
  after update of completed on public.subtasks
  for each row execute function private.record_subtask_completion_event();

alter table public.subtask_completion_events enable row level security;

drop policy if exists subtask_completion_events_select_members
  on public.subtask_completion_events;
create policy subtask_completion_events_select_members
  on public.subtask_completion_events
  for select to authenticated
  using (private.can_access_notebook(notebook_id));

revoke all on public.subtask_completion_events from public, anon;
grant select on public.subtask_completion_events to authenticated;
grant usage, select on sequence public.subtask_completion_events_id_seq to authenticated;

create or replace function public.save_task_bundle(
  requested_notebook_id uuid,
  task_data jsonb,
  subtask_data jsonb default '[]'::jsonb,
  tag_data jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_task_id uuid;
begin
  if not private.has_notebook_permission(requested_notebook_id, 'manage_tasks') then
    raise exception 'Not authorized to edit tasks' using errcode = '42501';
  end if;
  if jsonb_typeof(task_data) <> 'object'
     or jsonb_typeof(subtask_data) <> 'array'
     or jsonb_typeof(tag_data) <> 'array' then
    raise exception 'Invalid task bundle' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(subtask_data) as input(item)
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'id', '') is null
      or length(btrim(coalesce(item ->> 'title', ''))) not between 1 and 500
  ) then
    raise exception 'Invalid subtask bundle' using errcode = '22023';
  end if;

  requested_task_id := coalesce((task_data ->> 'id')::uuid, gen_random_uuid());

  insert into public.tasks (
    id, notebook_id, title, details, assignee, status, progress, sort_order,
    start_date, due_date, notes, created_at, in_progress_at, done_at
  ) values (
    requested_task_id,
    requested_notebook_id,
    btrim(task_data ->> 'title'),
    coalesce(task_data ->> 'details', ''),
    coalesce(task_data ->> 'assignee', ''),
    coalesce(task_data ->> 'status', 'TO DO'),
    coalesce((task_data ->> 'progress')::integer, 0),
    coalesce((task_data ->> 'sortOrder')::integer, 0),
    nullif(task_data ->> 'startDate', '')::timestamptz,
    nullif(task_data ->> 'dueDate', '')::timestamptz,
    coalesce(task_data ->> 'notes', ''),
    coalesce(nullif(task_data ->> 'createdAt', '')::timestamptz, now()),
    nullif(task_data ->> 'inProgressAt', '')::timestamptz,
    nullif(task_data ->> 'doneAt', '')::timestamptz
  )
  on conflict (id) do update set
    title = excluded.title,
    details = excluded.details,
    assignee = excluded.assignee,
    status = excluded.status,
    progress = excluded.progress,
    sort_order = excluded.sort_order,
    start_date = excluded.start_date,
    due_date = excluded.due_date,
    notes = excluded.notes,
    in_progress_at = excluded.in_progress_at,
    done_at = excluded.done_at
  where public.tasks.notebook_id = requested_notebook_id;

  if not found then
    raise exception 'Task belongs to another notebook' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(subtask_data) as input(item)
    join public.subtasks existing_subtask
      on existing_subtask.id = (item ->> 'id')::uuid
    where existing_subtask.task_id <> requested_task_id
  ) then
    raise exception 'Subtask belongs to another task' using errcode = '42501';
  end if;

  insert into public.subtasks (
    id, task_id, title, completed, is_today, sort_order, created_at
  )
  select
    (item ->> 'id')::uuid,
    requested_task_id,
    btrim(item ->> 'title'),
    coalesce((item ->> 'completed')::boolean, false),
    coalesce((item ->> 'isToday')::boolean, false),
    coalesce((item ->> 'sortOrder')::integer, item_ordinality::integer - 1),
    coalesce(nullif(item ->> 'createdAt', '')::timestamptz, now())
  from jsonb_array_elements(subtask_data) with ordinality as input(item, item_ordinality)
  on conflict (id) do update set
    title = excluded.title,
    completed = excluded.completed,
    is_today = excluded.is_today,
    sort_order = excluded.sort_order
  where public.subtasks.task_id = requested_task_id;

  delete from public.subtasks existing_subtask
  where existing_subtask.task_id = requested_task_id
    and not exists (
      select 1
      from jsonb_array_elements(subtask_data) as input(item)
      where (item ->> 'id')::uuid = existing_subtask.id
    );

  delete from public.task_tags where task_id = requested_task_id;
  insert into public.task_tags (task_id, tag)
  select requested_task_id, btrim(tag_value)
  from jsonb_array_elements_text(tag_data) as input(tag_value)
  where length(btrim(tag_value)) between 1 and 100
  on conflict do nothing;

  return requested_task_id;
end;
$$;

revoke all on function public.save_task_bundle(uuid, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_task_bundle(uuid, jsonb, jsonb, jsonb)
  to authenticated;

commit;
