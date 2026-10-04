-- Allows PDF payment QR files (and raises the limit to 10MB) in the existing public "site-assets" bucket.
-- Safe to run more than once. Existing files and policies are not touched.
update storage.buckets set file_size_limit=10485760, allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'] where id='site-assets';
