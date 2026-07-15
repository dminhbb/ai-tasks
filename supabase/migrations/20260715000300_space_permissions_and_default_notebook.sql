begin;

create or replace function public.list_accessible_spaces()
returns table (
  id uuid,
  name text,
  slug text,
  created_at timestamptz,
  updated_at timestamptz,
  is_admin boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    space.id,
    space.name,
    space.slug,
    space.created_at,
    space.updated_at,
    private.is_space_admin(space.id, auth.uid())
  from public.spaces space
  where private.can_access_space(space.id, auth.uid())
  order by space.name;
$$;

create or replace function public.create_notebook_in_space(
  requested_space_id uuid,
  requested_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_notebook_id uuid;
begin
  if not private.is_space_admin(requested_space_id, auth.uid()) then
    raise exception 'Not authorized to create notebooks in this space' using errcode = '42501';
  end if;
  if length(btrim(requested_name)) not between 1 and 80 then
    raise exception 'Invalid notebook name' using errcode = '22023';
  end if;

  insert into public.notebooks (space_id, owner_id, name)
  values (requested_space_id, auth.uid(), btrim(requested_name))
  returning id into saved_notebook_id;

  insert into public.notebook_settings (notebook_id)
  values (saved_notebook_id);

  return saved_notebook_id;
end;
$$;

drop policy if exists notebooks_insert_admins on public.notebooks;
drop policy if exists notebooks_insert_admins_v2 on public.notebooks;
create policy notebooks_insert_admins_v2 on public.notebooks
  for insert to authenticated
  with check (
    private.is_superadmin(auth.uid())
    or exists (
      select 1
      from public.space_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.space_id = notebooks.space_id
        and member.user_id = auth.uid()
        and member.role = 'admin'
    )
  );

create or replace function public.save_space(
  requested_space_id uuid,
  requested_name text,
  requested_slug text,
  requested_admin_ids uuid[] default '{}'::uuid[],
  requested_user_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_space_id uuid;
  is_new_space boolean := requested_space_id is null;
begin
  if not private.is_superadmin(auth.uid()) then
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

  if is_new_space then
    perform public.create_notebook_in_space(saved_space_id, 'Default Notebook');
  end if;

  return saved_space_id;
end;
$$;

do $$
declare
  target_space record;
  default_owner_id uuid;
  default_notebook_id uuid;
begin
  for target_space in
    select space.id, space.created_by
    from public.spaces space
    where not exists (select 1 from public.notebooks notebook where notebook.space_id = space.id)
  loop
    select coalesce(
      (select profile.id from public.profiles profile
       where profile.id = target_space.created_by and profile.is_active),
      (select member.user_id from public.space_members member
       join public.profiles profile on profile.id = member.user_id and profile.is_active
       where member.space_id = target_space.id and member.role = 'admin'
       order by member.created_at limit 1),
      (select profile.id from public.profiles profile
       where profile.role = 'superadmin' and profile.is_active
       order by profile.created_at limit 1)
    ) into default_owner_id;

    if default_owner_id is not null then
      insert into public.notebooks (space_id, owner_id, name)
      values (target_space.id, default_owner_id, 'Default Notebook')
      returning id into default_notebook_id;

      insert into public.notebook_settings (notebook_id)
      values (default_notebook_id);
    end if;
  end loop;
end;
$$;

revoke all on function public.list_accessible_spaces() from public, anon;
grant execute on function public.list_accessible_spaces() to authenticated;
revoke all on function public.create_notebook_in_space(uuid, text) from public, anon;
grant execute on function public.create_notebook_in_space(uuid, text) to authenticated;

commit;
