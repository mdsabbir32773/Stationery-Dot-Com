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

  if coalesce(v_api_key, '') = '' then return new; end if;

  select array_agg(distinct u.email) into v_to
  from public.admin_profiles ap
  join auth.users u on u.id = ap.id
  where u.email is not null and u.email <> '';

  if coalesce(array_length(v_to, 1), 0) = 0 then return new; end if;

  v_url := case
    when new.type = 'deposit' or new.deposit_request_id is not null
      then 'https://stationerydotcom.me/admin/deposits'
    when new.order_id is not null
      then 'https://stationerydotcom.me/admin/orders/' || new.order_id::text
    else 'https://stationerydotcom.me/admin/orders'
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
      'text', new.title || chr(10) || chr(10) || new.message || chr(10) || chr(10) || 'Open Admin: ' || v_url
    ),
    timeout_milliseconds := 5000
  ) into v_request_id;

  return new;
exception when others then
  raise warning 'Admin notification email could not be queued: %', sqlerrm;
  return new;
end;
$$;
