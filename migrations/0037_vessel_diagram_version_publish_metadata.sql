ALTER TABLE "vessel_diagram_versions"
  ADD COLUMN IF NOT EXISTS "published_by" varchar REFERENCES "users"("id");

ALTER TABLE "vessel_diagram_versions"
  ADD COLUMN IF NOT EXISTS "published_at" timestamp;
