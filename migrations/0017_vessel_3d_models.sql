-- Push A3 — Vessel 3D Twin Viewer.
-- Asset registry for per-vessel glTF/glb models with equipment-pin metadata.
-- Files live on the application-owned filesystem; this table records the
-- stored path, mime, size and pin coordinates that the auth-checked GET
-- routes resolve. See server/routes/vessel-3d-routes.ts.

CREATE TABLE IF NOT EXISTS "vessel_3d_models" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id"),
  "filename" text NOT NULL,
  "mimetype" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "stored_path" text NOT NULL,
  "equipment_pins" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_vessel_3d_models_org"
  ON "vessel_3d_models" ("org_id");

CREATE INDEX IF NOT EXISTS "idx_vessel_3d_models_vessel"
  ON "vessel_3d_models" ("org_id", "vessel_id");
