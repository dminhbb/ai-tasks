begin;

drop trigger if exists notebooks_assign_unassigned_space_users on public.notebooks;
drop trigger if exists space_members_assign_first_notebook on public.space_members;
drop function if exists private.assign_new_notebook_unassigned_space_users();
drop function if exists private.assign_space_user_first_notebook();

-- Existing notebook assignments are retained because users may have created data in them.

commit;
