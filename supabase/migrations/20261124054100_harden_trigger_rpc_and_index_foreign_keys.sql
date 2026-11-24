-- Harden trigger-only SECURITY DEFINER functions against direct Data API invocation.
-- PostgreSQL trigger execution does not require callers to have EXECUTE on the trigger function.
REVOKE EXECUTE ON FUNCTION public.attach_order_customer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_loyalty_for_completed_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_customer_referral_code() FROM PUBLIC, anon, authenticated;

-- Add covering indexes for foreign keys flagged by the Supabase performance advisor.
CREATE INDEX IF NOT EXISTS idx_admin_catalog_costs_updated_by ON public.admin_catalog_costs(updated_by);
CREATE INDEX IF NOT EXISTS idx_admin_order_financials_updated_by ON public.admin_order_financials(updated_by);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_referred_by ON public.customer_profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_customer_saved_services_service_id ON public.customer_saved_services(service_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order_id ON public.loyalty_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_admin_id ON public.support_tickets(admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_order_id ON public.support_tickets(order_id);
