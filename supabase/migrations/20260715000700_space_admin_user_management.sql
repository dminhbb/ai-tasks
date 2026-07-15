begin;

create or replace function public.set_space_users(
  requested_space_id uuid,
  requested_user_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_space_admin(requested_space_id, auth.uid()) then
    raise exception 'Not authorized to manage users in this space' using errcode = '42501';
  end if;

  delete from public.space_members
  where space_id = requested_space_id and role = 'user';

  insert into public.space_members (space_id, user_id, role)
  select requested_space_id, profile.id, 'user'::public.space_member_role
  from public.profiles profile
  where profile.id = any(coalesce(requested_user_ids, '{}'::uuid[]))
    and profile.role = 'user'
    and profile.is_active
  on conflict (space_id, user_id) do update set role = excluded.role;

  delete from public.notebook_members notebook_member
  where notebook_member.space_id = requested_space_id
    and not exists (
      select 1 from public.space_members member
      where member.space_id = requested_space_id
        and member.user_id = notebook_member.user_id
    );
end;
$$;

revoke all on function public.set_space_users(uuid, uuid[]) from public, anon;
grant execute on function public.set_space_users(uuid, uuid[]) to authenticated;

commit;
