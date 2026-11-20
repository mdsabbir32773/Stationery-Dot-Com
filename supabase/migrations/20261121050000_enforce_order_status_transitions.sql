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
 if p_status='Failed' and o.status in ('Processing','Completed') then raise exception 'A processed order cannot have its payment changed to Failed'; end if;
 if p_status='Refunded' and p.status<>'Paid' then raise exception 'Only a confirmed payment can be marked Refunded'; end if;
 update public.payments set status=p_status,paid_at=case when p_status='Paid' then coalesce(paid_at,now()) else null end where id=p.id;
 if p_status='Paid' and o.status in ('Pending','Payment Pending') then update public.orders set status='Payment Received',updated_at=now() where id=o.id;
 elsif p_status='Failed' and o.status='Payment Received' then update public.orders set status='Payment Pending',updated_at=now() where id=o.id;
 elsif p_status='Refunded' and o.status in ('Payment Received','Processing','Completed') then update public.orders set status='Refunded',updated_at=now() where id=o.id;
 end if;
 return p_status;
end $$;

create or replace function public.admin_set_order_status(p_order_id uuid,p_status text)
returns text language plpgsql security definer set search_path=public as $$
declare o public.orders; paid boolean;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_status not in ('Pending','Payment Pending','Payment Received','Processing','Completed','Cancelled','Refunded') then raise exception 'Invalid order status'; end if;
 select * into o from public.orders where id=p_order_id and target_link is null for update;
 if not found then raise exception 'Order not found'; end if;
 if o.status in ('Cancelled','Refunded','Completed') and p_status<>o.status then raise exception 'This order is in a final state and cannot be reopened or changed'; end if;
 select exists(select 1 from public.payments where order_id=o.id and status='Paid') into paid;
 if p_status in ('Payment Received','Processing','Completed','Refunded') and not paid then raise exception 'Payment must be marked Paid before this order can progress'; end if;
 if o.status='Pending' and p_status not in ('Pending','Payment Pending','Payment Received','Cancelled') then raise exception 'Invalid transition from Pending'; end if;
 if o.status='Payment Pending' and p_status not in ('Payment Pending','Payment Received','Cancelled') then raise exception 'Invalid transition from Payment Pending'; end if;
 if o.status='Payment Received' and p_status not in ('Payment Received','Processing','Completed','Cancelled','Refunded') then raise exception 'Invalid transition from Payment Received'; end if;
 if o.status='Processing' and p_status not in ('Processing','Completed','Cancelled','Refunded') then raise exception 'Invalid transition from Processing'; end if;
 update public.orders set status=p_status,updated_at=now() where id=o.id;
 if p_status='Refunded' then update public.payments set status='Refunded' where order_id=o.id and status='Paid'; end if;
 return p_status;
end $$;
