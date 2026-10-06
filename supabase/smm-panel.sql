-- SMM catalogue, customer wallets and manual deposit review.
-- Run after schema.sql and customer-accounts.sql. Existing rows are preserved.
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
alter table public.orders add column if not exists wallet_refunded_at timestamptz;
create unique index if not exists services_smm_service_code_unique
  on public.services(smm_service_code) where smm_service_code is not null and smm_service_code<>'';

create table if not exists public.wallets(
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0 check(balance>=0),
  updated_at timestamptz not null default now()
);
create table if not exists public.wallet_transactions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check(amount<>0),
  transaction_type text not null check(transaction_type in('deposit','order_charge','refund','adjustment')),
  reference text,
  description text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id,created_at desc);
create table if not exists public.deposit_requests(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check(method in('bKash','Nagad','Rocket','Bank transfer')),
  amount numeric(12,2) not null check(amount>=50),
  transaction_id text not null check(length(transaction_id)>=4),
  status text not null default 'Pending' check(status in('Pending','Approved','Rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(method,transaction_id)
);
create index if not exists deposit_requests_user_created_idx on public.deposit_requests(user_id,created_at desc);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.deposit_requests enable row level security;
drop policy if exists "wallet owner or admin read" on public.wallets;
create policy "wallet owner or admin read" on public.wallets for select to authenticated using(user_id=auth.uid() or is_admin());
drop policy if exists "wallet transactions owner or admin read" on public.wallet_transactions;
create policy "wallet transactions owner or admin read" on public.wallet_transactions for select to authenticated using(user_id=auth.uid() or is_admin());
drop policy if exists "deposit request owner or admin read" on public.deposit_requests;
create policy "deposit request owner or admin read" on public.deposit_requests for select to authenticated using(user_id=auth.uid() or is_admin());

create or replace function public.get_smm_wallet()
returns numeric language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); bal numeric(12,2);
begin
  if uid is null then raise exception 'Sign in to view your wallet'; end if;
  insert into public.wallets(user_id) values(uid) on conflict(user_id) do nothing;
  select balance into bal from public.wallets where user_id=uid;
  return bal;
end $$;

create or replace function public.request_smm_deposit(p_method text,p_amount numeric,p_transaction_id text)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'Sign in to request a deposit'; end if;
  if p_method not in('bKash','Nagad','Rocket','Bank transfer') then raise exception 'Invalid payment method'; end if;
  if p_amount is null or p_amount<50 or p_amount>1000000 then raise exception 'Deposit must be between ৳50 and ৳1,000,000'; end if;
  if length(trim(coalesce(p_transaction_id,'')))<4 or length(trim(p_transaction_id))>80 then raise exception 'Enter a valid transaction ID'; end if;
  insert into public.wallets(user_id) values(uid) on conflict(user_id) do nothing;
  insert into public.deposit_requests(user_id,method,amount,transaction_id)
    values(uid,p_method,round(p_amount,2),left(trim(p_transaction_id),80)) returning id into rid;
  return rid;
exception when unique_violation then raise exception 'This payment transaction ID was already submitted';
end $$;

create or replace function public.review_smm_deposit(p_request_id uuid,p_approved boolean,p_note text default null)
returns text language plpgsql security definer set search_path=public as $$
declare r public.deposit_requests; uid uuid:=auth.uid();
begin
  if uid is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into r from public.deposit_requests where id=p_request_id for update;
  if not found then raise exception 'Deposit request not found'; end if;
  if r.status<>'Pending' then raise exception 'Deposit request was already reviewed'; end if;
  if p_approved then
    insert into public.wallets(user_id,balance) values(r.user_id,r.amount)
      on conflict(user_id) do update set balance=wallets.balance+excluded.balance,updated_at=now();
    insert into public.wallet_transactions(user_id,amount,transaction_type,reference,description)
      values(r.user_id,r.amount,'deposit',r.transaction_id,'Deposit approved · '||r.method);
    update public.deposit_requests set status='Approved',admin_note=left(p_note,500),reviewed_by=uid,reviewed_at=now() where id=r.id;
    return 'Approved';
  else
    update public.deposit_requests set status='Rejected',admin_note=left(p_note,500),reviewed_by=uid,reviewed_at=now() where id=r.id;
    return 'Rejected';
  end if;
end $$;

-- Lock and charge the wallet in the same transaction as the order insert.
create or replace function public.create_smm_order(p jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare sv public.services; uid uuid:=auth.uid(); d date:=(now() at time zone 'Asia/Dhaka')::date;
  seq int; code text; oid uuid; qty int; unit numeric(12,2); total numeric(12,2); bal numeric(12,2);
  link text:=trim(coalesce(p->>'target_link','')); ph text:=regexp_replace(coalesce(p->>'phone',''),'\D','','g');
begin
  if uid is null then raise exception 'Sign in to place an SMM order'; end if;
  begin qty:=(p->>'quantity')::int; exception when others then raise exception 'Invalid quantity'; end;
  if qty is null or qty<1 or qty>1000000 then raise exception 'Invalid quantity'; end if;
  begin select * into sv from public.services where id=(p->>'service_id')::uuid and is_active; exception when others then raise exception 'Invalid service'; end;
  if not found or sv.smm_platform is null or sv.smm_min_quantity is null or sv.smm_price_per_1000 is null then raise exception 'SMM service is unavailable'; end if;
  if qty<sv.smm_min_quantity or qty>sv.smm_max_quantity then raise exception 'Quantity is outside this service limit'; end if;
  if length(trim(coalesce(p->>'customer_name','')))<2 then raise exception 'Name required'; end if;
  if ph !~ '^(880|0)?1[0-9]{9}$' then raise exception 'Valid Bangladeshi mobile number required'; end if;
  if link !~* '^https?://' or length(link)>1000 then raise exception 'Valid public link required'; end if;
  unit:=sv.smm_price_per_1000; total:=round(unit*qty/1000,2);
  if total<=0 then raise exception 'Invalid order amount'; end if;
  insert into public.wallets(user_id) values(uid) on conflict(user_id) do nothing;
  select balance into bal from public.wallets where user_id=uid for update;
  if bal<total then raise exception 'Insufficient wallet balance'; end if;
  insert into public.order_counters(day,n) values(d,1) on conflict(day) do update set n=public.order_counters.n+1 returning n into seq;
  code:='STDC-'||to_char(d,'YYYYMMDD')||'-'||lpad(seq::text,3,'0');
  insert into public.orders(order_code,customer_name,phone,email,customer_id,service_id,package_id,service_name,package_name,unit_price,quantity,total,notes,target_link,status)
    values(code,left(trim(coalesce(p->>'customer_name','')),120),left(trim(coalesce(p->>'phone','')),20),left(coalesce(p->>'email',''),120),uid,sv.id,null,sv.name,'SMM · '||sv.smm_service_code,unit,qty,total,left(coalesce(p->>'notes',''),1000),link,'Payment Received') returning id into oid;
  update public.wallets set balance=balance-total,updated_at=now() where user_id=uid;
  insert into public.wallet_transactions(user_id,amount,transaction_type,reference,description,order_id)
    values(uid,-total,'order_charge',code,'SMM order · '||sv.name,oid);
  return code;
end $$;

create or replace function public.admin_update_smm_order(p_order_id uuid,p_status text,p_note text default null)
returns text language plpgsql security definer set search_path=public as $$
declare o public.orders; uid uuid:=auth.uid();
begin
  if uid is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in('Payment Received','Processing','Completed','Cancelled','Refunded') then raise exception 'Invalid SMM status'; end if;
  select * into o from public.orders where id=p_order_id and target_link is not null for update;
  if not found then raise exception 'SMM order not found'; end if;
  if o.wallet_refunded_at is not null and p_status not in('Cancelled','Refunded') then raise exception 'This SMM order has already been refunded'; end if;
  if p_status in('Cancelled','Refunded') and o.wallet_refunded_at is null then
    if o.customer_id is null then raise exception 'SMM order has no wallet owner'; end if;
    update public.wallets set balance=balance+o.total,updated_at=now() where user_id=o.customer_id;
    if not found then insert into public.wallets(user_id,balance) values(o.customer_id,o.total); end if;
    insert into public.wallet_transactions(user_id,amount,transaction_type,reference,description,order_id)
      values(o.customer_id,o.total,'refund',o.order_code,'SMM order refund',o.id);
    update public.orders set status=p_status,wallet_refunded_at=now(),notes=concat_ws(E'\n',nullif(notes,''),left(p_note,500)),updated_at=now() where id=o.id;
  else
    update public.orders set status=p_status,notes=case when coalesce(trim(p_note),'')='' then notes else concat_ws(E'\n',nullif(notes,''),left(p_note,500)) end,updated_at=now() where id=o.id;
  end if;
  return p_status;
end $$;

revoke all on function public.get_smm_wallet(),public.request_smm_deposit(text,numeric,text),public.review_smm_deposit(uuid,boolean,text),public.create_smm_order(jsonb),public.admin_update_smm_order(uuid,text,text) from public;
grant execute on function public.get_smm_wallet(),public.request_smm_deposit(text,numeric,text),public.create_smm_order(jsonb) to authenticated;
grant execute on function public.review_smm_deposit(uuid,boolean,text),public.admin_update_smm_order(uuid,text,text) to authenticated;

comment on function public.create_smm_order(jsonb) is 'Creates an SMM order and charges the signed-in customer wallet atomically. Does not call an external provider.';

