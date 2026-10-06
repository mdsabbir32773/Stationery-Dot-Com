-- SMM Panel catalogue + order checkout. Safe to run after schema.sql and
-- customer-accounts.sql. Existing services/packages/orders remain intact.
alter table public.services add column if not exists smm_platform text;
alter table public.services add column if not exists smm_category text;
alter table public.services add column if not exists smm_country text default 'Worldwide';
alter table public.services add column if not exists smm_service_code text;
alter table public.services add column if not exists smm_min_quantity integer;
alter table public.services add column if not exists smm_max_quantity integer;
alter table public.services add column if not exists smm_price_per_1000 numeric(12,2);
alter table public.services add column if not exists smm_start_time text;
alter table public.services add column if not exists smm_delivery_time text;
alter table public.services add column if not exists smm_refill text default 'No';
alter table public.services add column if not exists smm_cancel boolean not null default false;
alter table public.services add column if not exists smm_instructions text;
alter table public.services add column if not exists smm_provider_service_id text;
alter table public.services add column if not exists smm_provider_cost_per_1000 numeric(12,2);
alter table public.orders add column if not exists target_link text;
alter table public.orders add column if not exists provider_order_id text;
create unique index if not exists services_smm_service_code_unique
  on public.services(smm_service_code) where smm_service_code is not null and smm_service_code<>'';

-- Manual-payment SMM checkout for the existing store. The authoritative
-- service price, quantity limits, order total and payment amount are resolved
-- inside Postgres; the browser cannot submit its own price.
create or replace function public.create_smm_order(p jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare sv public.services; d date:=(now() at time zone 'Asia/Dhaka')::date;
  seq int; code text; oid uuid; qty int; unit numeric(12,2); total numeric(12,2);
  ph text:=regexp_replace(coalesce(p->>'phone',''),'\D','','g');
  em text:=coalesce(p->>'email',''); link text:=trim(coalesce(p->>'target_link',''));
  txn text:=trim(coalesce(p->>'transaction_id','')); method text:=trim(coalesce(p->>'method',''));
begin
  begin qty:=(p->>'quantity')::int; exception when others then raise exception 'Invalid quantity'; end;
  if qty is null or qty<1 or qty>1000000 then raise exception 'Invalid quantity'; end if;
  begin select * into sv from public.services where id=(p->>'service_id')::uuid and is_active; exception when others then raise exception 'Invalid service'; end;
  if not found or sv.smm_platform is null or sv.smm_min_quantity is null or sv.smm_price_per_1000 is null then raise exception 'SMM service is unavailable'; end if;
  if qty<sv.smm_min_quantity or qty>sv.smm_max_quantity then raise exception 'Quantity is outside this service limit'; end if;
  if length(trim(coalesce(p->>'customer_name','')))<2 then raise exception 'Name required'; end if;
  if ph !~ '^(880|0)?1[0-9]{9}$' then raise exception 'Valid Bangladeshi mobile number required'; end if;
  if em<>'' and em !~ '^\S+@\S+\.\S+$' then raise exception 'Invalid email'; end if;
  if link !~* '^https?://' or length(link)>1000 then raise exception 'Valid public link required'; end if;
  if method not in ('bKash','Nagad','Rocket','Bank transfer') then raise exception 'Select a valid payment method'; end if;
  if length(txn)<4 or length(txn)>80 then raise exception 'Transaction ID required'; end if;
  unit:=sv.smm_price_per_1000; total:=round(unit*qty/1000,2);
  if total<=0 then raise exception 'Invalid order amount'; end if;
  insert into public.order_counters(day,n) values(d,1) on conflict(day) do update set n=public.order_counters.n+1 returning n into seq;
  code:='STDC-'||to_char(d,'YYYYMMDD')||'-'||lpad(seq::text,3,'0');
  insert into public.orders(order_code,customer_name,phone,email,service_id,package_id,service_name,package_name,unit_price,quantity,total,notes,target_link)
    values(code,left(trim(p->>'customer_name'),120),left(trim(p->>'phone'),20),left(em,120),sv.id,null,sv.name,'SMM · '||sv.smm_service_code,unit,qty,total,left(coalesce(p->>'notes',''),1000),link)
    returning id into oid;
  insert into public.payments(order_id,method,transaction_id,amount,status)
    values(oid,method,left(txn,80),total,'Verification Pending');
  return code;
end $$;
revoke all on function public.create_smm_order(jsonb) from public;
grant execute on function public.create_smm_order(jsonb) to anon,authenticated;

comment on function public.create_smm_order(jsonb) is 'Creates an SMM order using the active service price and min/max limits. Uses existing manual payment review workflow; does not send to a provider or debit a wallet.';

