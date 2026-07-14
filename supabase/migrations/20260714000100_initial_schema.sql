create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('superadmin', 'admin', 'user');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notebook_member_role as enum ('admin', 'user');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (length(btrim(email)) > 0)
);

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  constraint notebooks_name_length check (length(btrim(name)) between 1 and 80)
);

create index if not exists notebooks_owner_last_accessed_idx
  on public.notebooks (owner_id, last_accessed_at desc);

create table if not exists public.notebook_members (
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.notebook_member_role not null,
  permissions jsonb not null default '{"manage_tasks": true, "manage_notebook": false, "manage_settings": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (notebook_id, user_id),
  constraint notebook_members_permissions_object check (jsonb_typeof(permissions) = 'object')
);

create index if not exists notebook_members_user_idx
  on public.notebook_members (user_id, notebook_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  title text not null,
  details text not null default '',
  assignee text not null default '',
  status text not null default 'TO DO',
  progress integer not null default 0,
  sort_order integer not null default 0,
  start_date timestamptz,
  due_date timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  in_progress_at timestamptz,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint tasks_title_length check (length(btrim(title)) between 1 and 500),
  constraint tasks_status_valid check (status in ('URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE')),
  constraint tasks_progress_valid check (progress between 0 and 100),
  constraint tasks_sort_order_valid check (sort_order >= 0)
);

create index if not exists tasks_notebook_status_order_idx
  on public.tasks (notebook_id, status, sort_order);
create index if not exists tasks_notebook_due_date_idx
  on public.tasks (notebook_id, due_date);
create index if not exists tasks_notebook_assignee_idx
  on public.tasks (notebook_id, assignee);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subtasks_title_length check (length(btrim(title)) between 1 and 500),
  constraint subtasks_sort_order_valid check (sort_order >= 0)
);

create index if not exists subtasks_task_order_idx
  on public.subtasks (task_id, sort_order);

create table if not exists public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag text not null,
  primary key (task_id, tag),
  constraint task_tags_tag_length check (length(btrim(tag)) between 1 and 100)
);

create index if not exists task_tags_tag_idx on public.task_tags (tag);

create table if not exists public.notebook_settings (
  notebook_id uuid primary key references public.notebooks(id) on delete cascade,
  tags jsonb not null default '["Frontend", "Backend", "Design", "Bug", "Feature"]'::jsonb,
  assistant_intents jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notebook_settings_tags_array check (jsonb_typeof(tags) = 'array'),
  constraint notebook_settings_intents_array check (jsonb_typeof(assistant_intents) = 'array')
);

create table if not exists public.task_status_events (
  id bigint generated always as identity primary key,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now()
);

create index if not exists task_status_events_notebook_task_idx
  on public.task_status_events (notebook_id, task_id, changed_at desc);

create table if not exists public.task_due_date_events (
  id bigint generated always as identity primary key,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_due_date timestamptz,
  to_due_date timestamptz,
  changed_at timestamptz not null default now()
);

create index if not exists task_due_date_events_notebook_task_idx
  on public.task_due_date_events (notebook_id, task_id, changed_at desc);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_superadmin(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = requested_user_id
      and profile.role = 'superadmin'
      and profile.is_active
  );
$$;

create or replace function private.can_access_notebook(requested_notebook_id uuid, requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_superadmin(requested_user_id)
    or exists (
      select 1
      from public.notebooks notebook
      join public.profiles profile on profile.id = requested_user_id and profile.is_active
      where notebook.id = requested_notebook_id
        and notebook.owner_id = requested_user_id
    )
    or exists (
      select 1
      from public.notebook_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.notebook_id = requested_notebook_id
        and member.user_id = requested_user_id
    );
$$;

create or replace function private.has_notebook_permission(
  requested_notebook_id uuid,
  permission_name text,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_superadmin(requested_user_id)
    or exists (
      select 1
      from public.notebook_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.notebook_id = requested_notebook_id
        and member.user_id = requested_user_id
        and case permission_name
          when 'manage_tasks' then coalesce((member.permissions ->> 'manage_tasks')::boolean, true)
          when 'manage_notebook' then profile.role = 'admin' and member.role = 'admin' and coalesce((member.permissions ->> 'manage_notebook')::boolean, false)
          when 'manage_settings' then profile.role = 'admin' and member.role = 'admin' and coalesce((member.permissions ->> 'manage_settings')::boolean, false)
          else false
        end
    );
$$;

create or replace function private.task_notebook_id(requested_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select task.notebook_id from public.tasks task where task.id = requested_task_id;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, new.id::text), 'user')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function private.record_task_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_status_events (notebook_id, task_id, from_status, to_status, changed_at)
    values (new.notebook_id, new.id, null, new.status, coalesce(new.created_at, now()));
  else
    if old.status is distinct from new.status then
      insert into public.task_status_events (notebook_id, task_id, from_status, to_status)
      values (new.notebook_id, new.id, old.status, new.status);
    end if;
    if old.due_date is distinct from new.due_date then
      insert into public.task_due_date_events (notebook_id, task_id, from_due_date, to_due_date)
      values (new.notebook_id, new.id, old.due_date, new.due_date);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function private.handle_new_auth_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
drop trigger if exists notebooks_set_updated_at on public.notebooks;
create trigger notebooks_set_updated_at before update on public.notebooks
  for each row execute function private.set_updated_at();
drop trigger if exists notebook_members_set_updated_at on public.notebook_members;
create trigger notebook_members_set_updated_at before update on public.notebook_members
  for each row execute function private.set_updated_at();
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();
drop trigger if exists subtasks_set_updated_at on public.subtasks;
create trigger subtasks_set_updated_at before update on public.subtasks
  for each row execute function private.set_updated_at();
drop trigger if exists notebook_settings_set_updated_at on public.notebook_settings;
create trigger notebook_settings_set_updated_at before update on public.notebook_settings
  for each row execute function private.set_updated_at();
drop trigger if exists tasks_record_history on public.tasks;
create trigger tasks_record_history after insert or update of status, due_date on public.tasks
  for each row execute function private.record_task_history();

insert into public.profiles (id, email, role)
select auth_user.id, coalesce(auth_user.email, auth_user.id::text), 'user'
from auth.users auth_user
on conflict (id) do update set email = excluded.email;

alter table public.profiles enable row level security;
alter table public.notebooks enable row level security;
alter table public.notebook_members enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_tags enable row level security;
alter table public.notebook_settings enable row level security;
alter table public.task_status_events enable row level security;
alter table public.task_due_date_events enable row level security;

create policy profiles_select_own_or_superadmin on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.is_superadmin());
create policy profiles_superadmin_all on public.profiles
  for all to authenticated
  using (private.is_superadmin())
  with check (private.is_superadmin());

create policy notebooks_select_members on public.notebooks
  for select to authenticated
  using (private.can_access_notebook(id));
create policy notebooks_insert_superadmin on public.notebooks
  for insert to authenticated
  with check (private.is_superadmin() and owner_id = auth.uid());
create policy notebooks_update_managers on public.notebooks
  for update to authenticated
  using (private.has_notebook_permission(id, 'manage_notebook'))
  with check (private.has_notebook_permission(id, 'manage_notebook'));
create policy notebooks_delete_managers on public.notebooks
  for delete to authenticated
  using (private.has_notebook_permission(id, 'manage_notebook'));

create policy notebook_members_select_members on public.notebook_members
  for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy notebook_members_manage_notebook on public.notebook_members
  for all to authenticated
  using (private.has_notebook_permission(notebook_id, 'manage_notebook'))
  with check (private.has_notebook_permission(notebook_id, 'manage_notebook'));

create policy tasks_select_members on public.tasks
  for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy tasks_insert_editors on public.tasks
  for insert to authenticated
  with check (private.has_notebook_permission(notebook_id, 'manage_tasks'));
create policy tasks_update_editors on public.tasks
  for update to authenticated
  using (private.has_notebook_permission(notebook_id, 'manage_tasks'))
  with check (private.has_notebook_permission(notebook_id, 'manage_tasks'));
create policy tasks_delete_editors on public.tasks
  for delete to authenticated
  using (private.has_notebook_permission(notebook_id, 'manage_tasks'));

create policy subtasks_select_members on public.subtasks
  for select to authenticated
  using (private.can_access_notebook(private.task_notebook_id(task_id)));
create policy subtasks_insert_editors on public.subtasks
  for insert to authenticated
  with check (private.has_notebook_permission(private.task_notebook_id(task_id), 'manage_tasks'));
create policy subtasks_update_editors on public.subtasks
  for update to authenticated
  using (private.has_notebook_permission(private.task_notebook_id(task_id), 'manage_tasks'))
  with check (private.has_notebook_permission(private.task_notebook_id(task_id), 'manage_tasks'));
create policy subtasks_delete_editors on public.subtasks
  for delete to authenticated
  using (private.has_notebook_permission(private.task_notebook_id(task_id), 'manage_tasks'));

create policy task_tags_select_members on public.task_tags
  for select to authenticated
  using (private.can_access_notebook(private.task_notebook_id(task_id)));
create policy task_tags_insert_editors on public.task_tags
  for insert to authenticated
  with check (private.has_notebook_permission(private.task_notebook_id(task_id), 'manage_tasks'));
create policy task_tags_delete_editors on public.task_tags
  for delete to authenticated
  using (private.has_notebook_permission(private.task_notebook_id(task_id), 'manage_tasks'));

create policy notebook_settings_select_members on public.notebook_settings
  for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy notebook_settings_insert_managers on public.notebook_settings
  for insert to authenticated
  with check (private.has_notebook_permission(notebook_id, 'manage_settings'));
create policy notebook_settings_update_managers on public.notebook_settings
  for update to authenticated
  using (private.has_notebook_permission(notebook_id, 'manage_settings'))
  with check (private.has_notebook_permission(notebook_id, 'manage_settings'));

create policy task_status_events_select_members on public.task_status_events
  for select to authenticated
  using (private.can_access_notebook(notebook_id));
create policy task_due_date_events_select_members on public.task_due_date_events
  for select to authenticated
  using (private.can_access_notebook(notebook_id));

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.notebooks to authenticated;
grant select, insert, update, delete on public.notebook_members to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.subtasks to authenticated;
grant select, insert, delete on public.task_tags to authenticated;
grant select, insert, update on public.notebook_settings to authenticated;
grant select on public.task_status_events to authenticated;
grant select on public.task_due_date_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;
