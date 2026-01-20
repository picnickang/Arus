# Safe org_id Migration Strategy

**Date:** November 7, 2025  
**Status:** Production-Ready Approach  

---

## Overview

This document outlines the **safe, production-ready strategy** for adding org_id columns to existing tables, avoiding the pitfalls of placeholder defaults and ensuring proper multi-tenant isolation.

---

## ❌ **AVOID: Unsafe Default Placeholder Pattern**

**DON'T do this:**
```sql
ALTER TABLE some_table 
ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
REFERENCES organizations(id);
```

**Why this is dangerous:**
- ❌ Masks legacy data instead of properly backfilling
- ❌ All existing rows collapse into single pseudo-tenant
- ❌ Undermines security goal of tenant isolation
- ❌ May violate referential integrity if 'default-org-id' doesn't exist
- ❌ Doesn't represent actual data ownership

---

## ✅ **RECOMMENDED: Safe Three-Step Migration**

### Step 1: Add Nullable Column
```sql
-- Add column without NOT NULL constraint first
ALTER TABLE table_name 
ADD COLUMN org_id varchar REFERENCES organizations(id);

-- Add index for performance
CREATE INDEX idx_tablename_org_id ON table_name(org_id);
```

**Why:** Allows existing rows to have NULL org_id while we backfill.

---

### Step 2: Backfill with Real Organization IDs

**Option A: If table has FK to organization-scoped table**
```sql
-- Example: If table has vessel_id and vessels have org_id
UPDATE table_name t
SET org_id = v.org_id
FROM vessels v
WHERE t.vessel_id = v.id
AND t.org_id IS NULL;
```

**Option B: If table has FK to users**
```sql
-- Derive org_id from user who created/owns the record
UPDATE table_name t
SET org_id = u.org_id
FROM users u
WHERE t.user_id = u.id
AND t.org_id IS NULL;
```

**Option C: If no FK relationship exists**
```sql
-- Set to first available organization (for development/testing only)
UPDATE table_name
SET org_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE org_id IS NULL;

-- OR manually review and assign based on business logic
-- SELECT * FROM table_name WHERE org_id IS NULL;
-- UPDATE table_name SET org_id = 'correct-org-id' WHERE id = 'specific-id';
```

**Option D: Archive/Delete orphaned data**
```sql
-- If data cannot be mapped to an organization, archive it
INSERT INTO archived_table_name
SELECT * FROM table_name WHERE org_id IS NULL;

-- Then delete
DELETE FROM table_name WHERE org_id IS NULL;
```

---

### Step 3: Make Column NOT NULL
```sql
-- After all rows have valid org_id, enforce NOT NULL
ALTER TABLE table_name 
ALTER COLUMN org_id SET NOT NULL;

-- Verify foreign key constraint exists
-- (should already exist from Step 1, but verify)
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'table_name' 
AND constraint_type = 'FOREIGN KEY';
```

**Why:** Ensures all future inserts must specify org_id.

---

## 📋 Complete Migration Template

```sql
-- ========================================
-- SAFE org_id Migration for: table_name
-- ========================================

-- STEP 1: Add nullable column with FK
ALTER TABLE table_name 
ADD COLUMN org_id varchar REFERENCES organizations(id);

CREATE INDEX idx_tablename_org_id ON table_name(org_id);

-- STEP 2: Backfill with real org IDs
-- (Choose appropriate backfill strategy based on table relationships)

-- Example backfill from related table:
UPDATE table_name t
SET org_id = related.org_id
FROM related_table related
WHERE t.related_id = related.id
AND t.org_id IS NULL;

-- STEP 3: Verify all rows have org_id
SELECT COUNT(*) as rows_without_org FROM table_name WHERE org_id IS NULL;
-- ^ Should return 0

-- STEP 4: Make column NOT NULL
ALTER TABLE table_name 
ALTER COLUMN org_id SET NOT NULL;

-- STEP 5: Add composite index for performance (optional but recommended)
CREATE INDEX idx_tablename_org_query 
ON table_name(org_id, frequently_queried_column);

-- STEP 6: Verify constraints
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON con.conrelid = rel.oid
WHERE rel.relname = 'table_name'
AND con.contype = 'f';
```

---

## Table-Specific Backfill Strategies

### crew_assignment
```sql
-- Backfill from crew table
UPDATE crew_assignment ca
SET org_id = c.org_id
FROM crew c
WHERE ca.crew_id = c.id
AND ca.org_id IS NULL;
```

### maintenance_costs
```sql
-- Backfill from work_orders or equipment
UPDATE maintenance_costs mc
SET org_id = wo.org_id
FROM work_orders wo
WHERE mc.work_order_id = wo.id
AND mc.org_id IS NULL;
```

### alert_comments
```sql
-- Backfill from alerts or users
UPDATE alert_comments ac
SET org_id = a.org_id
FROM alerts a
WHERE ac.alert_id = a.id
AND ac.org_id IS NULL;
```

### port_call
```sql
-- Backfill from vessels
UPDATE port_call pc
SET org_id = v.org_id
FROM vessels v
WHERE pc.vessel_id = v.id
AND pc.org_id IS NULL;
```

---

## Rollback Strategy

If migration fails or needs to be reversed:

```sql
-- Remove NOT NULL constraint
ALTER TABLE table_name 
ALTER COLUMN org_id DROP NOT NULL;

-- Drop indexes
DROP INDEX IF EXISTS idx_tablename_org_id;
DROP INDEX IF EXISTS idx_tablename_org_query;

-- Drop foreign key constraint
ALTER TABLE table_name
DROP CONSTRAINT IF EXISTS table_name_org_id_fkey;

-- Drop column entirely if needed
ALTER TABLE table_name
DROP COLUMN IF EXISTS org_id;
```

---

## Schema.ts Update Pattern

```typescript
export const tableName = pgTable("table_name", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id), // Added for multi-tenant isolation
  // ... rest of columns
}, (table) => ({
  orgIdIdx: index("idx_tablename_org_id").on(table.orgId),
  // Composite index for common query patterns
  orgQueryIdx: index("idx_tablename_org_query").on(table.orgId, table.frequentQueryColumn),
  // ... other indexes
}));
```

---

## Code Update Checklist

After migration, update application code:

### 1. Storage/Repository Layer
```typescript
// ✅ Add orgId parameter
async getItems(orgId: string): Promise<Item[]> {
  return await db.select()
    .from(items)
    .where(eq(items.orgId, orgId)); // Filter by org
}

// ✅ Include orgId in inserts
async createItem(orgId: string, item: InsertItem): Promise<Item> {
  const [newItem] = await db.insert(items)
    .values({ ...item, orgId })  // Include orgId
    .returning();
  return newItem;
}

// ✅ Validate orgId in updates
async updateItem(id: string, orgId: string, updates: Partial<InsertItem>): Promise<Item> {
  const [updated] = await db.update(items)
    .set(updates)
    .where(and(
      eq(items.id, id),
      eq(items.orgId, orgId)  // Prevent cross-org updates
    ))
    .returning();
  
  if (!updated) {
    throw new Error('Item not found or access denied');
  }
  return updated;
}
```

### 2. API Routes
```typescript
// ✅ Extract orgId from authenticated context
app.get('/api/items', requireOrgId, async (req, res) => {
  const orgId = req.orgId!; // From middleware
  const items = await storage.getItems(orgId);
  res.json(items);
});

app.post('/api/items', requireOrgId, async (req, res) => {
  const orgId = req.orgId!;
  const item = await storage.createItem(orgId, req.body);
  res.json(item);
});
```

---

## Testing Checklist

After migration:

1. **✅ Data Integrity**
   ```sql
   -- Verify no NULL org_ids
   SELECT COUNT(*) FROM table_name WHERE org_id IS NULL;
   
   -- Verify all org_ids exist in organizations
   SELECT COUNT(*) FROM table_name t
   LEFT JOIN organizations o ON t.org_id = o.id
   WHERE o.id IS NULL;
   ```

2. **✅ Query Performance**
   ```sql
   -- Verify index is being used
   EXPLAIN ANALYZE
   SELECT * FROM table_name WHERE org_id = 'some-org-id';
   ```

3. **✅ Foreign Key Enforcement**
   ```sql
   -- This should fail with FK violation
   INSERT INTO table_name (id, org_id, ...) 
   VALUES ('test-id', 'nonexistent-org', ...);
   ```

4. **✅ Multi-Tenant Isolation**
   - Create test data for two different organizations
   - Verify queries only return data for specified org_id
   - Verify updates cannot modify data from other orgs

---

## Example: Complete Migration for crew_cert Table

```sql
-- ========================================
-- crew_cert org_id Migration
-- ========================================

BEGIN;

-- Step 1: Add nullable column
ALTER TABLE crew_cert 
ADD COLUMN org_id varchar REFERENCES organizations(id);

CREATE INDEX idx_crew_cert_org_id ON crew_cert(org_id);

-- Step 2: Backfill from crew table
UPDATE crew_cert cc
SET org_id = c.org_id
FROM crew c
WHERE cc.crew_id = c.id
AND cc.org_id IS NULL;

-- Step 3: Verify backfill
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count 
  FROM crew_cert 
  WHERE org_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % rows with NULL org_id', null_count;
  END IF;
END $$;

-- Step 4: Make NOT NULL
ALTER TABLE crew_cert 
ALTER COLUMN org_id SET NOT NULL;

-- Step 5: Add composite index
CREATE INDEX idx_crew_cert_org_crew 
ON crew_cert(org_id, crew_id);

-- Step 6: Verify constraints
SELECT 
    con.conname,
    pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON con.conrelid = rel.oid
WHERE rel.relname = 'crew_cert'
AND con.contype IN ('f', 'c');

COMMIT;
```

---

## Migration Progress Tracking

```sql
-- Create migration tracking table
CREATE TABLE IF NOT EXISTS orgid_migrations (
  table_name varchar PRIMARY KEY,
  started_at timestamp DEFAULT NOW(),
  completed_at timestamp,
  rows_migrated integer,
  backfill_strategy text,
  notes text
);

-- Track migration
INSERT INTO orgid_migrations (table_name, backfill_strategy, notes)
VALUES ('crew_cert', 'From crew.org_id via crew_id FK', 'Completed successfully');

UPDATE orgid_migrations
SET completed_at = NOW(), rows_migrated = 1234
WHERE table_name = 'crew_cert';
```

---

## Summary

| Step | Action | Risk | Time |
|------|--------|------|------|
| 1 | Add nullable org_id + FK | LOW | 1 min |
| 2 | Backfill with real org IDs | MEDIUM | Varies |
| 3 | Verify no NULLs | LOW | 1 min |
| 4 | Make NOT NULL | MEDIUM | 1 min |
| 5 | Update code | LOW | 10-30 min |
| 6 | Test isolation | LOW | 10 min |

**Total Time per Table:** 30-60 minutes depending on backfill complexity

---

**Generated:** November 7, 2025  
**Status:** Production-Ready Strategy  
**Use Instead of:** ORGID_MIGRATION_PLAN.md (which has unsafe defaults)
