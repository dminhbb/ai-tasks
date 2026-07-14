drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.task_due_date_events cascade;
drop table if exists public.task_status_events cascade;
drop table if exists public.notebook_settings cascade;
drop table if exists public.task_tags cascade;
drop table if exists public.subtasks cascade;
drop table if exists public.tasks cascade;
drop table if exists public.notebook_members cascade;
drop table if exists public.notebooks cascade;
drop table if exists public.profiles cascade;

drop function if exists private.record_task_history();
drop function if exists private.handle_new_auth_user();
drop function if exists private.set_updated_at();
drop function if exists private.task_notebook_id(uuid);
drop function if exists private.has_notebook_permission(uuid, text, uuid);
drop function if exists private.can_access_notebook(uuid, uuid);
drop function if exists private.is_superadmin(uuid);
drop schema if exists private;

drop type if exists public.notebook_member_role;
drop type if exists public.app_role;

