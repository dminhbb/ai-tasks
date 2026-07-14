-- The RPC must be able to call private permission helpers without exposing the
-- private schema to authenticated clients. Authorization is still enforced by
-- private.has_notebook_permission() at the start of save_task_bundle().
alter function public.save_task_bundle(uuid, jsonb, jsonb, jsonb)
  security definer;

alter function public.save_task_bundle(uuid, jsonb, jsonb, jsonb)
  set search_path = '';

