alter table public.service_reviews
  alter column review set default '';

alter table public.service_reviews
  drop constraint if exists service_reviews_review_check;

alter table public.service_reviews
  add constraint service_reviews_review_check
  check (char_length(trim(review)) between 0 and 1200);
