-- Public clients only need to read the public catalogue and site payment/contact settings.
-- Orders are created and tracked through carefully scoped SECURITY DEFINER RPCs.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON TABLE public.services, public.packages, public.site_settings TO anon;

-- Prevent future postgres-owned public tables from receiving automatic anon grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
