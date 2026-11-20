create or replace function public.track_order(p_code text, p_phone text)
returns json language sql security definer set search_path=public as $$
 select json_build_object('order_code',o.order_code,'service_name',o.service_name,'package_name',o.package_name,'quantity',o.quantity,'total',o.total,'status',o.status,'created_at',o.created_at,
 'payment_status',(select status from public.payments where order_id=o.id order by created_at desc limit 1))
 from public.orders o
 where upper(o.order_code)=upper(trim(p_code))
 and right(regexp_replace(o.phone,'\D','','g'),10)=right(regexp_replace(p_phone,'\D','','g'),10)
 limit 1
$$;
