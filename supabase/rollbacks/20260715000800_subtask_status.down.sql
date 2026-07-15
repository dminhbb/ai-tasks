begin;

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

drop trigger if exists subtasks_00_sync_status on public.subtasks;
drop function if exists private.sync_subtask_status_and_completion();

drop trigger if exists subtasks_set_completion_metadata on public.subtasks;
create trigger subtasks_set_completion_metadata
  before insert or update of completed on public.subtasks
  for each row execute function private.set_subtask_completion_metadata();

drop trigger if exists subtasks_record_completion on public.subtasks;
create trigger subtasks_record_completion
  after update of completed on public.subtasks
  for each row execute function private.record_subtask_completion_event();

alter table public.subtasks
  drop constraint if exists subtasks_status_valid,
  drop column if exists status;

commit;
