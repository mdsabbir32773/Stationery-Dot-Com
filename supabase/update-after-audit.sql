-- Run ONLY if you already ran the OLD schema.sql. Safe to run more than once.
alter table orders drop constraint if exists orders_service_id_fkey, drop constraint if exists orders_package_id_fkey;
alter table orders add constraint orders_service_id_fkey foreign key(service_id) references services(id) on delete set null,
 add constraint orders_package_id_fkey foreign key(package_id) references packages(id) on delete set null;
delete from site_settings where key in('whatsapp','phone1','phone2');
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
 code:='STDC-'||to_char(d,'YYYYMMDD')||'-'||lpad(seq::text,3,'0');
 insert into orders(order_code,customer_name,phone,whatsapp,email,service_id,package_id,service_name,package_name,unit_price,quantity,total,notes)
 values(code,left(trim(p->>'customer_name'),120),left(p->>'phone',20),left(p->>'whatsapp',20),left(em,120),sv.id,pk.id,sv.name,pk.name,pk.price,qty,pk.price*qty,left(p->>'notes',3000)) returning id into oid;
 insert into payments(order_id,method,transaction_id,amount,status) values(oid,left(p->>'method',60),left(trim(p->>'transaction_id'),80),pk.price*qty,'Verification Pending');
 for f in select value from jsonb_array_elements(coalesce(p->'files','[]'::jsonb)) loop
  nf:=nf+1; if nf>5 or coalesce(f->>'path','') !~ '^uploads/[A-Za-z0-9._-]+$' then raise exception 'Invalid file'; end if;
  insert into order_files(order_id,file_path,file_name) values(oid,f->>'path',left(f->>'name',200)); end loop;
 return code;
end $$;
grant execute on function create_order(jsonb) to anon, authenticated;
