-- The four-argument coupon validator is obsolete; the checkout now uses the
-- five-argument overload which also checks phone-based WELCOME5 eligibility.
-- Remove the old public RPC surface while preserving the active overload.
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, numeric, uuid, uuid)
FROM PUBLIC, anon, authenticated;
