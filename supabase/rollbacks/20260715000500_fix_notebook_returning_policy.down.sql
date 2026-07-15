begin;

drop policy if exists notebooks_select_members on public.notebooks;
create policy notebooks_select_members on public.notebooks
  for select to authenticated
  using (private.can_access_notebook(id));

drop function if exists private.can_access_notebook_row(uuid, uuid, uuid);

commit;
