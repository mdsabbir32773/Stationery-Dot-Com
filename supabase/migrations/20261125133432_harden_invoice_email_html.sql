create or replace function public.handle_invoice_request_review() returns trigger language plpgsql security definer set search_path=public,vault,net,pg_temp as $$
declare v_order public.orders;v_email text;v_api_key text;v_request_id bigint;v_invoice_url text;v_message text;v_name text;
begin
 if new.status is distinct from 'approved' or old.status='approved' then return new;end if;
 select * into v_order from public.orders where id=new.order_id;if not found then return new;end if;
 v_invoice_url:='https://stationerydotcom.me/invoice/'||v_order.order_code;v_name:=coalesce(v_order.customer_name,'Customer');
 v_name:=replace(replace(replace(replace(v_name,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;');
 v_message:='Your invoice for order '||v_order.order_code||' is ready. Open: '||v_invoice_url||E'\n\nFor privacy, enter the mobile number used for this order to view or save your invoice as PDF.';
 if v_order.customer_id is not null then insert into public.customer_notifications(user_id,order_id,title,message,type) values(v_order.customer_id,v_order.id,'Your invoice is ready',v_message,'order');end if;
 select coalesce(nullif(v_order.email,''),nullif(cp.email,'')) into v_email from (select 1) x left join public.customer_profiles cp on cp.id=v_order.customer_id;
 if coalesce(v_email,'')='' then update public.invoice_requests set email_delivery_status='no_email',email_error='No customer email is available on this order or account.' where id=new.id;return new;end if;
 select decrypted_secret into v_api_key from vault.decrypted_secrets where name='resend_api_key' order by created_at desc limit 1;
 if coalesce(v_api_key,'')='' then update public.invoice_requests set email_delivery_status='not_configured',email_error='Resend API key is not configured in Supabase Vault.' where id=new.id;return new;end if;
 select net.http_post(url:='https://api.resend.com/emails',headers:=jsonb_build_object('Authorization','Bearer '||v_api_key,'Content-Type','application/json'),body:=jsonb_build_object(
 'from','Stationery Dot Com <onboarding@resend.dev>','to',jsonb_build_array(v_email),'subject','Your invoice is ready · '||v_order.order_code,
 'html','<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#20384e"><div style="border-top:6px solid #0a9585;padding:24px 0"><h1 style="margin:0">Stationery Dot Com</h1><p style="color:#748592">Your invoice is ready</p></div><p>Hello '||v_name||',</p><p>Your invoice for order <strong>'||v_order.order_code||'</strong> has been approved and is ready to view.</p><p><a href="'||v_invoice_url||'" style="display:inline-block;background:#087f75;color:white;padding:12px 18px;text-decoration:none;border-radius:6px">View invoice</a></p><p>For privacy, enter the mobile number used for this order. You can then print or save the invoice as PDF.</p><p>Thank you,<br>Stationery Dot Com</p></div>',
 'text',v_message||E'\n\nThank you, Stationery Dot Com'),timeout_milliseconds:=5000) into v_request_id;
 update public.invoice_requests set email_delivery_status='queued',email_request_id=v_request_id,email_error=null where id=new.id;return new;
exception when others then update public.invoice_requests set email_delivery_status='queue_error',email_error=left(sqlerrm,500) where id=new.id;raise warning 'Invoice email could not be queued for order %: %',new.order_id,sqlerrm;return new;
end $$;
revoke all on function public.handle_invoice_request_review() from public,anon,authenticated;
