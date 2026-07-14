create table if not exists public.ai_request_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index if not exists ai_request_log_user_requested_idx
  on public.ai_request_log (user_id, requested_at desc);

alter table public.ai_request_log enable row level security;
revoke all on public.ai_request_log from public, anon, authenticated;

create or replace function public.consume_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  recent_requests integer;
begin
  if current_user_id is null then
    return false;
  end if;

  delete from public.ai_request_log
  where requested_at < now() - interval '1 day';

  select count(*) into recent_requests
  from public.ai_request_log
  where user_id = current_user_id
    and requested_at >= now() - interval '5 minutes';

  if recent_requests >= 20 then
    return false;
  end if;

  insert into public.ai_request_log (user_id) values (current_user_id);
  return true;
end;
$$;

revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

