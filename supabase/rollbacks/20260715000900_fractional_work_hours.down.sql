begin;

alter table public.subtasks
  drop constraint if exists subtasks_work_hours_valid;
alter table public.subtask_completion_events
  drop constraint if exists subtask_completion_events_work_hours_valid;

drop trigger if exists subtasks_sync_completion_work_hours on public.subtasks;

update public.subtasks
set work_hours = case work_hours
  when 0.5 then 0
  when 1 then 0
  when 3 then 2
  else work_hours
end
where work_hours in (0.5, 1, 3);

update public.subtask_completion_events
set work_hours = case work_hours
  when 0.5 then 0
  when 1 then 0
  when 3 then 2
  else work_hours
end
where work_hours in (0.5, 1, 3);

alter table public.subtasks
  alter column work_hours type integer using work_hours::integer,
  alter column work_hours set default 0;

alter table public.subtask_completion_events
  alter column work_hours type integer using work_hours::integer,
  alter column work_hours set default 0;

alter table public.subtasks
  add constraint subtasks_work_hours_valid
    check (work_hours between 0 and 24 and mod(work_hours, 2) = 0);

alter table public.subtask_completion_events
  add constraint subtask_completion_events_work_hours_valid
    check (work_hours between 0 and 24 and mod(work_hours, 2) = 0);

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
  if exists (
    select 1
    from jsonb_array_elements(subtask_data) as input(item)
    where coalesce(item ->> 'status', 'TO DO') not in ('TO DO', 'IN PROGRESS', 'DONE')
  ) then
    raise exception 'Invalid subtask status' using errcode = '22023';
  end if;

  saved_task_id := public.save_task_bundle(
    requested_notebook_id,
    task_data,
    subtask_data,
    tag_data
  );

  update public.subtasks subtask
  set status = coalesce(input.item ->> 'status', 'TO DO')
  from jsonb_array_elements(subtask_data) as input(item)
  where subtask.id = (input.item ->> 'id')::uuid
    and subtask.task_id = saved_task_id;

  update public.subtasks subtask
  set work_hours = (input.item ->> 'workHours')::integer
  from jsonb_array_elements(work_hour_data) as input(item)
  where subtask.id = (input.item ->> 'id')::uuid
    and subtask.task_id = saved_task_id;

  return saved_task_id;
end;
$$;

commit;
