begin;

drop policy if exists notebooks_insert_authorized_space_admins on public.notebooks;
drop function if exists private.can_create_notebook(uuid, uuid, uuid);

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

commit;
