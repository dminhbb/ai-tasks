begin;

create or replace function public.cycle_recurrent_subtask_occurrence(
  requested_notebook_id uuid,
  requested_subtask_id uuid,
  requested_occurrence_date date,
  requested_work_hours numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_local_date date := (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
  parent_space_id uuid;
  stored_recurrence public.recurrence_type;
  stored_anchor_date date;
  stored_weekdays smallint[];
  occurrence_record public.recurrent_subtask_occurrences%rowtype;
begin
  if not private.has_notebook_permission(requested_notebook_id, 'manage_tasks') then
    raise exception 'Not authorized to log recurrent work' using errcode = '42501';
  end if;
  if requested_occurrence_date is null
    or requested_occurrence_date not between current_local_date - 1 and current_local_date
  then
    raise exception 'Recurrent work can only be logged for today or yesterday' using errcode = '22023';
  end if;
  if requested_work_hours is not null
    and requested_work_hours not in (0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24)
  then
    raise exception 'Invalid recurrent work hours' using errcode = '22023';
  end if;

  select
    task.space_id,
    subtask.recurrence,
    subtask.anchor_date,
    subtask.weekdays
  into
    parent_space_id,
    stored_recurrence,
    stored_anchor_date,
    stored_weekdays
  from public.recurrent_subtasks subtask
  join public.recurrent_tasks task on task.id = subtask.recurrent_task_id
  where subtask.id = requested_subtask_id
    and task.notebook_id = requested_notebook_id;

  if parent_space_id is null then
    raise exception 'Recurrent subtask was not found in this notebook' using errcode = 'P0002';
  end if;
  if not private.recurrent_subtask_occurs_on_date(
    stored_recurrence,
    stored_anchor_date,
    stored_weekdays,
    requested_occurrence_date
  ) then
    raise exception 'The selected date is not a recurrent occurrence' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      requested_subtask_id::text || ':' || requested_occurrence_date::text,
      17022026
    )
  );

  select occurrence.*
  into occurrence_record
  from public.recurrent_subtask_occurrences occurrence
  where occurrence.recurrent_subtask_id = requested_subtask_id
    and occurrence.occurrence_date = requested_occurrence_date
  for update;

  if occurrence_record.id is null then
    if requested_work_hours is not null then
      raise exception 'Start recurrent work before completing it' using errcode = '22023';
    end if;

    insert into public.recurrent_subtask_occurrences (
      recurrent_subtask_id,
      notebook_id,
      space_id,
      occurrence_date,
      status
    ) values (
      requested_subtask_id,
      requested_notebook_id,
      parent_space_id,
      requested_occurrence_date,
      'IN PROGRESS'
    )
    returning * into occurrence_record;

    insert into public.recurrent_subtask_work_events (
      occurrence_id,
      recurrent_subtask_id,
      notebook_id,
      space_id,
      occurrence_date,
      status,
      changed_by
    ) values (
      occurrence_record.id,
      requested_subtask_id,
      requested_notebook_id,
      parent_space_id,
      requested_occurrence_date,
      'IN PROGRESS',
      auth.uid()
    );

    return jsonb_build_object('status', 'IN PROGRESS', 'workHours', 0);
  end if;

  if occurrence_record.status = 'IN PROGRESS' then
    if requested_work_hours is null then
      raise exception 'Work hours are required to complete recurrent work' using errcode = '22023';
    end if;

    update public.recurrent_subtask_occurrences occurrence
    set status = 'DONE',
        work_hours = requested_work_hours,
        completed_at = now(),
        updated_at = now()
    where occurrence.id = occurrence_record.id;

    insert into public.recurrent_subtask_work_events (
      occurrence_id,
      recurrent_subtask_id,
      notebook_id,
      space_id,
      occurrence_date,
      status,
      work_hours,
      changed_by
    ) values (
      occurrence_record.id,
      requested_subtask_id,
      requested_notebook_id,
      parent_space_id,
      requested_occurrence_date,
      'DONE',
      requested_work_hours,
      auth.uid()
    );

    return jsonb_build_object('status', 'DONE', 'workHours', requested_work_hours);
  end if;

  delete from public.recurrent_subtask_occurrences occurrence
  where occurrence.id = occurrence_record.id;

  return jsonb_build_object('status', 'TO DO', 'workHours', 0);
end;
$$;

revoke all on function public.cycle_recurrent_subtask_occurrence(uuid, uuid, date, numeric)
  from public, anon;
grant execute on function public.cycle_recurrent_subtask_occurrence(uuid, uuid, date, numeric)
  to authenticated;

commit;
