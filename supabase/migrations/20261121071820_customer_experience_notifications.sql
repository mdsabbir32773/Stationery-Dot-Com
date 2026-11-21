create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  deposit_request_id uuid references public.deposit_requests(id) on delete set null,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('order','payment','deposit','account')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.customer_notifications enable row level security;
create index if not exists idx_customer_notifications_user_created
  on public.customer_notifications(user_id, created_at desc);
create index if not exists idx_customer_notifications_unread
  on public.customer_notifications(user_id, created_at desc) where read_at is null;

drop policy if exists "customers read own notifications" on public.customer_notifications;
create policy "customers read own notifications"
  on public.customer_notifications for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.notify_customer_order_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_title text; v_message text;
begin
  if new.customer_id is null or new.status is not distinct from old.status then return new; end if;
  v_title := case new.status
    when 'Payment Received' then 'Payment confirmed'
    when 'Processing' then 'Your order is processing'
    when 'Completed' then 'Your order is completed'
    when 'Cancelled' then 'Your order was cancelled'
    when 'Refunded' then 'Your order was refunded'
    else 'Order status updated' end;
  v_message := 'Order ' || coalesce(new.order_code, '') || ' is now ' || new.status || '.';
  insert into public.customer_notifications(user_id, order_id, title, message, type)
  values (new.customer_id, new.id, v_title, v_message, 'order');
  return new;
end; $$;

create or replace function public.notify_customer_deposit_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_title text; v_message text;
begin
  if new.user_id is null or new.status is not distinct from old.status then return new; end if;
  if new.status not in ('Approved','Rejected') then return new; end if;
  v_title := case when new.status = 'Approved' then 'Wallet deposit approved' else 'Wallet deposit not approved' end;
  v_message := 'Your ' || coalesce(new.method, 'payment') || ' deposit request for ৳' ||
    to_char(new.amount, 'FM999,999,990.00') || ' was ' || lower(new.status) || '.';
  if nullif(trim(coalesce(new.admin_note, '')), '') is not null then
    v_message := v_message || ' Note: ' || left(trim(new.admin_note), 300);
  end if;
  insert into public.customer_notifications(user_id, deposit_request_id, title, message, type)
  values (new.user_id, new.id, v_title, v_message, 'deposit');
  return new;
end; $$;

drop trigger if exists trg_notify_customer_order_status on public.orders;
create trigger trg_notify_customer_order_status after update of status on public.orders
for each row execute function public.notify_customer_order_status();
drop trigger if exists trg_notify_customer_deposit_status on public.deposit_requests;
create trigger trg_notify_customer_deposit_status after update of status on public.deposit_requests
for each row execute function public.notify_customer_deposit_status();

create or replace function public.mark_customer_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.customer_notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = auth.uid();
  return found;
end; $$;

create or replace function public.mark_all_customer_notifications_read()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.customer_notifications set read_at = now()
  where user_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

revoke all on function public.notify_customer_order_status() from public, anon, authenticated;
revoke all on function public.notify_customer_deposit_status() from public, anon, authenticated;
revoke all on function public.mark_customer_notification_read(uuid) from public, anon, authenticated;
revoke all on function public.mark_all_customer_notifications_read() from public, anon, authenticated;
grant select on public.customer_notifications to authenticated;
grant execute on function public.mark_customer_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_customer_notifications_read() to authenticated;
