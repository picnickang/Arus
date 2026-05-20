-- Task #129 — Per-admin remembered layout for the dependency graph editor.
-- One row per (org_id, user_id, vessel_id). `positions` is a JSONB map of
-- equipment_id -> { x, y }. Per-user so two admins arranging the same vessel
-- don't fight each other's layouts.

CREATE TABLE IF NOT EXISTS equipment_dependency_layouts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id varchar NOT NULL REFERENCES organizations(id),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vessel_id varchar NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  positions jsonb NOT NULL,
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_equipment_dep_layout_user_vessel
  ON equipment_dependency_layouts (org_id, user_id, vessel_id);

CREATE INDEX IF NOT EXISTS idx_equipment_dep_layout_org
  ON equipment_dependency_layouts (org_id);
