begin;

create or replace function private.can_access_notebook_row(
  requested_notebook_id uuid,
  requested_space_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_space_admin(requested_space_id, requested_user_id)
    or exists (
      select 1
      from public.notebook_members member
      join public.space_members space_member
        on space_member.space_id = requested_space_id
        and space_member.user_id = member.user_id
        and space_member.role = 'user'
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.notebook_id = requested_notebook_id
        and member.user_id = requested_user_id
    );
$$;

drop policy if exists notebooks_select_members on public.notebooks;
create policy notebooks_select_members on public.notebooks
  for select to authenticated
  using (private.can_access_notebook_row(id, space_id, auth.uid()));

commit;
