create table if not exists public.invoice_requests (
 id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders(id) on delete cascade,
 customer_id uuid references auth.users(id) on delete set null,status text not null default 'pending' check(status in ('pending','approved','rejected')),
 requested_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id) on delete set null,
 email_delivery_status text not null default 'not_sent' check(email_delivery_status in ('not_sent','queued','not_configured','no_email','queue_error')),
 email_request_id bigint,email_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists invoice_requests_customer_status_idx on public.invoice_requests(customer_id,status,requested_at desc);
alter table public.invoice_requests enable row level security;
revoke all on public.invoice_requests from anon;grant select on public.invoice_requests to authenticated;
create policy "Customers can view own invoice requests" on public.invoice_requests for select to authenticated using(customer_id=(select auth.uid()));
create policy "Admins can view invoice requests" on public.invoice_requests for select to authenticated using(public.is_admin());
create or replace function public.request_order_invoice(p_code text,p_phone text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders;v_req public.invoice_requests;v_digits text;
begin
 v_digits:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if length(v_digits)<10 or length(v_digits)>13 or length(trim(coalesce(p_code,'')))<8 then return jsonb_build_object('status','not_found');end if;
 select * into v_order from public.orders where upper(order_code)=upper(trim(p_code)) and right(regexp_replace(phone,'[^0-9]','','g'),10)=right(v_digits,10) limit 1;
 if not found then return jsonb_build_object('status','not_found');end if;
 insert into public.invoice_requests(order_id,customer_id,status,requested_at,reviewed_at,reviewed_by,email_delivery_status,email_request_id,email_error,updated_at) values(v_order.id,v_order.customer_id,'pending',now(),null,null,'not_sent',null,null,now())
 on conflict(order_id) do update set customer_id=excluded.customer_id,status=case when invoice_requests.status='rejected' then 'pending' else invoice_requests.status end,
 requested_at=case when invoice_requests.status='rejected' then now() else invoice_requests.requested_at end,
 reviewed_at=case when invoice_requests.status='rejected' then null else invoice_requests.reviewed_at end,reviewed_by=case when invoice_requests.status='rejected' then null else invoice_requests.reviewed_by end,
 email_delivery_status=case when invoice_requests.status='rejected' then 'not_sent' else invoice_requests.email_delivery_status end,
 email_request_id=case when invoice_requests.status='rejected' then null else invoice_requests.email_request_id end,email_error=case when invoice_requests.status='rejected' then null else invoice_requests.email_error end,updated_at=now()
 returning * into v_req;
 return jsonb_build_object('status',v_req.status,'requested_at',v_req.requested_at);
end $$;
revoke all on function public.request_order_invoice(text,text) from public;grant execute on function public.request_order_invoice(text,text) to anon,authenticated;
create or replace function public.admin_review_invoice_request(p_order_id uuid,p_decision text) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_req public.invoice_requests;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required';end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid invoice decision';end if;
 select * into v_req from public.invoice_requests where order_id=p_order_id for update;
 if not found then raise exception 'Invoice request not found';end if;
 if v_req.status='approved' then return 'approved';end if;if v_req.status='rejected' and p_decision='rejected' then return 'rejected';end if;
 if v_req.status<>'pending' then raise exception 'Invoice request is not pending';end if;
 update public.invoice_requests set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=v_req.id;return p_decision;
end $$;
revoke all on function public.admin_review_invoice_request(uuid,text) from public,anon;grant execute on function public.admin_review_invoice_request(uuid,text) to authenticated;
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
create trigger trg_invoice_request_review after update of status on public.invoice_requests for each row execute function public.handle_invoice_request_review();
