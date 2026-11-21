create index if not exists idx_customer_notifications_order_id on public.customer_notifications(order_id) where order_id is not null;
create index if not exists idx_customer_notifications_deposit_request_id on public.customer_notifications(deposit_request_id) where deposit_request_id is not null;
