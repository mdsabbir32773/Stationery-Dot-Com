DO $migration$
DECLARE
  v_def text;
  v_new text;
  v_old text;
  v_replacement text;
BEGIN
  v_def := pg_get_functiondef('public.create_order(jsonb)'::regprocedure);
  v_old := $old$nf:=nf+1; if nf>5 or coalesce(f->>'path','') !~ '^uploads/[A-Za-z0-9._-]+$' then raise exception 'Invalid file'; end if;$old$;
  v_replacement := $new$nf:=nf+1;
   if nf>5 or coalesce(f->>'path','') !~ '^uploads/[A-Za-z0-9._-]+$' then
     raise exception 'Invalid file';
   end if;
   if not exists (
     select 1 from storage.objects so
     where so.bucket_id='order-files'
       and so.name=f->>'path'
       and (
         (auth.uid() is null and so.owner_id is null)
         or (auth.uid() is not null and so.owner_id::text=auth.uid()::text)
       )
   ) then
     raise exception 'Uploaded file does not belong to this checkout';
   end if;$new$;
  v_new := replace(v_def, v_old, v_replacement);
  if v_new = v_def then
    raise exception 'Could not locate create_order file validation block';
  end if;
  execute v_new;

  CREATE OR REPLACE FUNCTION public.attach_order_payment_proof()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
  BEGIN
    IF coalesce(NEW.transaction_id, '') LIKE 'PROOF:uploads/payproof-%' THEN
      NEW.payment_proof_path := substring(NEW.transaction_id from 7);
      IF NEW.payment_proof_path !~ '^uploads/payproof-[A-Za-z0-9._-]+$' THEN
        RAISE EXCEPTION 'Invalid payment screenshot path';
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM storage.objects so
        WHERE so.bucket_id='order-files'
          AND so.name=NEW.payment_proof_path
          AND (
            (auth.uid() IS NULL AND so.owner_id IS NULL)
            OR (auth.uid() IS NOT NULL AND so.owner_id::text=auth.uid()::text)
          )
      ) THEN
        RAISE EXCEPTION 'Payment screenshot upload does not belong to this checkout';
      END IF;
      NEW.transaction_id := NULL;
    END IF;
    RETURN NEW;
  END;
  $function$;
END;
$migration$;
