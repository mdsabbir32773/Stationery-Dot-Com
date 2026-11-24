-- Remove duplicate admin notification policies (the retained is_admin() checks
-- perform the same admin_profiles membership test).
DROP POLICY IF EXISTS "admins read notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "admins update notifications" ON public.admin_notifications;

-- Evaluate auth.uid() once per statement rather than once per row.
ALTER POLICY "Customers read own loyalty transactions"
ON public.loyalty_transactions
USING (user_id = (SELECT auth.uid()));
