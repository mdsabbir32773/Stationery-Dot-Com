-- Phase 1: secure order tracking and atomic admin order/payment workflows.
drop function if exists public.track_order(text);
create or replace function public.track_order(p_code text, p_phone text)
returns json language sql security definer set search_path=public as $$
 select json_build_object('order_code',o.order_code,'service_name',o.service_name,'package_name',o.package_name,'quantity',o.quantity,'total',o.total,'status',o.status,'created_at',o.created_at,
 'payment_status',(select status from public.payments where order_id=o.id order by created_at desc limit 1))
 from public.orders o
 where upper(o.order_code)=upper(trim(p_code))
 and right(regexp_replace(o.phone,'\\D','','g'),10)=right(regexp_replace(p_phone,'\\D','','g'),10)
 limit 1
$$;
revoke all on function public.track_order(text,text) from public;
grant execute on function public.track_order(text,text) to anon,authenticated;

create or replace function public.admin_set_order_payment(p_order_id uuid,p_status text)
returns text language plpgsql security definer set search_path=public as $$
declare o public.orders; p public.payments;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_status not in ('Pending','Verification Pending','Paid','Failed','Refunded') then raise exception 'Invalid payment status'; end if;
 select * into o from public.orders where id=p_order_id and target_link is null for update;
 if not found then raise exception 'Order not found'; end if;
 select * into p from public.payments where order_id=p_order_id order by created_at desc limit 1 for update;
 if not found then raise exception 'Payment record not found'; end if;
 if o.status in ('Cancelled','Refunded') and p_status='Paid' then raise exception 'Cannot mark a cancelled or refunded order as paid'; end if;
 update public.payments set status=p_status,paid_at=case when p_status='Paid' then coalesce(paid_at,now()) else null end where id=p.id;
 if p_status='Paid' and o.status in ('Pending','Payment Pending') then update public.orders set status='Payment Received',updated_at=now() where id=o.id;
 elsif p_status in ('Failed','Refunded') and o.status='Payment Received' then update public.orders set status=case when p_status='Refunded' then 'Refunded' else 'Payment Pending' end,updated_at=now() where id=o.id;
 end if;
 return p_status;
end $$;
revoke all on function public.admin_set_order_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_set_order_payment(uuid,text) to authenticated;

create or replace function public.admin_set_order_status(p_order_id uuid,p_status text)
returns text language plpgsql security definer set search_path=public as $$
declare o public.orders; paid boolean;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_status not in ('Pending','Payment Pending','Payment Received','Processing','Completed','Cancelled','Refunded') then raise exception 'Invalid order status'; end if;
 select * into o from public.orders where id=p_order_id and target_link is null for update;
 if not found then raise exception 'Order not found'; end if;
 if o.status in ('Cancelled','Refunded') and p_status not in ('Cancelled','Refunded') then raise exception 'Cancelled or refunded orders cannot be reopened'; end if;
 if o.status='Completed' and p_status not in ('Completed','Refunded') then raise exception 'Completed orders cannot move backwards'; end if;
 select exists(select 1 from public.payments where order_id=o.id and status='Paid') into paid;
 if p_status in ('Payment Received','Processing','Completed') and not paid then raise exception 'Payment must be marked Paid before this order can progress'; end if;
 if p_status='Refunded' and not paid then raise exception 'Only a paid order can be marked Refunded'; end if;
 update public.orders set status=p_status,updated_at=now() where id=o.id;
 if p_status='Refunded' then update public.payments set status='Refunded' where order_id=o.id and status='Paid'; end if;
 return p_status;
end $$;
revoke all on function public.admin_set_order_status(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_set_order_status(uuid,text) to authenticated;

create table if not exists public.admin_activity_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id) on delete set null,entity_type text not null,entity_id text,action text not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index if not exists admin_activity_logs_created_idx on public.admin_activity_logs(created_at desc);
alter table public.admin_activity_logs enable row level security;
drop policy if exists admin_activity_logs_read on public.admin_activity_logs;
create policy admin_activity_logs_read on public.admin_activity_logs for select to authenticated using (public.is_admin());
revoke all on public.admin_activity_logs from anon,authenticated;
grant select on public.admin_activity_logs to authenticated;

create or replace function public.log_admin_order_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.is_admin() then
 insert into public.admin_activity_logs(actor_id,entity_type,entity_id,action,details)
 values(auth.uid(),'order',new.id::text,case when tg_op='INSERT' then 'created' else 'updated' end,
 jsonb_build_object('order_code',new.order_code,'old_status',case when tg_op='UPDATE' then old.status else null end,'new_status',new.status));
 end if; return new;
end $$;
drop trigger if exists orders_admin_audit on public.orders;
create trigger orders_admin_audit after insert or update of status on public.orders for each row execute function public.log_admin_order_change();

create or replace function public.log_admin_payment_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.is_admin() then
 insert into public.admin_activity_logs(actor_id,entity_type,entity_id,action,details)
 values(auth.uid(),'payment',new.id::text,'payment_status_changed',jsonb_build_object('order_id',new.order_id,'old_status',old.status,'new_status',new.status));
 end if; return new;
end $$;
drop trigger if exists payments_admin_audit on public.payments;
create trigger payments_admin_audit after update of status on public.payments for each row execute function public.log_admin_payment_change();

create table if not exists public.admin_order_notes(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,admin_id uuid references auth.users(id) on delete set null,note text not null check(char_length(trim(note)) between 1 and 2000),created_at timestamptz not null default now());
create index if not exists admin_order_notes_order_created_idx on public.admin_order_notes(order_id,created_at desc);
alter table public.admin_order_notes enable row level security;
drop policy if exists admin_order_notes_admin_all on public.admin_order_notes;
create policy admin_order_notes_admin_all on public.admin_order_notes for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.admin_order_notes to authenticated;
