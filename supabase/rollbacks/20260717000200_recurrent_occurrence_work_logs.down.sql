begin;

drop trigger if exists recurrent_subtask_work_events_prune_notebook_logs
  on public.recurrent_subtask_work_events;
drop function if exists public.cycle_recurrent_subtask_occurrence(uuid, uuid, date, numeric);
drop function if exists private.recurrent_subtask_occurs_on_date(
  public.recurrence_type,
  date,
  smallint[],
  date
);
drop table if exists public.recurrent_subtask_work_events;
drop table if exists public.recurrent_subtask_occurrences;

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

commit;
