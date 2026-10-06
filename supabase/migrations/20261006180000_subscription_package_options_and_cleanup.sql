-- Add structured subscription variants and remove packages belonging only to hidden services.
alter table public.packages
  add column access_type text,
  add column duration_months smallint,
  add constraint packages_access_type_check
    check (access_type is null or access_type in ('shared', 'personal')),
  add constraint packages_duration_months_check
    check (duration_months is null or duration_months in (1, 6, 12)),
  add constraint packages_subscription_options_pair_check
    check ((access_type is null) = (duration_months is null));

-- Keep order history intact while removing package options customers can no longer buy.
update public.packages p
set is_active = false
from public.services s
where s.id = p.service_id
  and not s.is_active
  and exists (select 1 from public.orders o where o.package_id = p.id);

delete from public.packages p
using public.services s
where s.id = p.service_id
  and not s.is_active
  and not exists (select 1 from public.orders o where o.package_id = p.id);

create or replace function public.create_order(p jsonb)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
 values(
   code,
   left(trim(p->>'customer_name'),120),
   left(p->>'phone',20),
   left(p->>'whatsapp',20),
   left(em,120),
   sv.id,
   pk.id,
   sv.name,
   case
     when pk.access_type is null then pk.name
     else concat_ws(' · ', pk.name, initcap(pk.access_type),
       case pk.duration_months when 1 then '1 month' when 6 then '6 months' when 12 then '1 year' end)
   end,
   pk.price,
   qty,
   pk.price*qty,
   left(p->>'notes',3000)
 ) returning id into oid;
 insert into payments(order_id,method,transaction_id,amount,status) values(oid,left(p->>'method',60),left(trim(p->>'transaction_id'),80),pk.price*qty,'Verification Pending');
 for f in select value from jsonb_array_elements(coalesce(p->'files','[]'::jsonb)) loop
  nf:=nf+1; if nf>5 or coalesce(f->>'path','') !~ '^uploads/[A-Za-z0-9._-]+$' then raise exception 'Invalid file'; end if;
  insert into order_files(order_id,file_path,file_name) values(oid,f->>'path',left(f->>'name',200));
 end loop;
 return code;
end $function$;

notify pgrst, 'reload schema';
