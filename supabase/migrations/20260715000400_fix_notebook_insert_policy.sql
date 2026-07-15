begin;

create or replace function private.can_create_notebook(
  requested_space_id uuid,
  requested_owner_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_user_id is not null
    and requested_owner_id = requested_user_id
    and private.is_space_admin(requested_space_id, requested_user_id);
$$;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policy.policyname
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'notebooks'
      and policy.cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.notebooks', policy_record.policyname);
  end loop;
end;
$$;

create policy notebooks_insert_authorized_space_admins on public.notebooks
  for insert to authenticated
  with check (private.can_create_notebook(space_id, owner_id, auth.uid()));

commit;
