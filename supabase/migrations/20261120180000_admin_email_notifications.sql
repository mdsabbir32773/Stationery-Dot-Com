-- Ensure deposit requests create admin alerts and optionally email every new admin notification via Resend.
-- Store the Resend API key in Supabase Vault as "resend_api_key" to enable email delivery.

create or replace function public.notify_admin_new_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer text;
begin
  select coalesce(nullif(full_name,''), nullif(email,''), 'Customer')
    into v_customer
  from public.customer_profiles
  where id = new.user_id;

  insert into public.admin_notifications(type, deposit_request_id, title, message)
  values (
    'deposit',
    new.id,
    'New deposit request',
    coalesce(v_customer, 'Customer') || ' requested ৳' ||
      to_char(new.amount, 'FM999,999,990.00') || ' via ' || new.method
  );

  return new;
end;
$$;

drop trigger if exists admin_notify_deposit_insert on public.deposit_requests;
create trigger admin_notify_deposit_insert
after insert on public.deposit_requests
for each row execute function public.notify_admin_new_deposit();

-- The notification row is always saved first. Email is best-effort and must never block checkout/deposit.
create or replace function public.email_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_api_key text;
  v_to text[];
  v_url text;
  v_request_id bigint;
begin
  select decrypted_secret into v_api_key
  from vault.decrypted_secrets
  where name = 'resend_api_key'
  order by created_at desc
  limit 1;

  if coalesce(v_api_key, '') = '' then
    return new;
  end if;

  select array_agg(distinct u.email)
    into v_to
  from public.admin_profiles ap
  join auth.users u on u.id = ap.id
  where u.email is not null and u.email <> '';

  if coalesce(array_length(v_to, 1), 0) = 0 then
    return new;
  end if;

  v_url := case
    when new.type = 'deposit' or new.deposit_request_id is not null
      then 'https://stationerydotcom.stdc.workers.dev/admin/deposits'
    when new.order_id is not null
      then 'https://stationerydotcom.stdc.workers.dev/admin/orders/' || new.order_id::text
    else 'https://stationerydotcom.stdc.workers.dev/admin/orders'
  end;

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Stationery Dot Com <onboarding@resend.dev>',
      'to', v_to,
      'subject', 'Stationery Dot Com: ' || new.title,
      'text', new.title || E'\n\n' || new.message || E'\n\nOpen Admin: ' || v_url
    ),
    timeout_milliseconds := 5000
  ) into v_request_id;

  return new;
exception when others then
  raise warning 'Admin notification email could not be queued: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists admin_notification_email_after_insert on public.admin_notifications;
create trigger admin_notification_email_after_insert
after insert on public.admin_notifications
for each row execute function public.email_admin_notification();
