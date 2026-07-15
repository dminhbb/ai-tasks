begin;

alter table public.subtasks
  add column if not exists work_hours integer not null default 0;

alter table public.subtasks
  drop constraint if exists subtasks_work_hours_valid,
  add constraint subtasks_work_hours_valid
    check (work_hours between 0 and 24 and mod(work_hours, 2) = 0);

alter table public.subtask_completion_events
  add column if not exists work_hours integer not null default 0;

alter table public.subtask_completion_events
  drop constraint if exists subtask_completion_events_work_hours_valid,
  add constraint subtask_completion_events_work_hours_valid
    check (work_hours between 0 and 24 and mod(work_hours, 2) = 0);

update public.tasks
set title = '(Untitle Tasks)'
where lower(btrim(title)) = lower('##Today Task');

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
    work_hours,
    changed_by
  ) values (
    parent_notebook_id,
    new.task_id,
    new.id,
    parent_title,
    new.title,
    old.completed,
    new.completed,
    new.work_hours,
    auth.uid()
  );

  return new;
end;
$$;

create or replace function private.sync_subtask_completion_work_hours()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.completed or old.work_hours is not distinct from new.work_hours then
    return new;
  end if;

  update public.subtask_completion_events completion_event
  set work_hours = new.work_hours
  where completion_event.id = (
    select latest_event.id
    from public.subtask_completion_events latest_event
    where latest_event.subtask_id = new.id
      and latest_event.to_completed
    order by latest_event.changed_at desc, latest_event.id desc
    limit 1
  );

  return new;
end;
$$;

drop trigger if exists subtasks_sync_completion_work_hours on public.subtasks;
create trigger subtasks_sync_completion_work_hours
  after update of work_hours on public.subtasks
  for each row execute function private.sync_subtask_completion_work_hours();

create or replace function public.save_task_bundle_with_work_hours(
  requested_notebook_id uuid,
  task_data jsonb,
  subtask_data jsonb default '[]'::jsonb,
  tag_data jsonb default '[]'::jsonb,
  work_hour_data jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_task_id uuid;
begin
  if jsonb_typeof(work_hour_data) <> 'array' then
    raise exception 'Invalid work hour bundle' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(work_hour_data) as input(item)
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'id', '') is null
      or coalesce(item ->> 'workHours', '') !~ '^(0|2|4|6|8|10|12|14|16|18|20|22|24)$'
  ) then
    raise exception 'Invalid subtask work hours' using errcode = '22023';
  end if;

  saved_task_id := public.save_task_bundle(
    requested_notebook_id,
    task_data,
    subtask_data,
    tag_data
  );

  update public.subtasks subtask
  set work_hours = (input.item ->> 'workHours')::integer
  from jsonb_array_elements(work_hour_data) as input(item)
  where subtask.id = (input.item ->> 'id')::uuid
    and subtask.task_id = saved_task_id;

  return saved_task_id;
end;
$$;

revoke all on function public.save_task_bundle_with_work_hours(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_task_bundle_with_work_hours(uuid, jsonb, jsonb, jsonb, jsonb)
  to authenticated;

create or replace function public.move_subtask(
  requested_notebook_id uuid,
  requested_subtask_id uuid,
  target_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_task_id uuid;
  next_sort_order integer;
begin
  if not private.has_notebook_permission(requested_notebook_id, 'manage_tasks') then
    raise exception 'Not authorized to edit tasks' using errcode = '42501';
  end if;

  select subtask.task_id
  into source_task_id
  from public.subtasks subtask
  join public.tasks source_task on source_task.id = subtask.task_id
  where subtask.id = requested_subtask_id
    and source_task.notebook_id = requested_notebook_id
  for update of subtask;

  if source_task_id is null then
    raise exception 'Subtask was not found in this notebook' using errcode = 'P0002';
  end if;
  if source_task_id = target_task_id then
    raise exception 'Subtask is already in the selected task' using errcode = '22023';
  end if;
  perform 1
  from public.tasks target_task
  where target_task.id = target_task_id
    and target_task.notebook_id = requested_notebook_id
  for update;

  if not found then
    raise exception 'Target task was not found in this notebook' using errcode = 'P0002';
  end if;

  select coalesce(max(subtask.sort_order), -1) + 1
  into next_sort_order
  from public.subtasks subtask
  where subtask.task_id = target_task_id;

  update public.subtasks
  set task_id = target_task_id,
      sort_order = next_sort_order
  where id = requested_subtask_id
    and task_id = source_task_id;
end;
$$;

revoke all on function public.move_subtask(uuid, uuid, uuid) from public, anon;
grant execute on function public.move_subtask(uuid, uuid, uuid) to authenticated;

commit;
