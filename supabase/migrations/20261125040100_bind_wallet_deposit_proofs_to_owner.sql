CREATE OR REPLACE FUNCTION public.request_smm_deposit_with_proof(
  p_method text,
  p_amount numeric,
  p_proof_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a deposit';
  END IF;
  IF p_method NOT IN ('Bangla QR','bKash','Nagad','Rocket','Bank transfer') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_amount IS NULL OR p_amount < 50 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'Deposit must be between ৳50 and ৳1,000,000';
  END IF;
  IF coalesce(p_proof_path, '') !~ '^uploads/payproof-[A-Za-z0-9._-]+$' THEN
    RAISE EXCEPTION 'A valid payment screenshot is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id='order-files'
      AND name=p_proof_path
      AND owner_id::text=uid::text
  ) THEN
    RAISE EXCEPTION 'Payment screenshot must be uploaded from your signed-in account';
  END IF;
  INSERT INTO public.wallets(user_id)
  VALUES(uid)
  ON CONFLICT(user_id) DO NOTHING;
  INSERT INTO public.deposit_requests(user_id,method,amount,payment_proof_path)
  VALUES(uid,p_method,round(p_amount,2),p_proof_path)
  RETURNING id INTO rid;
  RETURN rid;
END;
$function$;
