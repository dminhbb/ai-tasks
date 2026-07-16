begin;
drop function if exists public.save_recurrent_task_bundle(uuid, jsonb, jsonb);
drop table if exists public.recurrent_subtasks;
drop table if exists public.recurrent_tasks;
drop type if exists public.recurrence_type;
drop function if exists private.set_recurrent_subtask_space();
drop function if exists private.set_recurrent_task_space();
commit;
