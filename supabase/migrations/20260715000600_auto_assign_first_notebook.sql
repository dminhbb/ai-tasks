begin;

create or replace function private.assign_space_user_first_notebook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_notebook_id uuid;
begin
  if new.role <> 'user' then
    return new;
  end if;

  if exists (
    select 1 from public.notebook_members member
    where member.space_id = new.space_id and member.user_id = new.user_id
  ) then
    return new;
  end if;

  select notebook.id into first_notebook_id
  from public.notebooks notebook
  where notebook.space_id = new.space_id
  order by notebook.created_at, notebook.id
  limit 1;

  if first_notebook_id is not null then
    insert into public.notebook_members (notebook_id, space_id, user_id, role, permissions)
    values (
      first_notebook_id,
      new.space_id,
      new.user_id,
      'user',
      '{"manage_tasks": true, "manage_notebook": false, "manage_settings": false}'::jsonb
    )
    on conflict (notebook_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function private.assign_new_notebook_unassigned_space_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notebook_members (notebook_id, space_id, user_id, role, permissions)
  select
    new.id,
    new.space_id,
    member.user_id,
    'user',
    '{"manage_tasks": true, "manage_notebook": false, "manage_settings": false}'::jsonb
  from public.space_members member
  join public.profiles profile on profile.id = member.user_id and profile.is_active
  where member.space_id = new.space_id
    and member.role = 'user'
    and not exists (
      select 1 from public.notebook_members notebook_member
      where notebook_member.space_id = new.space_id
        and notebook_member.user_id = member.user_id
    )
  on conflict (notebook_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists space_members_assign_first_notebook on public.space_members;
create trigger space_members_assign_first_notebook
  after insert or update of space_id, user_id, role on public.space_members
  for each row execute function private.assign_space_user_first_notebook();

drop trigger if exists notebooks_assign_unassigned_space_users on public.notebooks;
create trigger notebooks_assign_unassigned_space_users
  after insert on public.notebooks
  for each row execute function private.assign_new_notebook_unassigned_space_users();

insert into public.notebook_members (notebook_id, space_id, user_id, role, permissions)
select
  first_notebook.id,
  member.space_id,
  member.user_id,
  'user',
  '{"manage_tasks": true, "manage_notebook": false, "manage_settings": false}'::jsonb
from public.space_members member
join public.profiles profile on profile.id = member.user_id and profile.is_active
join lateral (
  select notebook.id
  from public.notebooks notebook
  where notebook.space_id = member.space_id
  order by notebook.created_at, notebook.id
  limit 1
) first_notebook on true
where member.role = 'user'
  and not exists (
    select 1 from public.notebook_members notebook_member
    where notebook_member.space_id = member.space_id
      and notebook_member.user_id = member.user_id
  )
on conflict (notebook_id, user_id) do nothing;

commit;
