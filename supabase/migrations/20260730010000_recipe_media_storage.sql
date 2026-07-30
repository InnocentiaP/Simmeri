-- Private Storage bucket for recipe cover photos. Reused unchanged by a
-- later Cooking History / Cooking Photos checkpoint (a new path prefix
-- under this same bucket, no new Storage policy migration needed then)
-- because every object path begins with the owning user's id
-- ({user_id}/recipes/{recipe_id}/cover/{uuid}.{ext}), so the policies below
-- key ownership on that first path segment alone.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-media', 'recipe-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "recipe_media_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe_media_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe_media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe_media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);
