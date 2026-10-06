-- Use the owner-provided Stationery Dot Com logo bundled with the site.
-- Admin > Settings can still upload and select a replacement later.
insert into public.site_settings(key, value)
values ('logo_url', '/stationery-dot-com-logo.webp')
on conflict (key) do update set value = excluded.value;
