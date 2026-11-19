-- Compact customer-facing order codes and realtime admin alerts.
-- Run once in Supabase SQL Editor after the existing schema and SMM panel migrations.

-- Keep existing order IDs unchanged. Only newly created orders get the compact SDyymmdd-XXXXXXXX format.
do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.create_order(jsonb)'::regprocedure);
  v_new := regexp_replace(
    v_def,
    $re$code\s*:=\s*'STDC-'\s*\|\|\s*to_char\(d,\s*'YYYYMMDD'\)\s*\|\|\s*'-'\s*\|\|\s*upper\(encode\(gen_random_bytes\(12\),\s*'hex'\)\)$re$,
    $rep$code := 'SD' || to_char(d, 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8))$rep$,
    'i'
  );
  if v_new = v_def then
    raise exception 'Could not update create_order order-code format; existing function differs from expected version.';
  end if;
  execute v_new;

  v_def := pg_get_functiondef('public.create_smm_order(jsonb)'::regprocedure);
  v_new := regexp_replace(
    v_def,
    $re$code\s*:=\s*'STDC-'\s*\|\|\s*to_char\(d,\s*'YYYYMMDD'\)\s*\|\|\s*'-'\s*\|\|\s*lpad\(seq::text,\s*3,\s*'0'\)$re$,
    $rep$code := 'SD' || to_char(d, 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8))$rep$,
    'i'
  );
  if v_new = v_def then
    raise exception 'Could not update create_smm_order order-code format; existing function differs from expected version.';
  end if;
  execute v_new;
end $$;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  deposit_request_id uuid references public.deposit_requests(id) on delete cascade,
  type text not null default 'order' check(type in ('order','deposit')),
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.admin_notifications add column if not exists deposit_request_id uuid references public.deposit_requests(id) on delete cascade;
alter table public.admin_notifications add column if not exists type text not null default 'order';
create index if not exists admin_notifications_created_at_idx on public.admin_notifications(created_at desc);

alter table public.admin_notifications enable row level security;
drop policy if exists "admin reads notifications" on public.admin_notifications;
create policy "admin reads notifications" on public.admin_notifications for select to authenticated using(public.is_admin());
drop policy if exists "admin updates notifications" on public.admin_notifications;
create policy "admin updates notifications" on public.admin_notifications for update to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,update on public.admin_notifications to authenticated;

create or replace function public.notify_admin_new_order()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.admin_notifications(type,order_id,title,message)
  values('order',new.id,'New order received',coalesce(new.customer_name,'Customer')||' placed '||new.order_code||' · ৳'||to_char(new.total,'FM999,999,990.00'));
  return new;
end $$;

create or replace function public.notify_admin_new_deposit()
returns trigger language plpgsql security definer set search_path=public as $$
declare customer_name text;
begin
  select coalesce(nullif(full_name,''),nullif(email,''),'Customer')
    into customer_name from public.customer_profiles where id=new.user_id;
  insert into public.admin_notifications(type,deposit_request_id,title,message)
  values('deposit',new.id,'New deposit request',coalesce(customer_name,'Customer')||' requested ৳'||to_char(new.amount,'FM999,999,990.00')||' via '||new.method);
  return new;
end $$;

drop trigger if exists admin_notify_order_insert on public.orders;
create trigger admin_notify_order_insert after insert on public.orders
for each row execute function public.notify_admin_new_order();

drop trigger if exists admin_notify_deposit_insert on public.deposit_requests;
create trigger admin_notify_deposit_insert after insert on public.deposit_requests
for each row execute function public.notify_admin_new_deposit();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='admin_notifications'
  ) then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end $$;
