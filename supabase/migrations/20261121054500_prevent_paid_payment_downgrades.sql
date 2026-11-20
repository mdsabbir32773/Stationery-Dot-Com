create or replace function public.admin_set_order_payment(p_order_id uuid,p_status text)
returns text language plpgsql security definer set search_path=public as $$
declare o public.orders; p public.payments;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_status not in ('Pending','Verification Pending','Paid','Failed','Refunded') then raise exception 'Invalid payment status'; end if;
 select * into o from public.orders where id=p_order_id and target_link is null for update;
 if not found then raise exception 'Order not found'; end if;
 select * into p from public.payments where order_id=p_order_id order by created_at desc limit 1 for update;
 if not found then raise exception 'Payment record not found'; end if;
 if o.status in ('Cancelled','Refunded') and p_status='Paid' then raise exception 'Cannot mark a cancelled or refunded order as paid'; end if;
 if p.status='Paid' and p_status in ('Pending','Verification Pending','Failed') then raise exception 'A confirmed payment cannot be downgraded. Use Refunded after handling the customer refund'; end if;
 if p_status='Failed' and o.status in ('Processing','Completed') then raise exception 'A processed order cannot have its payment changed to Failed'; end if;
 if p_status='Refunded' and p.status<>'Paid' then raise exception 'Only a confirmed payment can be marked Refunded'; end if;
 update public.payments set status=p_status,paid_at=case when p_status='Paid' then coalesce(paid_at,now()) else null end where id=p.id;
 if p_status='Paid' and o.status in ('Pending','Payment Pending') then update public.orders set status='Payment Received',updated_at=now() where id=o.id;
 elsif p_status='Failed' and o.status='Payment Received' then update public.orders set status='Payment Pending',updated_at=now() where id=o.id;
 elsif p_status='Refunded' and o.status in ('Payment Received','Processing','Completed') then update public.orders set status='Refunded',updated_at=now() where id=o.id;
 end if;
 return p_status;
end $$;
