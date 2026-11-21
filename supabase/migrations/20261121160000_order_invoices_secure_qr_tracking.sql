-- Secure invoice lookup and QR-only public order tracking.
alter table public.orders add column if not exists tracking_token text;
update public.orders set tracking_token=encode(gen_random_bytes(24),'hex') where tracking_token is null or tracking_token='';
alter table public.orders alter column tracking_token set default encode(gen_random_bytes(24),'hex'), alter column tracking_token set not null;
create unique index if not exists orders_tracking_token_uidx on public.orders(tracking_token);
create or replace function public.get_order_invoice(p_code text,p_phone text) returns jsonb language sql security definer stable set search_path=public,pg_temp as $$
 select jsonb_build_object('invoice_number','INV-'||o.order_code,'order_code',o.order_code,'customer_name',o.customer_name,'phone',o.phone,'email',o.email,'service_name',o.service_name,'package_name',o.package_name,'unit_price',o.unit_price,'quantity',o.quantity,'subtotal',o.unit_price*o.quantity,'discount_amount',coalesce(o.discount_amount,0),'coupon_code',o.coupon_code,'total',o.total,'status',o.status,'payment_status',coalesce(pm.status,'Pending'),'payment_method',pm.method,'paid_at',pm.paid_at,'created_at',o.created_at,'updated_at',o.updated_at,'tracking_token',o.tracking_token)
 from public.orders o left join lateral (select p.status,p.method,p.paid_at from public.payments p where p.order_id=o.id order by p.created_at desc limit 1) pm on true
 where upper(o.order_code)=upper(trim(coalesce(p_code,''))) and right(regexp_replace(o.phone,'[^0-9]','','g'),10)=right(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),10) and length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'))>=10 limit 1
$$;
create or replace function public.get_public_order_tracking(p_token text) returns jsonb language sql security definer stable set search_path=public,pg_temp as $$
 select jsonb_build_object('order_code',o.order_code,'service_name',o.service_name,'package_name',o.package_name,'quantity',o.quantity,'total',o.total,'status',o.status,'payment_status',coalesce(pm.status,'Pending'),'created_at',o.created_at,'updated_at',o.updated_at)
 from public.orders o left join lateral (select p.status from public.payments p where p.order_id=o.id order by p.created_at desc limit 1) pm on true
 where o.tracking_token=trim(coalesce(p_token,'')) and length(trim(coalesce(p_token,'')))>=40 limit 1
$$;
revoke all on function public.get_order_invoice(text,text) from public,anon,authenticated;
revoke all on function public.get_public_order_tracking(text) from public,anon,authenticated;
grant execute on function public.get_order_invoice(text,text) to anon,authenticated; grant execute on function public.get_public_order_tracking(text) to anon,authenticated;