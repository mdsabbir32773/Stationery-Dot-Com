-- Allow admins to complete an order with an optional customer-visible account notification.
create or replace function public.admin_complete_order_with_note(
  p_order_id uuid,
  p_customer_note text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_order_code text;
  v_note text := nullif(left(trim(coalesce(p_customer_note, '')), 500), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  -- Reuse the existing guarded status transition, including payment checks.
  perform public.admin_set_order_status(p_order_id, 'Completed');

  select customer_id, order_code
    into v_customer_id, v_order_code
  from public.orders
  where id = p_order_id;

  if v_note is not null and v_customer_id is not null then
    insert into public.customer_notifications(user_id, order_id, title, message, type)
    values (
      v_customer_id,
      p_order_id,
      'A note about your completed order',
      'Order ' || coalesce(v_order_code, '') || ' is completed. ' || v_note,
      'order'
    );
  end if;

  return 'Completed';
end;
$$;

revoke all on function public.admin_complete_order_with_note(uuid, text) from public, anon;
grant execute on function public.admin_complete_order_with_note(uuid, text) to authenticated;
