-- Recipe cover photo metadata — additive, nullable. A recipe has at most one
-- active cover; the image itself lives in the recipe-media Storage bucket,
-- never in Postgres. No new RLS policy needed: recipes_select_own /
-- recipes_update_own (auth.uid() = user_id) already cover these columns on
-- any row the user owns, exactly like the source_url/source_title precedent.
ALTER TABLE public.recipes
  ADD COLUMN cover_storage_bucket text,
  ADD COLUMN cover_storage_path text,
  ADD COLUMN cover_source text,
  ADD CONSTRAINT recipes_cover_source_check
    CHECK (cover_source IS NULL OR cover_source IN ('direct_upload', 'cooking_photo')),
  ADD CONSTRAINT recipes_cover_bucket_path_pair_check
    CHECK ((cover_storage_bucket IS NULL) = (cover_storage_path IS NULL));
