# Tables Without org_id - Analysis Report

**Generated:** 2025-11-07T07:22:06.994Z

## Summary

- **Total tables without org_id:** 41
- **Exempt (System/Global):** 17
- **Needs org_id:** 17
- **Needs Review:** 7

### Priority Breakdown

- 🚨 **CRITICAL:** 2
- ⚠️ **HIGH:** 17
- ℹ️ **MEDIUM:** 5
- ✅ **LOW:** 17

---

## 🚨 CRITICAL Priority

These tables pose security risks and must be addressed immediately.

### admin_sessions
- **Category:** REVIEW_NEEDED
- **Reason:** Audit/session data - depends on security model
- **Recommendation:** CRITICAL: Add org_id to prevent cross-org session hijacking. Admin sessions must be org-scoped.

### compliance_audit_log
- **Category:** REVIEW_NEEDED
- **Reason:** Audit/session data - depends on security model
- **Recommendation:** Review if audit logs should be org-scoped or global for compliance.

---

## ⚠️ HIGH Priority

Business data tables that should be multi-tenant isolated.

### alert_comments
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### alert_suppressions
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### crew_assignment
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### crew_cert
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### crew_leave
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### crew_rest_day
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### crew_rest_sheet
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### crew_skill
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### drydock_window
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### equipment_lifecycle
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### maintenance_checklist_completions
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### maintenance_checklist_items
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### maintenance_costs
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### performance_metrics
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### port_call
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### purchase_order_items
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

### shift_template
- **Category:** NEEDS_ORGID
- **Reason:** Business data that should be isolated per organization
- **Recommendation:** Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.

---

## ℹ️ MEDIUM Priority - Needs Review

Tables requiring architectural decision on tenant isolation.

### device_registry
- **Category:** REVIEW_NEEDED
- **Reason:** Device/telemetry data - depends on device ownership model
- **Recommendation:** Review if devices are org-specific or shared. If org-specific, add org_id. If shared infrastructure, may remain global.

### digital_twins
- **Category:** REVIEW_NEEDED
- **Reason:** Device/telemetry data - depends on device ownership model
- **Recommendation:** Review if devices are org-specific or shared. If org-specific, add org_id. If shared infrastructure, may remain global.

### edge_heartbeats
- **Category:** REVIEW_NEEDED
- **Reason:** Device/telemetry data - depends on device ownership model
- **Recommendation:** Review if devices are org-specific or shared. If org-specific, add org_id. If shared infrastructure, may remain global.

### mqtt_devices
- **Category:** REVIEW_NEEDED
- **Reason:** Device/telemetry data - depends on device ownership model
- **Recommendation:** Review if devices are org-specific or shared. If org-specific, add org_id. If shared infrastructure, may remain global.

### raw_telemetry
- **Category:** REVIEW_NEEDED
- **Reason:** Device/telemetry data - depends on device ownership model
- **Recommendation:** Review if devices are org-specific or shared. If org-specific, add org_id. If shared infrastructure, may remain global.

---

## ✅ Exempt Tables (No Action Needed)

These tables are correctly global and do not require org_id.

### db_schema_version
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### dtc_definitions
- **Reason:** Shared reference data - same across all organizations
- **Recommendation:** Consider if this data should be org-specific in future, but currently global is acceptable.

### idempotency_log
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### industry_benchmarks
- **Reason:** Shared reference data - same across all organizations
- **Recommendation:** Consider if this data should be org-specific in future, but currently global is acceptable.

### ops_db_staged
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### organizations
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### replay_incoming
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### request_idempotency
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### sensor_types
- **Reason:** Shared reference data - same across all organizations
- **Recommendation:** Consider if this data should be org-specific in future, but currently global is acceptable.

### sheet_lock
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### sheet_version
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### storage_config
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### sync_journal
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### sync_outbox
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### system_settings
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

### telemetry_retention_policies
- **Reason:** Shared reference data - same across all organizations
- **Recommendation:** Consider if this data should be org-specific in future, but currently global is acceptable.

### transport_settings
- **Reason:** System/infrastructure table - global to all organizations
- **Recommendation:** No action needed. Table is correctly global.

---

## Migration Guidance

### For tables that need org_id:

1. **Schema Update**
   ```typescript
   // In shared/schema.ts
   orgId: varchar("org_id").notNull().references(() => organizations.id),
   ```

2. **Index Addition**
   ```typescript
   // Add composite indexes for performance
   (table) => ({
     orgIdIndex: index("idx_tablename_org_id").on(table.orgId),
     orgQueryIndex: index("idx_tablename_org_query").on(table.orgId, table.frequentlyQueriedColumn)
   })
   ```

3. **Data Migration**
   - Run `npm run db:push` to sync schema
   - If data loss warning appears, review carefully
   - Use `npm run db:push --force` if migration is safe
   - Existing data will need org_id populated (default to 'default-org-id' or migrate appropriately)

4. **Code Updates**
   - Update all queries to filter by orgId
   - Update insert statements to include orgId
   - Add org-scoped indexes to routes if not present

---

## Next Steps

1. **Immediate (Week 1):**
   - Address CRITICAL priority items (2 tables)
   - Plan HIGH priority migrations (17 tables)

2. **Short-term (This Sprint):**
   - Review MEDIUM priority tables and make architectural decisions
   - Begin migrating HIGH priority tables

3. **Long-term (Next Quarter):**
   - Complete all multi-tenant migrations
   - Document exempt tables in schema comments
   - Re-run audit to verify improvements

