-- Optional migration: lets each service have a cover image. Safe to run more than once.
-- Without it the website still works (every service gets an automatic category cover).
alter table services add column if not exists image_url text;
