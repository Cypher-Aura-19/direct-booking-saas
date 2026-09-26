-- ---------------------------------------------------------------------------
-- M5 follow-up: restrict anon's storage read to resized variants only.
--
-- 20260926010000 let anon select any storage object under a published
-- property, including the ORIGINAL upload. An original can carry EXIF GPS
-- metadata (many phones embed the exact shot location by default), which
-- would hand out the precise coordinates of the address the 2026-09-25
-- owner decision already revoked from properties.address. The resized
-- .w480/960/1600.webp variants are re-encoded at upload (photo-variants.ts)
-- and carry no EXIF data, so only they are safe for anon to read.
-- ---------------------------------------------------------------------------

drop policy "property_photos_objects_published_anon_read" on storage.objects;

create policy "property_photos_objects_published_anon_read" on storage.objects
  for select
  to anon
  using (
    bucket_id = 'property-photos'
    and name ~ '\.w(480|960|1600)\.webp$'
    and public.is_published_property_object(name)
  );
