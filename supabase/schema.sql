-- Stationery Dot Com schema. Paste whole file into Supabase > SQL Editor > Run.
create extension if not exists pgcrypto;

create table admin_profiles(id uuid primary key references auth.users on delete cascade, full_name text, created_at timestamptz default now());
create or replace function is_admin() returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from admin_profiles where id=auth.uid()) $$;

create table services(id uuid primary key default gen_random_uuid(), category text not null, name text not null, slug text unique not null,
 description text, requires_file boolean default false, is_popular boolean default false, is_active boolean default true, sort_order int default 0, created_at timestamptz default now());
create table packages(id uuid primary key default gen_random_uuid(), service_id uuid not null references services on delete cascade, name text not null,
 description text, price numeric(12,2) not null check(price>=0), unit text default 'per order', is_active boolean default true, sort_order int default 0, created_at timestamptz default now());
create table order_counters(day date primary key, n int not null default 0);
create table orders(id uuid primary key default gen_random_uuid(), order_code text unique not null, customer_name text not null, phone text not null, whatsapp text, email text,
 service_id uuid references services on delete set null, package_id uuid references packages on delete set null, service_name text, package_name text,
 unit_price numeric(12,2) not null, quantity int not null check(quantity>0), total numeric(12,2) not null, notes text,
 status text not null default 'Payment Pending' check(status in('Pending','Payment Pending','Payment Received','Processing','Completed','Cancelled','Refunded')),
 created_at timestamptz default now(), updated_at timestamptz default now());
create table order_files(id uuid primary key default gen_random_uuid(), order_id uuid not null references orders on delete cascade, file_path text not null, file_name text, created_at timestamptz default now());
create table payments(id uuid primary key default gen_random_uuid(), order_id uuid not null references orders on delete cascade, method text, transaction_id text, amount numeric(12,2),
 status text not null default 'Verification Pending' check(status in('Pending','Verification Pending','Paid','Failed','Refunded')), created_at timestamptz default now());
create table site_settings(key text primary key, value text);
insert into site_settings(key,value) values
('payment_method_name','bKash / Nagad / Bank QR (edit in Admin > Settings)'),('payment_account_name',''),('payment_number',''),('payment_qr_url',''),
('payment_instructions','Scan the QR, send the exact total, then enter your Transaction ID.')
on conflict do nothing;

-- Place order safely: price is calculated on the server, customers can never read orders.
create or replace function create_order(p jsonb) returns text language plpgsql security definer set search_path=public as $$
declare pk packages; sv services; d date:=(now() at time zone 'Asia/Dhaka')::date; seq int; code text; oid uuid; qty int; f jsonb; nf int:=0;
 ph text:=regexp_replace(coalesce(p->>'phone',''),'\D','','g'); em text:=coalesce(p->>'email','');
begin
 begin qty:=(p->>'quantity')::int; exception when others then raise exception 'Invalid quantity'; end;
 if qty is null or qty<1 or qty>100000 then raise exception 'Invalid quantity'; end if;
 select * into pk from packages where id=(p->>'package_id')::uuid and is_active; if not found then raise exception 'Invalid package'; end if;
 select * into sv from services where id=pk.service_id and is_active; if not found then raise exception 'Invalid service'; end if;
 if length(trim(coalesce(p->>'customer_name','')))<2 then raise exception 'Name required'; end if;
 if ph !~ '^(880|0)?1[0-9]{9}$' then raise exception 'Valid Bangladeshi mobile number required'; end if;
 if em<>'' and em !~ '^\S+@\S+\.\S+$' then raise exception 'Invalid email'; end if;
 if length(trim(coalesce(p->>'transaction_id','')))<4 then raise exception 'Transaction ID required'; end if;
 insert into order_counters(day,n) values(d,1) on conflict(day) do update set n=order_counters.n+1 returning n into seq;
 code:='STDC-'||to_char(d,'YYYYMMDD')||'-'||upper(encode(gen_random_bytes(12),'hex'));
 insert into orders(order_code,customer_name,phone,whatsapp,email,service_id,package_id,service_name,package_name,unit_price,quantity,total,notes)
 values(code,left(trim(p->>'customer_name'),120),left(p->>'phone',20),left(p->>'whatsapp',20),left(em,120),sv.id,pk.id,sv.name,pk.name,pk.price,qty,pk.price*qty,left(p->>'notes',3000)) returning id into oid;
 insert into payments(order_id,method,transaction_id,amount,status) values(oid,left(p->>'method',60),left(trim(p->>'transaction_id'),80),pk.price*qty,'Verification Pending');
 for f in select value from jsonb_array_elements(coalesce(p->'files','[]'::jsonb)) loop
  nf:=nf+1; if nf>5 or coalesce(f->>'path','') !~ '^uploads/[A-Za-z0-9._-]+$' then raise exception 'Invalid file'; end if;
  insert into order_files(order_id,file_path,file_name) values(oid,f->>'path',left(f->>'name',200)); end loop;
 return code;
end $$;

-- Customer tracking: needs BOTH order id and phone.
create or replace function track_order(p_code text,p_phone text) returns json language sql security definer set search_path=public as $$
 select json_build_object('order_code',o.order_code,'service_name',o.service_name,'package_name',o.package_name,'quantity',o.quantity,'total',o.total,'status',o.status,'created_at',o.created_at,
  'payment_status',(select status from payments where order_id=o.id order by created_at desc limit 1))
 from orders o where upper(o.order_code)=upper(trim(p_code)) and right(regexp_replace(o.phone,'\D','','g'),10)=right(regexp_replace(p_phone,'\D','','g'),10) $$;
grant execute on function create_order(jsonb), track_order(text,text) to anon, authenticated;

-- Row Level Security
alter table admin_profiles enable row level security; alter table services enable row level security; alter table packages enable row level security;
alter table orders enable row level security; alter table order_files enable row level security; alter table payments enable row level security;
alter table site_settings enable row level security; alter table order_counters enable row level security;
create policy "own profile" on admin_profiles for select using(id=auth.uid());
create policy "read services" on services for select using(is_active or is_admin());
create policy "admin services" on services for all using(is_admin()) with check(is_admin());
create policy "read packages" on packages for select using(is_active or is_admin());
create policy "admin packages" on packages for all using(is_admin()) with check(is_admin());
create policy "admin orders" on orders for all using(is_admin()) with check(is_admin());
create policy "admin files" on order_files for all using(is_admin()) with check(is_admin());
create policy "admin payments" on payments for all using(is_admin()) with check(is_admin());
create policy "read settings" on site_settings for select using(true);
create policy "admin settings" on site_settings for all using(is_admin()) with check(is_admin());

-- Storage: private customer files (10MB, limited types) + public bucket for QR image
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('order-files','order-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
('site-assets','site-assets',true,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict do nothing;
create policy "customers upload" on storage.objects for insert to anon,authenticated with check(bucket_id='order-files' and (storage.foldername(name))[1]='uploads');
create policy "admin read files" on storage.objects for select to authenticated using(bucket_id='order-files' and is_admin());
create policy "admin delete files" on storage.objects for delete to authenticated using(bucket_id='order-files' and is_admin());
create policy "public read assets" on storage.objects for select using(bucket_id='site-assets');
create policy "admin write assets" on storage.objects for all to authenticated using(bucket_id='site-assets' and is_admin()) with check(bucket_id='site-assets' and is_admin());
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
-- Optional migration: lets each service have a cover image. Safe to run more than once.
-- Without it the website still works (every service gets an automatic category cover).
alter table services add column if not exists image_url text;
