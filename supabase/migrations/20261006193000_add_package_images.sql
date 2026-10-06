-- Add a related image to each package. Existing packages inherit their parent service image in this migration.
alter table public.packages add column if not exists image_url text;

update public.packages p
set image_url = s.image_url
from public.services s
where p.service_id = s.id
  and p.is_active = true
  and p.image_url is null;
