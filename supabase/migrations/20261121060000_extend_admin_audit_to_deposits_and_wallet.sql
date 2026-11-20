create or replace function public.log_admin_deposit_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.is_admin() then
  insert into public.admin_activity_logs(actor_id,entity_type,entity_id,action,details)
  values(auth.uid(),'deposit',new.id::text,'deposit_status_changed',
    jsonb_build_object('customer_id',new.user_id,'amount',new.amount,'method',new.method,
      'old_status',old.status,'new_status',new.status,'admin_note',new.admin_note));
 end if;
 return new;
end $$;
drop trigger if exists deposit_requests_admin_audit on public.deposit_requests;
create trigger deposit_requests_admin_audit after update of status on public.deposit_requests
for each row when (old.status is distinct from new.status)
execute function public.log_admin_deposit_change();

create or replace function public.log_admin_wallet_transaction()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.is_admin() then
  insert into public.admin_activity_logs(actor_id,entity_type,entity_id,action,details)
  values(auth.uid(),'wallet_transaction',new.id::text,'wallet_transaction_created',
    jsonb_build_object('customer_id',new.user_id,'amount',new.amount,'type',new.transaction_type,
      'reference',new.reference,'description',new.description,'order_id',new.order_id));
 end if;
 return new;
end $$;
drop trigger if exists wallet_transactions_admin_audit on public.wallet_transactions;
create trigger wallet_transactions_admin_audit after insert on public.wallet_transactions
for each row execute function public.log_admin_wallet_transaction();
revoke all on function public.log_admin_deposit_change() from public,anon,authenticated;
revoke all on function public.log_admin_wallet_transaction() from public,anon,authenticated;
