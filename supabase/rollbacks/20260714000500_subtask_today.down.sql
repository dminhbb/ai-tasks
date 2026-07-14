begin;

drop trigger if exists subtasks_record_completion on public.subtasks;
drop trigger if exists subtasks_set_completion_metadata on public.subtasks;
drop function if exists private.record_subtask_completion_event();
drop function if exists private.set_subtask_completion_metadata();
drop table if exists public.subtask_completion_events;

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

  delete from public.subtasks where task_id = requested_task_id;
  insert into public.subtasks (id, task_id, title, completed, sort_order, created_at)
  select
    coalesce(nullif(item ->> 'id', '')::uuid, gen_random_uuid()),
    requested_task_id,
    btrim(item ->> 'title'),
    coalesce((item ->> 'completed')::boolean, false),
    coalesce((item ->> 'sortOrder')::integer, item_ordinality::integer - 1),
    coalesce(nullif(item ->> 'createdAt', '')::timestamptz, now())
  from jsonb_array_elements(subtask_data) with ordinality as input(item, item_ordinality)
  where length(btrim(item ->> 'title')) > 0;

  delete from public.task_tags where task_id = requested_task_id;
  insert into public.task_tags (task_id, tag)
  select requested_task_id, btrim(tag_value)
  from jsonb_array_elements_text(tag_data) as input(tag_value)
  where length(btrim(tag_value)) between 1 and 100
  on conflict do nothing;

  return requested_task_id;
end;
$$;

alter table public.subtasks
  drop column if exists completed_at,
  drop column if exists is_today;

commit;
