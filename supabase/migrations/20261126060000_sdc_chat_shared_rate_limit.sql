create table if not exists public.sdc_chat_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count >= 1),
  updated_at timestamptz not null default now()
);

alter table public.sdc_chat_rate_limits enable row level security;
revoke all on table public.sdc_chat_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.sdc_chat_rate_limits to service_role;

create or replace function public.sdc_chat_consume_rate_limit(
  p_ip_hash text,
  p_max_requests integer default 20,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_max_requests < 1 or p_max_requests > 100
     or p_window_seconds < 1 or p_window_seconds > 3600 then
    return false;
  end if;

  insert into public.sdc_chat_rate_limits as current_limit
    (ip_hash, window_started_at, request_count, updated_at)
  values (p_ip_hash, now(), 1, now())
  on conflict (ip_hash) do update
    set window_started_at = case
          when current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now() else current_limit.window_started_at end,
        request_count = case
          when current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1 else current_limit.request_count + 1 end,
        updated_at = now()
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.sdc_chat_consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.sdc_chat_consume_rate_limit(text, integer, integer) to service_role;