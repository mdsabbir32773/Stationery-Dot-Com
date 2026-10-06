-- Use private receipt screenshots for manual mobile wallet orders/deposits.
-- Existing transaction references and payment/deposit rows remain untouched.

alter table public.payments
  add column if not exists payment_proof_path text;

create or replace function public.attach_order_payment_proof()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.transaction_id, '') like 'PROOF:uploads/payproof-%' then
    new.payment_proof_path := substring(new.transaction_id from 7);
    if new.payment_proof_path !~ '^uploads/payproof-[A-Za-z0-9._-]+$' then
      raise exception 'Invalid payment screenshot path';
    end if;
    if not exists (select 1 from storage.objects where bucket_id='order-files' and name=new.payment_proof_path) then
      raise exception 'Payment screenshot was not uploaded';
    end if;
    new.transaction_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_attach_order_payment_proof on public.payments;
create trigger payments_attach_order_payment_proof
  before insert on public.payments
  for each row execute function public.attach_order_payment_proof();

alter table public.deposit_requests
  alter column transaction_id drop not null,
  add column if not exists payment_proof_path text;

create or replace function public.request_smm_deposit_with_proof(
  p_method text,
  p_amount numeric,
  p_proof_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'Sign in to request a deposit'; end if;
  if p_method not in ('bKash', 'Nagad', 'Rocket', 'Bank transfer') then raise exception 'Invalid payment method'; end if;
  if p_amount is null or p_amount < 50 or p_amount > 1000000 then raise exception 'Deposit must be between ৳50 and ৳1,000,000'; end if;
  if coalesce(p_proof_path, '') !~ '^uploads/payproof-[A-Za-z0-9._-]+$' then raise exception 'A valid payment screenshot is required'; end if;
  if not exists (select 1 from storage.objects where bucket_id='order-files' and name=p_proof_path) then raise exception 'Payment screenshot was not uploaded'; end if;

  insert into public.wallets(user_id) values(uid) on conflict(user_id) do nothing;
  insert into public.deposit_requests(user_id, method, amount, payment_proof_path)
    values(uid, p_method, round(p_amount, 2), p_proof_path)
    returning id into rid;
  return rid;
end;
$$;

revoke all on function public.request_smm_deposit_with_proof(text, numeric, text) from public, anon;
grant execute on function public.request_smm_deposit_with_proof(text, numeric, text) to authenticated;

notify pgrst, 'reload schema';
