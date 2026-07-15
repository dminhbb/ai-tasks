begin;

drop function if exists public.set_notebook_users(uuid, uuid[]);
drop function if exists public.delete_space(uuid, text);
drop function if exists public.save_space(uuid, text, text, uuid[], uuid[]);

grant select, insert, update, delete on public.notebook_members to authenticated;

drop policy if exists notebooks_insert_admins on public.notebooks;
drop policy if exists notebooks_update_admins on public.notebooks;
drop policy if exists notebooks_delete_admins on public.notebooks;
drop policy if exists notebook_members_manage_space_admin on public.notebook_members;
drop policy if exists notebook_settings_manage_admins on public.notebook_settings;

drop trigger if exists notebooks_prevent_space_change on public.notebooks;
drop trigger if exists notebook_members_set_space on public.notebook_members;
drop trigger if exists tasks_set_space on public.tasks;
drop trigger if exists notebook_settings_set_space on public.notebook_settings;
drop trigger if exists task_status_events_set_space on public.task_status_events;
drop trigger if exists task_due_date_events_set_space on public.task_due_date_events;
drop trigger if exists subtask_completion_events_set_space on public.subtask_completion_events;
drop trigger if exists subtasks_set_space on public.subtasks;
drop trigger if exists task_tags_set_space on public.task_tags;

drop function if exists private.prevent_notebook_space_change();
drop function if exists private.set_notebook_child_space();
drop function if exists private.set_task_child_space();

alter table public.subtask_completion_events drop column if exists space_id;
alter table public.task_due_date_events drop column if exists space_id;
alter table public.task_status_events drop column if exists space_id;
alter table public.notebook_settings drop column if exists space_id;
alter table public.task_tags drop column if exists space_id;
alter table public.subtasks drop column if exists space_id;
alter table public.tasks drop column if exists space_id;
alter table public.notebook_members drop column if exists space_id;
alter table public.notebooks drop column if exists space_id;

drop policy if exists user_admin_audit_select_superadmin on public.user_admin_audit_events;
drop policy if exists space_settings_manage_admins on public.space_settings;
drop policy if exists space_settings_select_members on public.space_settings;
drop policy if exists space_members_manage_superadmin on public.space_members;
drop policy if exists space_members_select_members on public.space_members;
drop policy if exists spaces_manage_superadmin on public.spaces;
drop policy if exists spaces_select_members on public.spaces;

drop trigger if exists space_settings_set_updated_at on public.space_settings;
drop trigger if exists space_members_set_updated_at on public.space_members;
drop trigger if exists spaces_set_updated_at on public.spaces;

drop table if exists public.user_admin_audit_events;
drop table if exists public.space_settings;
drop table if exists public.space_members;
drop table if exists public.spaces;

drop function if exists private.is_space_admin(uuid, uuid);
drop function if exists private.can_access_space(uuid, uuid);

create or replace function private.can_access_notebook(requested_notebook_id uuid, requested_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_superadmin(requested_user_id)
    or exists (
      select 1 from public.notebooks notebook
      join public.profiles profile on profile.id = requested_user_id and profile.is_active
      where notebook.id = requested_notebook_id and notebook.owner_id = requested_user_id
    )
    or exists (
      select 1 from public.notebook_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.notebook_id = requested_notebook_id and member.user_id = requested_user_id
    );
$$;

create or replace function private.has_notebook_permission(
  requested_notebook_id uuid,
  permission_name text,
  requested_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_superadmin(requested_user_id)
    or exists (
      select 1 from public.notebook_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.notebook_id = requested_notebook_id
        and member.user_id = requested_user_id
        and case permission_name
          when 'manage_tasks' then coalesce((member.permissions ->> 'manage_tasks')::boolean, true)
          when 'manage_notebook' then profile.role = 'admin' and member.role = 'admin'
            and coalesce((member.permissions ->> 'manage_notebook')::boolean, false)
          when 'manage_settings' then profile.role = 'admin' and member.role = 'admin'
            and coalesce((member.permissions ->> 'manage_settings')::boolean, false)
          else false
        end
    );
$$;

drop policy if exists profiles_select_own_or_superadmin on public.profiles;
create policy profiles_select_own_or_superadmin on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_superadmin());

drop policy if exists notebooks_select_members on public.notebooks;
create policy notebooks_select_members on public.notebooks for select to authenticated
  using (private.can_access_notebook(id));
create policy notebooks_insert_superadmin on public.notebooks for insert to authenticated
  with check (private.is_superadmin() and owner_id = auth.uid());
create policy notebooks_update_managers on public.notebooks for update to authenticated
  using (private.has_notebook_permission(id, 'manage_notebook'))
  with check (private.has_notebook_permission(id, 'manage_notebook'));
create policy notebooks_delete_managers on public.notebooks for delete to authenticated
  using (private.has_notebook_permission(id, 'manage_notebook'));

drop policy if exists notebook_members_select_members on public.notebook_members;
create policy notebook_members_select_members on public.notebook_members for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy notebook_members_manage_notebook on public.notebook_members for all to authenticated
  using (private.has_notebook_permission(notebook_id, 'manage_notebook'))
  with check (private.has_notebook_permission(notebook_id, 'manage_notebook'));

drop policy if exists notebook_settings_select_members on public.notebook_settings;
create policy notebook_settings_select_members on public.notebook_settings for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy notebook_settings_insert_managers on public.notebook_settings for insert to authenticated
  with check (private.has_notebook_permission(notebook_id, 'manage_settings'));
create policy notebook_settings_update_managers on public.notebook_settings for update to authenticated
  using (private.has_notebook_permission(notebook_id, 'manage_settings'))
  with check (private.has_notebook_permission(notebook_id, 'manage_settings'));

create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, new.id::text), 'user')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

alter table public.profiles
  drop constraint if exists profiles_nickname_length,
  drop column if exists nickname;

drop type if exists public.space_member_role;

commit;
