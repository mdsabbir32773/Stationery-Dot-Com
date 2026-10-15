-- Recurring Friday-only Facebook follower offer (Asia/Dhaka).
-- Server-side pricing is authoritative; only the five matching service codes are discounted.
create or replace function public.create_smm_order(p jsonb)
returns text
language plpgsql
security definer
set search_path=public
as $function$
declare
  sv public.services;
  uid uuid:=auth.uid();
  d date:=(now() at time zone 'Asia/Dhaka')::date;
  seq int; code text; oid uuid; qty int;
  unit numeric(12,2); total numeric(12,2); bal numeric(12,2);
  link text:=trim(coalesce(p->>'target_link',''));
  ph text:=regexp_replace(coalesce(p->>'phone',''),'\D','','g');
  is_friday boolean := extract(dow from (now() at time zone 'Asia/Dhaka')) = 5;
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
  unit:=sv.smm_price_per_1000;
  if is_friday then
    unit:=case sv.smm_service_code
      when 'FB-FOL-WW' then 80
      when 'FB-FOL-MIX' then 140
      when 'FB-FOL-BD-N' then 200
      when 'FB-FOL-BD-P' then 290
      when 'FB-FOL-BD-LIFE' then 400
      else sv.smm_price_per_1000
    end;
  end if;
  total:=round(unit*qty/1000,2);
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
end $function$;
