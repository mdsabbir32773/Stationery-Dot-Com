create index if not exists idx_invoice_requests_reviewed_by on public.invoice_requests(reviewed_by) where reviewed_by is not null;
