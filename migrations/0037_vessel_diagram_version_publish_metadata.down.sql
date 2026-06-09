ALTER TABLE "vessel_diagram_versions"
  DROP COLUMN IF EXISTS "published_at";

ALTER TABLE "vessel_diagram_versions"
  DROP COLUMN IF EXISTS "published_by";
