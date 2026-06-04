-- Manageable crew roles (positions / ranks)
--
-- Adds the crew_roles table so managers can add, rename, reorder, and remove
-- the labelled crew positions (Captain, Chief Officer, Chief Engineer, Bosun, …)
-- from the app instead of relying on the hardcoded frontend constants. This is
-- the crew POSITION concept that backs the `crew.rank` text column — it is
-- deliberately SEPARATE from the RBAC permission roles in the `roles` table
-- (crew.roleId). Each role carries a display name, a category/group used for
-- roster grouping, and an integer sort order (top = highest position). Org
-- scoped; the unique (org_id, name) index lets the app seed defaults
-- idempotently. Idempotent.

CREATE TABLE IF NOT EXISTS crew_roles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id varchar NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_roles_org ON crew_roles (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crew_roles_org_name ON crew_roles (org_id, name);
