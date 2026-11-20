-- Allow an admin to reverse an already-approved wallet deposit safely.
-- The reversal is recorded as an adjustment; the original deposit transaction is preserved.
create or replace function public.reverse_smm_deposit(p_request_id uuid,p_note text default null)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.deposit_requests;
  bal numeric(12,2);
  uid uuid:=auth.uid();
begin
  if uid is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into r
  from public.deposit_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Deposit request not found'; end if;
  if r.status<>'Approved' then raise exception 'Only approved deposits can be reversed'; end if;

  select balance into bal
  from public.wallets
  where user_id=r.user_id
  for update;

  if not found then raise exception 'Customer wallet not found'; end if;
  if bal<r.amount then
    raise exception 'Cannot reverse: customer has already used this balance. Current balance: ৳%, deposit: ৳%', bal, r.amount;
  end if;

  update public.wallets
  set balance=balance-r.amount,updated_at=now()
  where user_id=r.user_id;

  insert into public.wallet_transactions(user_id,amount,transaction_type,reference,description)
  values(r.user_id,-r.amount,'adjustment',r.transaction_id,'Deposit approval reversed · '||r.method);

  update public.deposit_requests
  set status='Rejected',
      admin_note=left(coalesce(nullif(trim(p_note),''),'Approved deposit reversed by admin'),500),
      reviewed_by=uid,
      reviewed_at=now()
  where id=r.id;

  return 'Rejected';
end;
$$;

revoke all on function public.reverse_smm_deposit(uuid,text) from public;
grant execute on function public.reverse_smm_deposit(uuid,text) to authenticated;
