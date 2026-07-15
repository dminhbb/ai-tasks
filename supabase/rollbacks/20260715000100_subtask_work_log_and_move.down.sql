begin;

drop function if exists public.move_subtask(uuid, uuid, uuid);
drop function if exists public.save_task_bundle_with_work_hours(uuid, jsonb, jsonb, jsonb, jsonb);

drop trigger if exists subtasks_sync_completion_work_hours on public.subtasks;
drop function if exists private.sync_subtask_completion_work_hours();

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

alter table public.subtask_completion_events
  drop constraint if exists subtask_completion_events_work_hours_valid,
  drop column if exists work_hours;

alter table public.subtasks
  drop constraint if exists subtasks_work_hours_valid,
  drop column if exists work_hours;

update public.tasks
set title = '##Today Task'
where title = '(Untitle Tasks)';

commit;
