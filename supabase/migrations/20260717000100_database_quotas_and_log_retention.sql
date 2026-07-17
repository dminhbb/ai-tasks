begin;

create or replace function private.acquire_quota_lock(lock_scope text)
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(lock_scope, 9172026));
$$;

create or replace function private.enforce_notebook_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acquire_quota_lock('space:notebooks:' || new.space_id::text);
  if (select count(*) from public.notebooks notebook where notebook.space_id = new.space_id) >= 100 then
    raise exception 'QUOTA_NOTEBOOKS_PER_SPACE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_task_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acquire_quota_lock('notebook:tasks:' || new.notebook_id::text);
  if (select count(*) from public.tasks task where task.notebook_id = new.notebook_id) >= 500 then
    raise exception 'QUOTA_TASKS_PER_NOTEBOOK' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_subtask_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acquire_quota_lock('task:subtasks:' || new.task_id::text);
  if (select count(*) from public.subtasks subtask where subtask.task_id = new.task_id) >= 100 then
    raise exception 'QUOTA_SUBTASKS_PER_TASK' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_recurrent_task_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acquire_quota_lock('notebook:recurrent-tasks:' || new.notebook_id::text);
  if (select count(*) from public.recurrent_tasks task where task.notebook_id = new.notebook_id) >= 500 then
    raise exception 'QUOTA_RECURRENT_TASKS_PER_NOTEBOOK' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_recurrent_subtask_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acquire_quota_lock('recurrent-task:subtasks:' || new.recurrent_task_id::text);
  if (select count(*) from public.recurrent_subtasks subtask where subtask.recurrent_task_id = new.recurrent_task_id) >= 100 then
    raise exception 'QUOTA_RECURRENT_SUBTASKS_PER_TASK' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.prune_notebook_logs(requested_notebook_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acquire_quota_lock('notebook:logs:' || requested_notebook_id::text);

  with excess_logs as (
    select log_type, log_id
    from (
      select 'status'::text as log_type, event.id as log_id, event.changed_at
      from public.task_status_events event
      where event.notebook_id = requested_notebook_id
      union all
      select 'due_date'::text as log_type, event.id as log_id, event.changed_at
      from public.task_due_date_events event
      where event.notebook_id = requested_notebook_id
      union all
      select 'subtask_completion'::text as log_type, event.id as log_id, event.changed_at
      from public.subtask_completion_events event
      where event.notebook_id = requested_notebook_id
    ) log_entry
    order by changed_at desc, log_id desc
    offset 2000
  ), deleted_status as (
    delete from public.task_status_events event
    using excess_logs excess
    where excess.log_type = 'status' and event.id = excess.log_id
  ), deleted_due_dates as (
    delete from public.task_due_date_events event
    using excess_logs excess
    where excess.log_type = 'due_date' and event.id = excess.log_id
  )
  delete from public.subtask_completion_events event
  using excess_logs excess
  where excess.log_type = 'subtask_completion' and event.id = excess.log_id;
end;
$$;

create or replace function private.prune_notebook_logs_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.prune_notebook_logs(new.notebook_id);
  return new;
end;
$$;

drop trigger if exists notebooks_enforce_quota on public.notebooks;
create trigger notebooks_enforce_quota before insert on public.notebooks
  for each row execute function private.enforce_notebook_quota();
drop trigger if exists tasks_enforce_quota on public.tasks;
create trigger tasks_enforce_quota before insert on public.tasks
  for each row execute function private.enforce_task_quota();
drop trigger if exists subtasks_enforce_quota on public.subtasks;
create trigger subtasks_enforce_quota before insert on public.subtasks
  for each row execute function private.enforce_subtask_quota();
drop trigger if exists recurrent_tasks_enforce_quota on public.recurrent_tasks;
create trigger recurrent_tasks_enforce_quota before insert on public.recurrent_tasks
  for each row execute function private.enforce_recurrent_task_quota();
drop trigger if exists recurrent_subtasks_enforce_quota on public.recurrent_subtasks;
create trigger recurrent_subtasks_enforce_quota before insert on public.recurrent_subtasks
  for each row execute function private.enforce_recurrent_subtask_quota();

drop trigger if exists task_status_events_prune_notebook_logs on public.task_status_events;
create trigger task_status_events_prune_notebook_logs after insert on public.task_status_events
  for each row execute function private.prune_notebook_logs_after_insert();
drop trigger if exists task_due_date_events_prune_notebook_logs on public.task_due_date_events;
create trigger task_due_date_events_prune_notebook_logs after insert on public.task_due_date_events
  for each row execute function private.prune_notebook_logs_after_insert();
drop trigger if exists subtask_completion_events_prune_notebook_logs on public.subtask_completion_events;
create trigger subtask_completion_events_prune_notebook_logs after insert on public.subtask_completion_events
  for each row execute function private.prune_notebook_logs_after_insert();

commit;
