-- Keep trigger-only SECURITY DEFINER functions out of the public RPC surface.
REVOKE ALL ON FUNCTION public.email_admin_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_new_deposit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_new_order() FROM PUBLIC, anon, authenticated;

-- Cover foreign keys used by joins/deletes and remove the duplicate service index.
CREATE INDEX IF NOT EXISTS admin_notifications_deposit_request_id_idx ON public.admin_notifications (deposit_request_id);
CREATE INDEX IF NOT EXISTS admin_notifications_order_id_idx ON public.admin_notifications (order_id);
CREATE INDEX IF NOT EXISTS coupons_package_id_idx ON public.coupons (package_id);
CREATE INDEX IF NOT EXISTS coupons_service_id_idx ON public.coupons (service_id);
CREATE INDEX IF NOT EXISTS sdc_fb_automation_logs_conversation_id_idx ON public.sdc_fb_automation_logs (conversation_id);
DROP INDEX IF EXISTS public.idx_orders_service_id_count;
