begin;

do $$
begin
  create type public.space_member_role as enum ('admin', 'user');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists nickname text not null default '';

alter table public.profiles
  drop constraint if exists profiles_nickname_length,
  add constraint profiles_nickname_length check (length(nickname) <= 100);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spaces_name_length check (length(btrim(name)) between 1 and 100),
  constraint spaces_slug_valid check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 2 and 80)
);

create unique index if not exists spaces_slug_lower_idx on public.spaces (lower(slug));

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.space_member_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists space_members_user_idx on public.space_members (user_id, space_id);

create table if not exists public.space_settings (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  tags jsonb not null default '["Frontend", "Backend", "Design", "Bug", "Feature"]'::jsonb,
  assistant_intents jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint space_settings_tags_array check (jsonb_typeof(tags) = 'array'),
  constraint space_settings_intents_array check (jsonb_typeof(assistant_intents) = 'array')
);

create table if not exists public.user_admin_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_admin_audit_action_length check (length(action) between 1 and 80),
  constraint user_admin_audit_details_object check (jsonb_typeof(details) = 'object')
);

create index if not exists user_admin_audit_created_idx
  on public.user_admin_audit_events (created_at desc);

insert into public.spaces (name, slug, created_by)
values ('Main Space', 'main', null)
on conflict do nothing;

insert into public.space_members (space_id, user_id, role)
select space.id, profile.id,
  case when profile.role in ('superadmin', 'admin') then 'admin'::public.space_member_role
       else 'user'::public.space_member_role end
from public.spaces space
cross join public.profiles profile
where space.slug = 'main'
on conflict (space_id, user_id) do update set role = excluded.role;

alter table public.notebooks add column if not exists space_id uuid references public.spaces(id) on delete cascade;
alter table public.notebook_members add column if not exists space_id uuid references public.spaces(id) on delete cascade;
alter table public.tasks add column if not exists space_id uuid references public.spaces(id) on delete cascade;
alter table public.subtasks add column if not exists space_id uuid references public.spaces(id) on delete cascade;
alter table public.task_tags add column if not exists space_id uuid references public.spaces(id) on delete cascade;
alter table public.notebook_settings add column if not exists space_id uuid references public.spaces(id) on delete cascade;
alter table public.task_status_events add column if not exists space_id uuid references public.spaces(id) on delete cascade;
alter table public.task_due_date_events add column if not exists space_id uuid references public.spaces(id) on delete cascade;
alter table public.subtask_completion_events add column if not exists space_id uuid references public.spaces(id) on delete cascade;

update public.notebooks notebook
set space_id = space.id
from public.spaces space
where notebook.space_id is null and space.slug = 'main';

update public.notebook_members member set space_id = notebook.space_id
from public.notebooks notebook where member.notebook_id = notebook.id and member.space_id is null;
update public.tasks task set space_id = notebook.space_id
from public.notebooks notebook where task.notebook_id = notebook.id and task.space_id is null;
update public.subtasks subtask set space_id = task.space_id
from public.tasks task where subtask.task_id = task.id and subtask.space_id is null;
update public.task_tags task_tag set space_id = task.space_id
from public.tasks task where task_tag.task_id = task.id and task_tag.space_id is null;
update public.notebook_settings setting set space_id = notebook.space_id
from public.notebooks notebook where setting.notebook_id = notebook.id and setting.space_id is null;
update public.task_status_events event set space_id = notebook.space_id
from public.notebooks notebook where event.notebook_id = notebook.id and event.space_id is null;
update public.task_due_date_events event set space_id = notebook.space_id
from public.notebooks notebook where event.notebook_id = notebook.id and event.space_id is null;
update public.subtask_completion_events event set space_id = notebook.space_id
from public.notebooks notebook where event.notebook_id = notebook.id and event.space_id is null;

-- Preserve access for an existing regular owner when migrating legacy notebooks.
insert into public.notebook_members (notebook_id, user_id, role, permissions, space_id)
select notebook.id, notebook.owner_id, 'user'::public.notebook_member_role,
  '{"manage_tasks": true, "manage_notebook": false, "manage_settings": false}'::jsonb,
  notebook.space_id
from public.notebooks notebook
join public.profiles profile on profile.id = notebook.owner_id and profile.role = 'user' and profile.is_active
on conflict (notebook_id, user_id) do update set space_id = excluded.space_id;

alter table public.notebooks alter column space_id set not null;
alter table public.notebook_members alter column space_id set not null;
alter table public.tasks alter column space_id set not null;
alter table public.subtasks alter column space_id set not null;
alter table public.task_tags alter column space_id set not null;
alter table public.notebook_settings alter column space_id set not null;
alter table public.task_status_events alter column space_id set not null;
alter table public.task_due_date_events alter column space_id set not null;
alter table public.subtask_completion_events alter column space_id set not null;

create index if not exists notebooks_space_access_idx on public.notebooks (space_id, last_accessed_at desc);
create index if not exists tasks_space_notebook_idx on public.tasks (space_id, notebook_id);
create index if not exists subtasks_space_task_idx on public.subtasks (space_id, task_id);
create index if not exists task_tags_space_task_idx on public.task_tags (space_id, task_id);
create index if not exists task_status_events_space_changed_idx
  on public.task_status_events (space_id, changed_at desc);
create index if not exists task_due_date_events_space_changed_idx
  on public.task_due_date_events (space_id, changed_at desc);
create index if not exists subtask_completion_events_space_changed_idx
  on public.subtask_completion_events (space_id, changed_at desc);

insert into public.space_settings (space_id, tags, assistant_intents)
select distinct on (notebook.space_id)
  notebook.space_id,
  setting.tags,
  setting.assistant_intents
from public.notebooks notebook
join public.notebook_settings setting on setting.notebook_id = notebook.id
order by notebook.space_id, notebook.created_at
on conflict (space_id) do nothing;

insert into public.space_settings (space_id)
select space.id from public.spaces space
on conflict (space_id) do nothing;

create or replace function private.set_notebook_child_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select notebook.space_id into new.space_id
  from public.notebooks notebook where notebook.id = new.notebook_id;
  if new.space_id is null then
    raise exception 'Unable to resolve notebook space' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function private.set_task_child_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select task.space_id into new.space_id
  from public.tasks task where task.id = new.task_id;
  if new.space_id is null then
    raise exception 'Unable to resolve task space' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_notebook_space_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.space_id is distinct from new.space_id then
    raise exception 'Moving a notebook between spaces is not supported' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists notebooks_prevent_space_change on public.notebooks;
create trigger notebooks_prevent_space_change before update of space_id on public.notebooks
  for each row execute function private.prevent_notebook_space_change();

drop trigger if exists notebook_members_set_space on public.notebook_members;
create trigger notebook_members_set_space before insert or update of notebook_id, space_id on public.notebook_members
  for each row execute function private.set_notebook_child_space();
drop trigger if exists tasks_set_space on public.tasks;
create trigger tasks_set_space before insert or update of notebook_id, space_id on public.tasks
  for each row execute function private.set_notebook_child_space();
drop trigger if exists notebook_settings_set_space on public.notebook_settings;
create trigger notebook_settings_set_space before insert or update of notebook_id, space_id on public.notebook_settings
  for each row execute function private.set_notebook_child_space();
drop trigger if exists task_status_events_set_space on public.task_status_events;
create trigger task_status_events_set_space before insert or update of notebook_id, space_id on public.task_status_events
  for each row execute function private.set_notebook_child_space();
drop trigger if exists task_due_date_events_set_space on public.task_due_date_events;
create trigger task_due_date_events_set_space before insert or update of notebook_id, space_id on public.task_due_date_events
  for each row execute function private.set_notebook_child_space();
drop trigger if exists subtask_completion_events_set_space on public.subtask_completion_events;
create trigger subtask_completion_events_set_space before insert or update of notebook_id, space_id on public.subtask_completion_events
  for each row execute function private.set_notebook_child_space();
drop trigger if exists subtasks_set_space on public.subtasks;
create trigger subtasks_set_space before insert or update of task_id, space_id on public.subtasks
  for each row execute function private.set_task_child_space();
drop trigger if exists task_tags_set_space on public.task_tags;
create trigger task_tags_set_space before insert or update of task_id, space_id on public.task_tags
  for each row execute function private.set_task_child_space();

drop trigger if exists spaces_set_updated_at on public.spaces;
create trigger spaces_set_updated_at before update on public.spaces
  for each row execute function private.set_updated_at();
drop trigger if exists space_members_set_updated_at on public.space_members;
create trigger space_members_set_updated_at before update on public.space_members
  for each row execute function private.set_updated_at();
drop trigger if exists space_settings_set_updated_at on public.space_settings;
create trigger space_settings_set_updated_at before update on public.space_settings
  for each row execute function private.set_updated_at();

create or replace function private.can_access_space(
  requested_space_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_superadmin(requested_user_id)
    or exists (
      select 1 from public.space_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.space_id = requested_space_id and member.user_id = requested_user_id
    );
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nickname, role)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    left(coalesce(new.raw_user_meta_data ->> 'nickname', ''), 100),
    'user'
  )
  on conflict (id) do update set
    email = excluded.email,
    nickname = case
      when excluded.nickname = '' then public.profiles.nickname
      else excluded.nickname
    end;
  return new;
end;
$$;

create or replace function private.is_space_admin(
  requested_space_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_superadmin(requested_user_id)
    or exists (
      select 1 from public.space_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.space_id = requested_space_id
        and member.user_id = requested_user_id
        and member.role = 'admin'
    );
$$;

create or replace function private.can_access_notebook(
  requested_notebook_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.notebooks notebook
    where notebook.id = requested_notebook_id
      and (
        private.is_space_admin(notebook.space_id, requested_user_id)
        or exists (
          select 1 from public.notebook_members member
          join public.space_members space_member
            on space_member.space_id = notebook.space_id
            and space_member.user_id = member.user_id
            and space_member.role = 'user'
          join public.profiles profile on profile.id = member.user_id and profile.is_active
          where member.notebook_id = notebook.id and member.user_id = requested_user_id
        )
      )
  );
$$;

create or replace function private.has_notebook_permission(
  requested_notebook_id uuid,
  permission_name text,
  requested_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.notebooks notebook
    where notebook.id = requested_notebook_id
      and (
        private.is_space_admin(notebook.space_id, requested_user_id)
        or exists (
          select 1 from public.notebook_members member
          join public.space_members space_member
            on space_member.space_id = notebook.space_id
            and space_member.user_id = member.user_id
            and space_member.role = 'user'
          join public.profiles profile on profile.id = member.user_id and profile.is_active
          where member.notebook_id = notebook.id
            and member.user_id = requested_user_id
            and permission_name = 'manage_tasks'
            and coalesce((member.permissions ->> 'manage_tasks')::boolean, true)
        )
      )
  );
$$;

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_settings enable row level security;
alter table public.user_admin_audit_events enable row level security;

create policy spaces_select_members on public.spaces for select to authenticated
  using (private.can_access_space(id));
create policy spaces_manage_superadmin on public.spaces for all to authenticated
  using (private.is_superadmin()) with check (private.is_superadmin());
create policy space_members_select_members on public.space_members for select to authenticated
  using (user_id = auth.uid() or private.is_space_admin(space_id));
create policy space_members_manage_superadmin on public.space_members for all to authenticated
  using (private.is_superadmin()) with check (private.is_superadmin());
create policy space_settings_select_members on public.space_settings for select to authenticated
  using (private.can_access_space(space_id));
create policy space_settings_manage_admins on public.space_settings for all to authenticated
  using (private.is_space_admin(space_id)) with check (private.is_space_admin(space_id));
create policy user_admin_audit_select_superadmin on public.user_admin_audit_events for select to authenticated
  using (private.is_superadmin());

drop policy if exists profiles_select_own_or_superadmin on public.profiles;
create policy profiles_select_own_or_superadmin on public.profiles for select to authenticated
  using (
    id = auth.uid() or private.is_superadmin()
    or exists (
      select 1 from public.space_members viewer
      join public.space_members target on target.space_id = viewer.space_id and target.user_id = profiles.id
      where viewer.user_id = auth.uid() and viewer.role = 'admin'
    )
  );

drop policy if exists notebooks_select_members on public.notebooks;
drop policy if exists notebooks_insert_superadmin on public.notebooks;
drop policy if exists notebooks_update_managers on public.notebooks;
drop policy if exists notebooks_delete_managers on public.notebooks;
create policy notebooks_select_members on public.notebooks for select to authenticated
  using (private.can_access_notebook(id));
create policy notebooks_insert_admins on public.notebooks for insert to authenticated
  with check (private.is_space_admin(space_id));
create policy notebooks_update_admins on public.notebooks for update to authenticated
  using (private.is_space_admin(space_id)) with check (private.is_space_admin(space_id));
create policy notebooks_delete_admins on public.notebooks for delete to authenticated
  using (private.is_space_admin(space_id));

drop policy if exists notebook_members_select_members on public.notebook_members;
drop policy if exists notebook_members_manage_notebook on public.notebook_members;
create policy notebook_members_select_members on public.notebook_members for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy notebook_members_manage_space_admin on public.notebook_members for all to authenticated
  using (private.is_space_admin(space_id)) with check (private.is_space_admin(space_id));

drop policy if exists notebook_settings_select_members on public.notebook_settings;
drop policy if exists notebook_settings_insert_managers on public.notebook_settings;
drop policy if exists notebook_settings_update_managers on public.notebook_settings;
create policy notebook_settings_select_members on public.notebook_settings for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy notebook_settings_manage_admins on public.notebook_settings for all to authenticated
  using (private.is_space_admin(space_id)) with check (private.is_space_admin(space_id));

create or replace function public.save_space(
  requested_space_id uuid,
  requested_name text,
  requested_slug text,
  requested_admin_ids uuid[] default '{}'::uuid[],
  requested_user_ids uuid[] default '{}'::uuid[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_space_id uuid;
begin
  if not private.is_superadmin() then
    raise exception 'Not authorized to manage spaces' using errcode = '42501';
  end if;
  if length(btrim(requested_name)) not between 1 and 100
     or requested_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or length(requested_slug) not between 2 and 80 then
    raise exception 'Invalid space name or slug' using errcode = '22023';
  end if;
  if cardinality(coalesce(requested_admin_ids, '{}'::uuid[])) = 0 then
    raise exception 'A space must have at least one admin' using errcode = '22023';
  end if;

  saved_space_id := coalesce(requested_space_id, gen_random_uuid());
  insert into public.spaces (id, name, slug, created_by)
  values (saved_space_id, btrim(requested_name), lower(requested_slug), auth.uid())
  on conflict (id) do update set name = excluded.name, slug = excluded.slug;

  insert into public.space_settings (space_id) values (saved_space_id) on conflict do nothing;
  delete from public.space_members where space_id = saved_space_id;

  update public.profiles set role = 'admin'
  where id = any(requested_admin_ids) and role <> 'superadmin' and is_active;

  insert into public.space_members (space_id, user_id, role)
  select saved_space_id, profile.id, 'admin'::public.space_member_role
  from public.profiles profile
  where profile.id = any(requested_admin_ids) and profile.is_active
  on conflict (space_id, user_id) do update set role = excluded.role;

  insert into public.space_members (space_id, user_id, role)
  select saved_space_id, profile.id, 'user'::public.space_member_role
  from public.profiles profile
  where profile.id = any(requested_user_ids)
    and profile.is_active
    and not (profile.id = any(requested_admin_ids))
  on conflict (space_id, user_id) do update set role = excluded.role;

  delete from public.notebook_members notebook_member
  where notebook_member.space_id = saved_space_id
    and not exists (
      select 1 from public.space_members member
      where member.space_id = saved_space_id and member.user_id = notebook_member.user_id
    );

  return saved_space_id;
end;
$$;

create or replace function public.delete_space(requested_space_id uuid, confirmation_slug text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_superadmin() then
    raise exception 'Not authorized to delete spaces' using errcode = '42501';
  end if;
  delete from public.spaces
  where id = requested_space_id and slug = lower(btrim(confirmation_slug));
  if not found then raise exception 'Space confirmation did not match' using errcode = '22023'; end if;
end;
$$;

create or replace function public.set_notebook_users(
  requested_notebook_id uuid,
  requested_user_ids uuid[] default '{}'::uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare parent_space_id uuid;
begin
  select notebook.space_id into parent_space_id from public.notebooks notebook
  where notebook.id = requested_notebook_id;
  if parent_space_id is null or not private.is_space_admin(parent_space_id) then
    raise exception 'Not authorized to assign notebook users' using errcode = '42501';
  end if;

  delete from public.notebook_members
  where notebook_id = requested_notebook_id and role = 'user';

  insert into public.notebook_members (notebook_id, space_id, user_id, role, permissions)
  select requested_notebook_id, parent_space_id, member.user_id, 'user',
    '{"manage_tasks": true, "manage_notebook": false, "manage_settings": false}'::jsonb
  from public.space_members member
  join public.profiles profile on profile.id = member.user_id and profile.is_active
  where member.space_id = parent_space_id
    and member.role = 'user'
    and member.user_id = any(requested_user_ids)
  on conflict (notebook_id, user_id) do update set permissions = excluded.permissions;
end;
$$;

revoke all on function public.save_space(uuid, text, text, uuid[], uuid[]) from public, anon;
grant execute on function public.save_space(uuid, text, text, uuid[], uuid[]) to authenticated;
revoke all on function public.delete_space(uuid, text) from public, anon;
grant execute on function public.delete_space(uuid, text) to authenticated;
revoke all on function public.set_notebook_users(uuid, uuid[]) from public, anon;
grant execute on function public.set_notebook_users(uuid, uuid[]) to authenticated;

revoke insert, update, delete on public.notebook_members from authenticated;
grant select on public.spaces to authenticated;
grant select on public.space_members to authenticated;
grant select, insert, update on public.space_settings to authenticated;
grant select on public.user_admin_audit_events to authenticated;

commit;
