insert into public.packages (service_id,name,description,price,unit,is_active,sort_order,access_type,duration_months)
select s.id,v.name,v.description,v.price,'per month',true,v.sort_order,'personal',1
from public.services s
cross join (values
  ('ChatGPT Go - Personal Account','1 month on your own ChatGPT account. Expanded access to eligible messages, file uploads, image generation, data analysis and longer memory. API usage is not included.',1100::numeric,1),
  ('ChatGPT Plus - Personal Account','1 month on your own ChatGPT account. Higher model and usage limits, advanced reasoning, image generation, file upload and analysis, Deep Research where available, and coding capabilities. API usage is not included.',3000::numeric,2)
) v(name,description,price,sort_order)
where s.slug='chatgpt-go-plus'
  and not exists (select 1 from public.packages p where p.service_id=s.id and p.name=v.name and p.is_active=true);