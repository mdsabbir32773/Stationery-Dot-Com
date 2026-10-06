-- Customer reviews for completed service orders. Run once in Supabase SQL Editor.
create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text not null check (char_length(trim(review)) between 1 and 1200),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists service_reviews_public_idx on public.service_reviews(service_id, created_at desc) where status='approved';
create index if not exists service_reviews_user_idx on public.service_reviews(user_id, created_at desc);
alter table public.service_reviews enable row level security;
drop policy if exists "public reads approved service reviews" on public.service_reviews;
create policy "public reads approved service reviews" on public.service_reviews for select to anon, authenticated using(status='approved');
drop policy if exists "customer reads own service reviews" on public.service_reviews;
create policy "customer reads own service reviews" on public.service_reviews for select to authenticated using(user_id=auth.uid());
drop policy if exists "customer submits review for completed order" on public.service_reviews;
create policy "customer submits review for completed order" on public.service_reviews for insert to authenticated with check (
  user_id=auth.uid() and status='pending' and reviewed_at is null and exists (
    select 1 from public.orders o where o.id=service_reviews.order_id and o.customer_id=auth.uid() and o.service_id=service_reviews.service_id and o.status='Completed'
  )
);
drop policy if exists "admin manages service reviews" on public.service_reviews;
create policy "admin manages service reviews" on public.service_reviews for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.service_reviews to anon, authenticated;
grant insert on public.service_reviews to authenticated;
grant update, delete on public.service_reviews to authenticated;
