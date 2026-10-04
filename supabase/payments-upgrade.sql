-- Payment-ready upgrade. Safe to run more than once. Run in Supabase > SQL Editor.
alter table payments add column if not exists provider text not null default 'manual';
alter table payments add column if not exists provider_ref text;
alter table payments add column if not exists paid_at timestamptz;
create table if not exists payment_events(id uuid primary key default gen_random_uuid(), provider text not null, event_id text not null, order_code text, payload jsonb, result text, received_at timestamptz default now(), unique(provider,event_id));
alter table payment_events enable row level security;
drop policy if exists "admin payment events" on payment_events;
create policy "admin payment events" on payment_events for select using(is_admin());
insert into site_settings(key,value) values('payment_mode','manual') on conflict do nothing;

-- Called ONLY by the server webhook (Cloudflare Function) with the service-role key. Browsers/anon/admin users cannot call it.
create or replace function apply_payment_event(p_order_code text,p_provider text,p_event_id text,p_provider_ref text,p_amount numeric,p_paid boolean,p_payload jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare o orders; pm payments; res text;
begin
 insert into payment_events(provider,event_id,order_code,payload) values(p_provider,p_event_id,p_order_code,p_payload) on conflict(provider,event_id) do nothing;
 if not found then return 'duplicate'; end if;
 select * into o from orders where order_code=p_order_code; if not found then res:='order_not_found';
 else select * into pm from payments where order_id=o.id order by created_at desc limit 1;
  if not p_paid then update payments set status='Failed',provider=p_provider,provider_ref=p_provider_ref where id=pm.id and status<>'Paid'; res:='failed_recorded';
  elsif p_amount is null or p_amount<>o.total then res:='amount_mismatch';
  else update payments set status='Paid',provider=p_provider,provider_ref=p_provider_ref,paid_at=now() where id=pm.id;
   update orders set status='Payment Received',updated_at=now() where id=o.id and status in('Pending','Payment Pending'); res:='paid'; end if;
 end if;
 update payment_events set result=res where provider=p_provider and event_id=p_event_id; return res;
end $$;
revoke all on function apply_payment_event(text,text,text,text,numeric,boolean,jsonb) from public, anon, authenticated;
grant execute on function apply_payment_event(text,text,text,text,numeric,boolean,jsonb) to service_role;
