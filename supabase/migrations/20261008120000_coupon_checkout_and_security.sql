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
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare c coupons; d numeric:=0; code text:=upper(trim(coalesce(p_code,'')));
begin
 if code='' then return jsonb_build_object('valid',false,'message','Enter a coupon code.'); end if;
 select * into c from coupons where upper(coupons.code)=code and is_active
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

-- create_order is replaced in the live database to validate and atomically consume eligible coupons.
-- Keep the live function definition as the source of truth if additional checkout fields are added later.
alter table public.order_counters enable row level security;
drop policy if exists "admin order counters" on public.order_counters;
create policy "admin order counters" on public.order_counters for select to authenticated using(is_admin());
