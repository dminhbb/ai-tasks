begin;

alter table public.subtasks
  add column if not exists status text not null default 'TO DO';

update public.subtasks
set status = case when completed then 'DONE' else 'TO DO' end;

alter table public.subtasks
  drop constraint if exists subtasks_status_valid,
  add constraint subtasks_status_valid
    check (status in ('TO DO', 'IN PROGRESS', 'DONE'));

create or replace function private.sync_subtask_status_and_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.completed or new.status = 'DONE' then
      new.status := 'DONE';
      new.completed := true;
    else
      new.completed := false;
    end if;
  elsif new.status is distinct from old.status then
    new.completed := new.status = 'DONE';
  elsif new.completed is distinct from old.completed then
    new.status := case when new.completed then 'DONE' else 'TO DO' end;
  end if;

  return new;
end;
$$;

drop trigger if exists subtasks_00_sync_status on public.subtasks;
create trigger subtasks_00_sync_status
  before insert or update of status, completed on public.subtasks
  for each row execute function private.sync_subtask_status_and_completion();

-- These triggers must observe completion changes made by the synchronization trigger too.
drop trigger if exists subtasks_set_completion_metadata on public.subtasks;
create trigger subtasks_set_completion_metadata
  before insert or update on public.subtasks
  for each row execute function private.set_subtask_completion_metadata();

drop trigger if exists subtasks_record_completion on public.subtasks;
create trigger subtasks_record_completion
  after update on public.subtasks
  for each row execute function private.record_subtask_completion_event();

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

revoke all on function public.save_task_bundle_with_work_hours(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_task_bundle_with_work_hours(uuid, jsonb, jsonb, jsonb, jsonb)
  to authenticated;

commit;
