create or replace function public.admin_customer_directory(
  p_limit integer default 50,
  p_offset integer default 0,
  p_search text default null
)
returns table(
  id uuid,
  email text,
  full_name text,
  phone text,
  created_at timestamptz,
  order_count bigint,
  wallet_balance numeric,
  total_count bigint,
  total_wallet_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'Invalid customer directory page';
  end if;
  return query
  with filtered as (
    select cp.id, cp.email, cp.full_name, cp.phone, cp.created_at
    from public.customer_profiles cp
    where nullif(trim(p_search), '') is null
       or concat_ws(' ', cp.full_name, cp.email, cp.phone) ilike '%' || trim(p_search) || '%'
  ),
  page_rows as (
    select f.id, f.email, f.full_name, f.phone, f.created_at
    from filtered f
    order by f.created_at desc, f.id
    limit p_limit offset p_offset
  )
  select
    p.id, p.email, p.full_name, p.phone, p.created_at,
    coalesce(oc.order_count, 0)::bigint,
    coalesce(w.balance, 0)::numeric,
    (select count(*) from filtered)::bigint,
    coalesce((select sum(w2.balance) from public.wallets w2 join filtered f2 on f2.id=w2.user_id), 0)::numeric
  from page_rows p
  left join lateral (
    select count(*)::bigint as order_count
    from public.orders o where o.customer_id=p.id
  ) oc on true
  left join public.wallets w on w.user_id=p.id
  order by p.created_at desc, p.id;
end;
$$;

revoke all on function public.admin_customer_directory(integer,integer,text) from public, anon;
grant execute on function public.admin_customer_directory(integer,integer,text) to authenticated;
