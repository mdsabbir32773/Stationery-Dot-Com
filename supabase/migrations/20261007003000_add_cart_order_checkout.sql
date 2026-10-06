create or replace function public.create_cart_orders(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  code text;
  codes jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') < 1 then
    raise exception 'Cart is empty';
  end if;
  if jsonb_array_length(p->'items') > 50 then raise exception 'Too many cart items'; end if;

  for item in select value from jsonb_array_elements(p->'items') loop
    code := public.create_order(
      jsonb_build_object(
        'customer_name', p->>'customer_name',
        'phone', p->>'phone',
        'whatsapp', p->>'whatsapp',
        'email', p->>'email',
        'quantity', coalesce(item->>'quantity','1'),
        'package_id', item->>'package_id',
        'files', coalesce(item->'files','[]'::jsonb),
        'notes', coalesce(item->>'notes',p->>'notes',''),
        'transaction_id', 'PROOF:' || coalesce(p->>'payment_proof_path',''),
        'payment_proof_path', p->>'payment_proof_path',
        'method', p->>'method'
      )
    );
    codes := codes || to_jsonb(code);
  end loop;
  return codes;
end
$$;

revoke all on function public.create_cart_orders(jsonb) from public, anon, authenticated;
grant execute on function public.create_cart_orders(jsonb) to anon, authenticated;
