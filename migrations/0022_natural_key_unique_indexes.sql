-- P2 #18 — Unique natural-key indexes (tenant-scoped, partial where nullable)
--
-- These are additive correctness guards: they prevent two rows in the
-- same tenant from sharing a natural key that ERP/import code already
-- treats as unique (e.g. AMOS/SBN sync paths). All indexes use
-- IF NOT EXISTS so re-runs are safe.
--
-- Each index is scoped by org_id so the same value can legitimately
-- exist across different tenants. Partial WHERE clauses skip rows
-- where the natural key is NULL (allowed for legacy/blank imports).
--
-- Reversible: drop the corresponding INDEX to roll back.

-- parts_inventory: (org_id, part_number)
CREATE UNIQUE INDEX IF NOT EXISTS uq_parts_inventory_org_part_number
  ON parts_inventory (org_id, part_number)
  WHERE part_number IS NOT NULL;

-- inventory_parts: (org_id, part_number)
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_parts_org_part_number
  ON inventory_parts (org_id, part_number)
  WHERE part_number IS NOT NULL;

-- maintenance_templates: (org_id, name, equipment_type)
-- All three columns are NOT NULL on this table, so no partial clause.
CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_templates_org_name_eqtype
  ON maintenance_templates (org_id, name, equipment_type);
