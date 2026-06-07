CREATE TABLE IF NOT EXISTS "vessel_diagrams" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id") ON DELETE cascade,
  "diagram_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'draft',
  "active_version_id" varchar,
  "current_section_map_id" varchar,
  "created_by" varchar REFERENCES "users"("id"),
  "updated_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vessel_diagram_versions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id") ON DELETE cascade,
  "diagram_id" varchar NOT NULL REFERENCES "vessel_diagrams"("id") ON DELETE cascade,
  "version_number" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'uploaded',
  "original_file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "content_sha256" varchar(64) NOT NULL,
  "object_key" text NOT NULL,
  "sanitized_svg" text,
  "view_box" jsonb,
  "validation_summary" jsonb,
  "uploaded_by" varchar REFERENCES "users"("id"),
  "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vessel_section_maps" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id") ON DELETE cascade,
  "diagram_id" varchar REFERENCES "vessel_diagrams"("id") ON DELETE SET NULL,
  "diagram_version_id" varchar REFERENCES "vessel_diagram_versions"("id") ON DELETE SET NULL,
  "source_map_id" varchar,
  "name" text NOT NULL,
  "coordinate_mode" text NOT NULL DEFAULT 'normalized_percent',
  "diagram_width" integer NOT NULL DEFAULT 895,
  "diagram_height" integer NOT NULL DEFAULT 420,
  "diagram_kind" text NOT NULL DEFAULT 'side_elevation',
  "status" text NOT NULL DEFAULT 'draft',
  "validation_summary" jsonb,
  "published_at" timestamp,
  "published_by" varchar REFERENCES "users"("id"),
  "created_by" varchar REFERENCES "users"("id"),
  "updated_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vessel_sections" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id") ON DELETE cascade,
  "map_id" varchar NOT NULL REFERENCES "vessel_section_maps"("id") ON DELETE cascade,
  "section_key" varchar(120) NOT NULL,
  "section_no" integer NOT NULL,
  "name" text NOT NULL,
  "color" varchar(24) NOT NULL,
  "thumbnail_fallback" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vessel_section_polygons" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id") ON DELETE cascade,
  "map_id" varchar NOT NULL REFERENCES "vessel_section_maps"("id") ON DELETE cascade,
  "section_id" varchar NOT NULL REFERENCES "vessel_sections"("id") ON DELETE cascade,
  "points_normalized" jsonb NOT NULL,
  "label_normalized" jsonb NOT NULL,
  "is_draft" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vessel_section_equipment_assignments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id") ON DELETE cascade,
  "map_id" varchar NOT NULL REFERENCES "vessel_section_maps"("id") ON DELETE cascade,
  "section_id" varchar NOT NULL REFERENCES "vessel_sections"("id") ON DELETE cascade,
  "equipment_id" varchar REFERENCES "equipment"("id") ON DELETE SET NULL,
  "equipment_name" text NOT NULL,
  "asset_code" text,
  "system" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vessel_thumbnail_overrides" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id") ON DELETE cascade,
  "owner_type" text NOT NULL,
  "owner_id" varchar NOT NULL,
  "map_id" varchar REFERENCES "vessel_section_maps"("id") ON DELETE cascade,
  "object_key" text NOT NULL,
  "original_file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "content_sha256" varchar(64) NOT NULL,
  "fallback_mode" text NOT NULL DEFAULT 'manual',
  "updated_by" varchar REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vessel_diagram_validation_results" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL REFERENCES "organizations"("id"),
  "vessel_id" varchar NOT NULL REFERENCES "vessels"("id") ON DELETE cascade,
  "diagram_id" varchar REFERENCES "vessel_diagrams"("id") ON DELETE cascade,
  "diagram_version_id" varchar REFERENCES "vessel_diagram_versions"("id") ON DELETE cascade,
  "map_id" varchar REFERENCES "vessel_section_maps"("id") ON DELETE cascade,
  "severity" text NOT NULL,
  "code" varchar(120) NOT NULL,
  "message" text NOT NULL,
  "path" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_vessel_diagrams_org_vessel" ON "vessel_diagrams" ("org_id", "vessel_id");
CREATE INDEX IF NOT EXISTS "idx_vessel_diagrams_type" ON "vessel_diagrams" ("org_id", "vessel_id", "diagram_type");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_vessel_diagram_title_per_vessel" ON "vessel_diagrams" ("org_id", "vessel_id", "title");

CREATE INDEX IF NOT EXISTS "idx_vessel_diagram_versions_diagram" ON "vessel_diagram_versions" ("org_id", "diagram_id");
CREATE INDEX IF NOT EXISTS "idx_vessel_diagram_versions_vessel" ON "vessel_diagram_versions" ("org_id", "vessel_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_vessel_diagram_version" ON "vessel_diagram_versions" ("diagram_id", "version_number");

CREATE INDEX IF NOT EXISTS "idx_vessel_section_maps_org_vessel" ON "vessel_section_maps" ("org_id", "vessel_id");
CREATE INDEX IF NOT EXISTS "idx_vessel_section_maps_diagram" ON "vessel_section_maps" ("org_id", "diagram_id");

CREATE INDEX IF NOT EXISTS "idx_vessel_sections_map" ON "vessel_sections" ("org_id", "map_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_vessel_section_key_per_map" ON "vessel_sections" ("map_id", "section_key");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_vessel_section_number_per_map" ON "vessel_sections" ("map_id", "section_no");

CREATE INDEX IF NOT EXISTS "idx_vessel_section_polygons_section" ON "vessel_section_polygons" ("org_id", "section_id");
CREATE INDEX IF NOT EXISTS "idx_vessel_section_equipment_section" ON "vessel_section_equipment_assignments" ("org_id", "section_id");
CREATE INDEX IF NOT EXISTS "idx_vessel_section_equipment_equipment" ON "vessel_section_equipment_assignments" ("org_id", "equipment_id");
CREATE INDEX IF NOT EXISTS "idx_vessel_thumbnail_owner" ON "vessel_thumbnail_overrides" ("org_id", "vessel_id", "owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "idx_vessel_validation_map" ON "vessel_diagram_validation_results" ("org_id", "map_id");
CREATE INDEX IF NOT EXISTS "idx_vessel_validation_version" ON "vessel_diagram_validation_results" ("org_id", "diagram_version_id");
