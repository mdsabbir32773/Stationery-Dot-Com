-- Remove duplicate legacy order triggers. Keep the canonical admin notification
-- trigger and the customer-link trigger created by customer-accounts.sql.
DROP TRIGGER IF EXISTS orders_notify_admin ON public.orders;
DROP TRIGGER IF EXISTS attach_order_customer_before_insert ON public.orders;
