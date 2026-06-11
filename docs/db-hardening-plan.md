# Database Hardening Plan

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Assessment Complete, Implementation Pending

## Overview

This document outlines the database quality improvements identified during the ARUS Marine platform review. These changes are designed to be implemented incrementally without disrupting production operations.

---

## Phase 1: Missing Foreign Keys (DEFERRED)

The following tables lack proper foreign key constraints, which could lead to orphaned records:

### Tables Requiring Foreign Keys

| Table                       | Missing FK Column | Should Reference     |
| --------------------------- | ----------------- | -------------------- |
| `work_order_parts`          | `work_order_id`   | `work_orders.id`     |
| `work_order_parts`          | `part_id`         | `inventory_items.id` |
| `maintenance_costs`         | `work_order_id`   | `work_orders.id`     |
| `maintenance_costs`         | `equipment_id`    | `equipment.id`       |
| `ml_model_accuracy_history` | `model_id`        | `ml_models.id`       |

### Migration Strategy

1. **Audit existing data** for orphaned records
2. **Backfill or remove** orphaned rows before adding constraints
3. **Add FKs with** `ON DELETE SET NULL` or `ON DELETE CASCADE` based on business rules
4. **Test thoroughly** in staging before production

### Risk Assessment

- **Low risk**: Adding FKs is non-destructive if orphans are cleaned first
- **Requires**: Data cleanup script and testing

---

## Phase 2: Composite Indexes (IMPLEMENTED January 2026)

The following indexes were added to improve query performance:

### Indexes Created

```sql
-- Equipment by vessel and creation date
CREATE INDEX idx_equipment_vessel_created ON equipment(vessel_id, created_at DESC);

-- Maintenance records by equipment and date
CREATE INDEX idx_maintenance_records_equipment_date ON maintenance_records(equipment_id, actual_start_time DESC);
CREATE INDEX idx_maintenance_records_org_id ON maintenance_records(org_id);

-- Raw telemetry by source equipment and timestamp
CREATE INDEX idx_raw_telemetry_equipment_ts ON raw_telemetry(src, ts DESC);

-- ML models by org and status
CREATE INDEX idx_ml_models_org_status ON ml_models(org_id, status);

-- PdM alerts by asset and time
CREATE INDEX idx_pdm_alerts_asset_time ON pdm_alerts(asset_id, at DESC);
CREATE INDEX idx_pdm_alerts_vessel ON pdm_alerts(vessel_name, at DESC);
```

### Pre-existing Indexes (Already in Place)

```sql
-- Work orders (already indexed)
idx_work_orders_equipment_status ON work_orders(equipment_id, status)
idx_work_orders_org_created ON work_orders(org_id, created_at)
idx_work_orders_org_status ON work_orders(org_id, status)

-- Work order parts (already indexed)
idx_wop_work_order ON work_order_parts(work_order_id)
idx_wop_part ON work_order_parts(part_id)
```

### Tables Without Indexes (Not Yet Created)

- `crew_assignments` table does not exist in current schema (scheduling uses different structure)

### Implementation Notes

- All indexes are **additive** (non-breaking)
- Created in development database
- Monitor query performance after creation

---

## Phase 3: org_id Column Cleanup (DEFERRED)

### Current State

The single-tenant migration left nullable `org_id` columns throughout the schema. While functional, this creates ambiguity.

### Recommended Actions

1. **Document** which tables still have `org_id`
2. **Default value**: Set `org_id = 'default-org-id'` on all rows
3. **Add NOT NULL** constraint after backfill
4. **Optional**: Remove `org_id` columns entirely if multi-tenant support is permanently deprecated

### Risk Assessment

- **Medium risk**: Requires careful data migration
- **Deferred**: Wait until single-tenant architecture is confirmed permanent

---

## Phase 4: Query Optimization (ONGOING)

### Identified Issues

1. **orderBy(desc()) Fix Applied**: Using raw SQL `ORDER BY column DESC` instead of drizzle's `desc()` helper due to dual-mode schema type issues

2. **Analytics Queries**: Some analytics endpoints perform full table scans - consider materialized views for:
   - Equipment health summaries
   - Cost trend calculations
   - Compliance dashboards

3. **N+1 Query Patterns**: Some routes fetch related data in loops - consolidate into JOIN queries

---

## Implementation Timeline

| Phase                  | Priority | Status      | Target        |
| ---------------------- | -------- | ----------- | ------------- |
| Composite Indexes      | High     | **DONE**    | January 2026  |
| Route Validation Audit | High     | **DONE**    | January 2026  |
| Foreign Keys           | Medium   | Planning    | Future Sprint |
| org_id Cleanup         | Low      | Deferred    | TBD           |
| Query Optimization     | Ongoing  | In Progress | Continuous    |

---

## Monitoring

After implementing changes, monitor:

1. **Query response times** via Prometheus metrics
2. **Index usage** with `pg_stat_user_indexes`
3. **Table bloat** if FK cascades cause frequent updates

---

## Phase 5: Route Input Validation Audit (Completed January 2026)

### Summary

The codebase was audited for consistent request body validation patterns.

### Validation Patterns Found

**Pattern 1: Formal Zod Validation (Preferred)**

```typescript
const body = schema.parse(req.body); // Throws on invalid data
const result = schema.safeParse(req.body); // Returns success/error object
```

**Pattern 2: Inline Validation (Legacy)**

```typescript
if (!partId || !quantity) {
  return res.status(400).json({ message: "partId and quantity are required" });
}
```

### Coverage Analysis

| Domain   | Total req.body Uses | With .parse() | Validation % |
| -------- | ------------------- | ------------- | ------------ |
| routes/  | 26                  | 11            | 42%          |
| domains/ | 200+                | 70+           | ~35%         |

### Existing Infrastructure

The codebase has excellent validation infrastructure in `server/shared/validators.ts`:

- 40+ reusable Zod schemas (UUID, pagination, date ranges, etc.)
- Helper functions: `validateRequest()`, `safeValidateRequest()`
- Domain-specific schemas for crew, work orders, telemetry, etc.

### Recommendations

1. **New routes** should always use schemas from `server/shared/validators.ts`
2. **Refactor incrementally** - Convert high-risk endpoints first (financial, compliance)
3. **Use middleware pattern** - `requireOrgIdAndValidateBody(schema)` already exists

### Low-Risk Findings

Most unvalidated routes have:

- Runtime checks for required fields
- Type coercion at the storage layer
- Rate limiting and authentication in place

---

## Notes

- All changes should be tested in development first
- Create database backups before any migration
- Document all schema changes in replit.md
