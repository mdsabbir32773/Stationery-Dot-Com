-- Customer accounts and account-linked order history. Run after schema.sql.
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
create index if not exists orders_customer_id_created_at_idx on public.orders(customer_id, created_at desc);

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;

create or replace function public.sync_customer_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.customer_profiles(id,email,full_name,updated_at)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),now())
  on conflict(id) do update set email=excluded.email,
    full_name=case when coalesce(excluded.full_name,'')<>'' then excluded.full_name else customer_profiles.full_name end,
    updated_at=now();
  return new;
end $$;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created after insert or update of email,raw_user_meta_data
on auth.users for each row execute function public.sync_customer_profile();

insert into public.customer_profiles(id,email,full_name)
select id,email,coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name','') from auth.users
on conflict(id) do update set email=excluded.email;

create or replace function public.attach_order_to_customer()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.customer_id := auth.uid();
  return new;
end $$;
drop trigger if exists attach_customer_to_new_order on public.orders;
create trigger attach_customer_to_new_order before insert on public.orders
for each row execute function public.attach_order_to_customer();

drop policy if exists "customer reads own profile" on public.customer_profiles;
create policy "customer reads own profile" on public.customer_profiles for select to authenticated using(id=auth.uid());
drop policy if exists "customer updates own profile" on public.customer_profiles;
drop policy if exists "admin manages customer profiles" on public.customer_profiles;
create policy "admin manages customer profiles" on public.customer_profiles for all to authenticated using(is_admin()) with check(is_admin());

drop policy if exists "customer reads own orders" on public.orders;
create policy "customer reads own orders" on public.orders for select to authenticated using(customer_id=auth.uid());
drop policy if exists "customer reads own payments" on public.payments;
create policy "customer reads own payments" on public.payments for select to authenticated using(
  exists(select 1 from public.orders o where o.id=payments.order_id and o.customer_id=auth.uid())
);

comment on column public.orders.customer_id is 'Auth user who placed this order while signed in. Guest orders remain null.';
