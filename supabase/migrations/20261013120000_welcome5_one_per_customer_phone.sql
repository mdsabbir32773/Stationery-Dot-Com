-- WELCOME5 can be used once per normalized Bangladeshi phone number, no login required.
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  phone_hash text not null,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  constraint coupon_redemptions_coupon_phone_unique unique (coupon_id, phone_hash)
);
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupon_redemptions from public, anon, authenticated;
update public.coupons set usage_limit = null where upper(code) = 'WELCOME5';

CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text, p_subtotal numeric, p_service_id uuid, p_package_id uuid, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_coupon public.coupons%rowtype;
  v_discount numeric := 0;
  v_coupon_code text := upper(trim(coalesce(p_code, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_canonical_phone text;
  v_phone_hash text;
begin
  if v_coupon_code = '' then
    return jsonb_build_object('valid', false, 'message', 'Enter a coupon code.');
  end if;

  if v_phone like '8801%' and length(v_phone) = 13 then
    v_canonical_phone := v_phone;
  elsif v_phone like '01%' and length(v_phone) = 11 then
    v_canonical_phone := '88' || v_phone;
  elsif v_phone like '1%' and length(v_phone) = 10 then
    v_canonical_phone := '880' || v_phone;
  else
    return jsonb_build_object('valid', false, 'message', 'Enter your valid mobile number before applying this coupon.');
  end if;

  select c.* into v_coupon
  from public.coupons c
  where upper(c.code) = v_coupon_code
    and c.is_active
    and (c.starts_at is null or c.starts_at <= now())
    and (c.expires_at is null or c.expires_at > now())
    and (c.usage_limit is null or c.used_count < c.usage_limit)
    and c.min_order <= coalesce(p_subtotal, 0)
    and (c.service_id is null or c.service_id = p_service_id)
    and (c.package_id is null or c.package_id = p_package_id)
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'This coupon is invalid, expired, or not eligible for this order.');
  end if;

  if v_coupon_code = 'WELCOME5' then
    v_phone_hash := encode(extensions.digest(convert_to(v_canonical_phone, 'UTF8'), 'sha256'), 'hex');
    if exists (
      select 1 from public.coupon_redemptions r
      where r.coupon_id = v_coupon.id and r.phone_hash = v_phone_hash
    ) then
      return jsonb_build_object('valid', false, 'message', 'This mobile number has already used WELCOME5.');
    end if;
  end if;

  if v_coupon.discount_type = 'percent' then
    v_discount := coalesce(p_subtotal, 0) * v_coupon.discount_value / 100;
  else
    v_discount := v_coupon.discount_value;
  end if;
  if v_coupon.max_discount is not null then
    v_discount := least(v_discount, v_coupon.max_discount);
  end if;
  v_discount := greatest(0, least(v_discount, coalesce(p_subtotal, 0)));

  return jsonb_build_object(
    'valid', true,
    'code', v_coupon.code,
    'discount', round(v_discount, 2),
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value
  );
end;
$function$


revoke all on function public.validate_coupon(text, numeric, uuid, uuid, text) from public;
grant execute on function public.validate_coupon(text, numeric, uuid, uuid, text) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_order(p jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 pk packages; sv services; c coupons;
 d date := (now() at time zone 'Asia/Dhaka')::date;
 seq int; code text; oid uuid; qty int; f jsonb; nf int:=0;
 ph text:=regexp_replace(coalesce(p->>'phone',''),'\D','','g');
 em text:=coalesce(p->>'email','');
 is_quote boolean:=coalesce((p->>'quote')::boolean,false);
 coupon_code text:=upper(trim(coalesce(p->>'coupon_code','')));
 gross numeric; discount numeric:=0; final_total numeric;
 canonical_phone text; phone_hash text;
begin
 begin qty:=(p->>'quantity')::int; exception when others then raise exception 'Invalid quantity'; end;
 if qty is null or qty<1 or qty>100000 then raise exception 'Invalid quantity'; end if;
 select * into pk from packages where id=(p->>'package_id')::uuid and is_active;
 if not found then raise exception 'Invalid package'; end if;
 select * into sv from services where id=pk.service_id and is_active;
 if not found then raise exception 'Invalid service'; end if;
 if length(trim(coalesce(p->>'customer_name','')))<2 then raise exception 'Name required'; end if;
 if ph !~ '^(880|0)?1[0-9]{9}$' then raise exception 'Valid Bangladeshi mobile number required'; end if;
 if em<>'' and em !~ '^\S+@\S+\.\S+$' then raise exception 'Invalid email'; end if;
 if is_quote and pk.price > 0 then raise exception 'This package has a fixed price'; end if;
 if not is_quote and pk.price <= 0 then raise exception 'This package requires a price quote'; end if;

 if ph like '8801%' and length(ph)=13 then canonical_phone:=ph;
 elsif ph like '01%' and length(ph)=11 then canonical_phone:='88'||ph;
 elsif ph like '1%' and length(ph)=10 then canonical_phone:='880'||ph;
 else raise exception 'Valid Bangladeshi mobile number required'; end if;

 gross:=pk.price*qty;
 if not is_quote and coupon_code<>'' then
   select * into c from coupons
   where upper(coupons.code)=coupon_code and is_active
     and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now())
     and (usage_limit is null or used_count<usage_limit) and min_order<=gross
     and (service_id is null or service_id=sv.id) and (package_id is null or package_id=pk.id)
   for update;
   if not found then raise exception 'Coupon is invalid, expired, or not eligible for this order'; end if;

   if coupon_code='WELCOME5' then
     phone_hash:=encode(extensions.digest(convert_to(canonical_phone,'UTF8'),'sha256'),'hex');
     if exists(select 1 from public.coupon_redemptions where coupon_id=c.id and coupon_redemptions.phone_hash=phone_hash) then
       raise exception 'This mobile number has already used WELCOME5';
     end if;
   end if;
   if c.discount_type='percent' then discount:=gross*c.discount_value/100; else discount:=c.discount_value; end if;
   if c.max_discount is not null then discount:=least(discount,c.max_discount); end if;
   discount:=greatest(0,least(discount,gross));
 end if;
 final_total:=gross-discount;
 if not is_quote and length(trim(coalesce(p->>'transaction_id','')))<4 then raise exception 'Transaction ID required'; end if;

 insert into order_counters(day,n) values(d,1) on conflict(day) do update set n=order_counters.n+1 returning n into seq;
 code:='STDC-'||to_char(d,'YYYYMMDD')||'-'||upper(encode(extensions.gen_random_bytes(12),'hex'));
 insert into orders(order_code,customer_name,phone,whatsapp,email,service_id,package_id,service_name,package_name,unit_price,quantity,total,notes,status,coupon_code,discount_amount)
 values(code,left(trim(p->>'customer_name'),120),left(p->>'phone',20),left(p->>'whatsapp',20),left(em,120),sv.id,pk.id,sv.name,
   case when pk.access_type is null then pk.name else concat_ws(' · ',pk.name,initcap(pk.access_type),
     case pk.duration_months when 0 then 'Lifetime' when 1 then '1 Month' when 2 then '2 Months' when 6 then '6 Months' when 12 then '1 Year' when 24 then '2 Years' when 36 then '3 Years' when 48 then '4 Years' when 60 then '5 Years' end) end,
   pk.price,qty,final_total,left(p->>'notes',3000),case when is_quote then 'Pending' else 'Payment Pending' end,nullif(coupon_code,''),discount)
 returning id into oid;

 if not is_quote then
   insert into payments(order_id,method,transaction_id,amount,status,payment_proof_path)
   values(oid,left(p->>'method',60),left(trim(p->>'transaction_id'),80),final_total,'Verification Pending',nullif(p->>'payment_proof_path',''));
   if coupon_code<>'' then
     update coupons set used_count=used_count+1 where id=c.id;
     if coupon_code='WELCOME5' then
       insert into public.coupon_redemptions(coupon_id,phone_hash,order_id) values(c.id,phone_hash,oid);
     end if;
   end if;
 end if;
 for f in select value from jsonb_array_elements(coalesce(p->'files','[]'::jsonb)) loop
   nf:=nf+1; if nf>5 or coalesce(f->>'path','') !~ '^uploads/[A-Za-z0-9._-]+$' then raise exception 'Invalid file'; end if;
   insert into order_files(order_id,file_path,file_name) values(oid,f->>'path',left(f->>'name',200));
 end loop;
 return code;
end $function$

