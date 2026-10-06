-- Store optional public cover images for services.
-- Safe to apply on databases where the optional service-images.sql was used already.
alter table public.services add column if not exists image_url text;
