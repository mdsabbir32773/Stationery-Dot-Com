-- Fix ambiguous "code" reference in coupon validation.
-- The PL/pgSQL local variable now has a distinct name from coupons.code.

create or replace function public.validate_coupon(
  p_code text,
  p_subtotal numeric,
  p_service_id uuid,
  p_package_id uuid
)
returns jsonb
language plpgsql
stable
set search_path = public
as $function$
declare
  v_coupon public.coupons%rowtype;
  v_discount numeric := 0;
  v_coupon_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_coupon_code = '' then
    return jsonb_build_object('valid', false, 'message', 'Enter a coupon code.');
  end if;

  select c.*
    into v_coupon
    from public.coupons as c
   where upper(c.code) = v_coupon_code
     and c.is_active
     and (c.starts_at is null or c.starts_at <= now())
     and (c.expires_at is null or c.expires_at > now())
     and (c.usage_limit is null or c.used_count < c.usage_limit)
     and c.min_order <= coalesce(p_subtotal, 0)
     and (c.service_id is null or c.service_id = p_service_id)
     and (c.package_id is null or c.package_id = p_package_id)
   limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'This coupon is invalid, expired, or not eligible for this order.');
  end if;

  if v_coupon.discount_type = 'percent' then
    v_discount := coalesce(p_subtotal, 0) * v_coupon.discount_value / 100;
  else
    v_discount := v_coupon.discount_value;
  end if;

  if v_coupon.max_discount is not null then
    v_discount := least(v_discount, v_coupon.max_discount);
  end if;

  v_discount := greatest(0, least(v_discount, coalesce(p_subtotal, 0)));

  return jsonb_build_object(
    'valid', true,
    'code', v_coupon.code,
    'discount', round(v_discount, 2),
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value
  );
end;
$function$;

revoke all on function public.validate_coupon(text, numeric, uuid, uuid) from public;
grant execute on function public.validate_coupon(text, numeric, uuid, uuid) to anon, authenticated;
