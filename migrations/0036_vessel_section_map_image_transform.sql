ALTER TABLE "vessel_section_maps"
  ADD COLUMN IF NOT EXISTS "image_transform" jsonb;

UPDATE "vessel_section_maps"
SET "image_transform" = '{"scaleX":1,"scaleY":1,"offsetX":0,"offsetY":0}'::jsonb
WHERE "image_transform" IS NULL;
