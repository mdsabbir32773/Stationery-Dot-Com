-- Stationery Dot Com: coupon system + order security polish
create table if not exists public.coupons(
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 discount_type text not null check(discount_type in ('percent','fixed')),
 discount_value numeric(12,2) not null check(discount_value>0),
 min_order numeric(12,2) not null default 0 check(min_order>=0),
 max_discount numeric(12,2),
 usage_limit integer,
 used_count integer not null default 0 check(used_count>=0),
 starts_at timestamptz,
 expires_at timestamptz,
 service_id uuid references public.services(id) on delete set null,
 package_id uuid references public.packages(id) on delete set null,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric(12,2) not null default 0;
alter table public.coupons enable row level security;
drop policy if exists "public active coupons" on public.coupons;
create policy "public active coupons" on public.coupons for select to anon,authenticated using(is_active and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now()));
drop policy if exists "admin coupons" on public.coupons;
create policy "admin coupons" on public.coupons for all to authenticated using(is_admin()) with check(is_admin());

create or replace function public.validate_coupon(p_code text,p_subtotal numeric,p_service_id uuid,p_package_id uuid)
returns jsonb language plpgsql stable set search_path=public as $
declare c coupons; d numeric:=0; coupon_code text:=upper(trim(coalesce(p_code,'')));
begin
 if coupon_code='' then return jsonb_build_object('valid',false,'message','Enter a coupon code.'); end if;
 select * into c from coupons where upper(coupons.code)=coupon_code and is_active
   and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now())
   and (usage_limit is null or used_count<usage_limit) and min_order<=coalesce(p_subtotal,0)
   and (service_id is null or service_id=p_service_id) and (package_id is null or package_id=p_package_id) limit 1;
 if not found then return jsonb_build_object('valid',false,'message','This coupon is invalid, expired, or not eligible for this order.'); end if;
 if c.discount_type='percent' then d:=coalesce(p_subtotal,0)*c.discount_value/100; else d:=c.discount_value; end if;
 if c.max_discount is not null then d:=least(d,c.max_discount); end if;
 d:=greatest(0,least(d,coalesce(p_subtotal,0)));
 return jsonb_build_object('valid',true,'code',c.code,'discount',round(d,2),'discount_type',c.discount_type,'discount_value',c.discount_value);
end $$;
revoke all on function public.validate_coupon(text,numeric,uuid,uuid) from public;
grant execute on function public.validate_coupon(text,numeric,uuid,uuid) to anon,authenticated;

create or replace function public.create_order(p jsonb) returns text
language plpgsql security definer set search_path=public as $
declare
 pk packages; sv services; c coupons;
 d date := (now() at time zone 'Asia/Dhaka')::date;
 seq int; code text; oid uuid; qty int; f jsonb; nf int:=0;
 ph text:=regexp_replace(coalesce(p->>'phone',''),'\\D','','g');
 em text:=coalesce(p->>'email','');
 is_quote boolean:=coalesce((p->>'quote')::boolean,false);
 coupon_code text:=upper(trim(coalesce(p->>'coupon_code','')));
 gross numeric; discount numeric:=0; final_total numeric;
begin
 begin qty:=(p->>'quantity')::int; exception when others then raise exception 'Invalid quantity'; end;
 if qty is null or qty<1 or qty>100000 then raise exception 'Invalid quantity'; end if;
 select * into pk from packages where id=(p->>'package_id')::uuid and is_active;
 if not found then raise exception 'Invalid package'; end if;
 select * into sv from services where id=pk.service_id and is_active;
 if not found then raise exception 'Invalid service'; end if;
 if length(trim(coalesce(p->>'customer_name','')))<2 then raise exception 'Name required'; end if;
 if ph !~ '^(880|0)?1[0-9]{9}alter table public.order_counters enable row level security;
drop policy if exists "admin order counters" on public.order_counters;
create policy "admin order counters" on public.order_counters for select to authenticated using(is_admin());
 then raise exception 'Valid Bangladeshi mobile number required'; end if;
 if em<>'' and em !~ '^\\S+@\\S+\\.\\S+alter table public.order_counters enable row level security;
drop policy if exists "admin order counters" on public.order_counters;
create policy "admin order counters" on public.order_counters for select to authenticated using(is_admin());
 then raise exception 'Invalid email'; end if;
 if is_quote and pk.price > 0 then raise exception 'This package has a fixed price'; end if;
 if not is_quote and pk.price <= 0 then raise exception 'This package requires a price quote'; end if;
 gross:=pk.price*qty;
 if not is_quote and coupon_code<>'' then
   select * into c from coupons where upper(coupons.code)=coupon_code and is_active
    and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now())
    and (usage_limit is null or used_count<usage_limit) and min_order<=gross
    and (service_id is null or service_id=sv.id) and (package_id is null or package_id=pk.id) for update;
   if not found then raise exception 'Coupon is invalid, expired, or not eligible for this order'; end if;
   if c.discount_type='percent' then discount:=gross*c.discount_value/100; else discount:=c.discount_value; end if;
   if c.max_discount is not null then discount:=least(discount,c.max_discount); end if;
   discount:=greatest(0,least(discount,gross));
 end if;
 final_total:=gross-discount;
 if not is_quote and length(trim(coalesce(p->>'transaction_id','')))<4 then raise exception 'Transaction ID required'; end if;
 insert into order_counters(day,n) values(d,1) on conflict(day) do update set n=order_counters.n+1 returning n into seq;
 code:='STDC-'||to_char(d,'YYYYMMDD')||'-'||upper(encode(gen_random_bytes(12),'hex'));
 insert into orders(order_code,customer_name,phone,whatsapp,email,service_id,package_id,service_name,package_name,unit_price,quantity,total,notes,status,coupon_code,discount_amount)
 values(code,left(trim(p->>'customer_name'),120),left(p->>'phone',20),left(p->>'whatsapp',20),left(em,120),sv.id,pk.id,sv.name,
   case when pk.access_type is null then pk.name else concat_ws(' · ',pk.name,initcap(pk.access_type),
     case pk.duration_months when 0 then 'Lifetime' when 1 then '1 Month' when 2 then '2 Months' when 6 then '6 Months' when 12 then '1 Year' when 24 then '2 Years' when 36 then '3 Years' when 48 then '4 Years' when 60 then '5 Years' end) end,
   pk.price,qty,final_total,left(p->>'notes',3000),case when is_quote then 'Pending' else 'Payment Pending' end,nullif(coupon_code,''),discount)
 returning id into oid;
 if not is_quote then
   insert into payments(order_id,method,transaction_id,amount,status,payment_proof_path)
   values(oid,left(p->>'method',60),left(trim(p->>'transaction_id'),80),final_total,'Verification Pending',nullif(p->>'payment_proof_path',''));
   if coupon_code<>'' then update coupons set used_count=used_count+1 where id=c.id; end if;
 end if;
 for f in select value from jsonb_array_elements(coalesce(p->'files','[]'::jsonb)) loop
   nf:=nf+1; if nf>5 or coalesce(f->>'path','') !~ '^uploads/[A-Za-z0-9._-]+alter table public.order_counters enable row level security;
drop policy if exists "admin order counters" on public.order_counters;
create policy "admin order counters" on public.order_counters for select to authenticated using(is_admin());
 then raise exception 'Invalid file'; end if;
   insert into order_files(order_id,file_path,file_name) values(oid,f->>'path',left(f->>'name',200));
 end loop;
 return code;
end $;
grant execute on function public.create_order(jsonb) to anon,authenticated;
alter table public.order_counters enable row level security;
drop policy if exists "admin order counters" on public.order_counters;
create policy "admin order counters" on public.order_counters for select to authenticated using(is_admin());
