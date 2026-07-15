begin;

drop function if exists public.create_notebook_in_space(uuid, text);
drop function if exists public.list_accessible_spaces();

drop policy if exists notebooks_insert_admins_v2 on public.notebooks;
create policy notebooks_insert_admins on public.notebooks
  for insert to authenticated
  with check (private.is_space_admin(space_id));

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

  return saved_space_id;
end;
$$;

-- Default Notebooks are retained because they may contain user data after deployment.

commit;
