/**
 * Migration: Equipment Hierarchy
 *
 * Evaluation finding: "No parentEquipmentId or tree structure in the equipment table.
 * Real vessels need multi-level hierarchies: Vessel → Main Engine → Turbocharger → Bearing Assembly."
 *
 * This migration:
 * 1. Adds parentEquipmentId self-referencing FK to equipment table
 * 2. Adds hierarchyLevel (computed) and hierarchyPath (materialized) columns
 * 3. Creates a recursive CTE function for tree traversal
 * 4. Adds index for parent lookups
 *
 * Run: psql -f 004-equipment-hierarchy.sql
 */

-- Step 1: Add hierarchy columns
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS parent_equipment_id VARCHAR REFERENCES equipment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hierarchy_path TEXT DEFAULT '';

-- Step 2: Index for parent lookups and tree traversal
CREATE INDEX IF NOT EXISTS idx_equipment_parent ON equipment (parent_equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_hierarchy_path ON equipment (hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_equipment_org_parent ON equipment (org_id, parent_equipment_id);

-- Step 3: Function to compute hierarchy path (materialized for fast reads)
-- Call this after any parent reassignment via a trigger or application code.
CREATE OR REPLACE FUNCTION update_equipment_hierarchy_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
  parent_level INTEGER;
BEGIN
  IF NEW.parent_equipment_id IS NULL THEN
    NEW.hierarchy_level := 0;
    NEW.hierarchy_path := NEW.id;
  ELSE
    SELECT hierarchy_path, hierarchy_level
    INTO parent_path, parent_level
    FROM equipment
    WHERE id = NEW.parent_equipment_id;

    NEW.hierarchy_level := COALESCE(parent_level, 0) + 1;
    NEW.hierarchy_path := COALESCE(parent_path, NEW.parent_equipment_id) || '/' || NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Trigger to auto-update path on insert/update
DROP TRIGGER IF EXISTS trg_equipment_hierarchy ON equipment;
CREATE TRIGGER trg_equipment_hierarchy
  BEFORE INSERT OR UPDATE OF parent_equipment_id
  ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_equipment_hierarchy_path();

-- Step 5: Recursive CTE view for tree queries
-- Usage: SELECT * FROM equipment_tree WHERE org_id = 'xxx' AND root_id = 'main-engine-id';
CREATE OR REPLACE VIEW equipment_subtree AS
WITH RECURSIVE tree AS (
  -- Base case: root nodes (no parent)
  SELECT
    e.id,
    e.org_id,
    e.name,
    e.parent_equipment_id,
    e.hierarchy_level,
    e.hierarchy_path,
    e.id AS root_id,
    e.name AS root_name,
    ARRAY[e.name] AS breadcrumb
  FROM equipment e
  WHERE e.parent_equipment_id IS NULL

  UNION ALL

  -- Recursive case: children
  SELECT
    child.id,
    child.org_id,
    child.name,
    child.parent_equipment_id,
    child.hierarchy_level,
    child.hierarchy_path,
    tree.root_id,
    tree.root_name,
    tree.breadcrumb || child.name
  FROM equipment child
  JOIN tree ON child.parent_equipment_id = tree.id
)
SELECT * FROM tree;

-- Step 6: Update existing equipment to set hierarchy_path for rows with no parent
UPDATE equipment
SET hierarchy_path = id, hierarchy_level = 0
WHERE parent_equipment_id IS NULL AND (hierarchy_path IS NULL OR hierarchy_path = '');

COMMENT ON COLUMN equipment.parent_equipment_id IS 'Self-referencing FK for equipment hierarchy. NULL = top-level (system). Supports 5+ levels: Vessel→System→Component→Subcomponent→Part.';
COMMENT ON COLUMN equipment.hierarchy_level IS 'Depth in the hierarchy tree. 0=root. Auto-computed by trigger.';
COMMENT ON COLUMN equipment.hierarchy_path IS 'Materialized path: root_id/.../this_id. Enables fast subtree queries with LIKE.';
