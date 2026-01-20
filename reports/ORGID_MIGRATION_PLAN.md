# org_id Migration Plan

**Date:** November 7, 2025  
**Status:** In Progress  

---

## ✅ Completed: CRITICAL Priority

### admin_sessions (FIXED)
- **Status:** ✅ COMPLETED
- **Changes Applied:**
  - Added `org_id varchar NOT NULL DEFAULT 'default-org-id'` with FK to organizations
  - Created index `idx_admin_sessions_org_id` 
  - Updated routes.ts to pass orgId when creating sessions
  - Updated schema.ts with org_id column definition
- **Security Impact:** Prevents cross-organization session hijacking vulnerability
- **Verification:** Tested with SQL query - column exists and is properly constrained

---

## ⚠️ HIGH Priority - Business Data Tables (17 tables)

These tables contain organization-specific business data and must be isolated for proper multi-tenant security.

### Crew Management Tables (8 tables)

#### 1. crew_assignment
- **Purpose:** Links crew members to vessels and shifts
- **Migration:**
  ```sql
  ALTER TABLE crew_assignment 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_crew_assignment_org_id ON crew_assignment(org_id);
  CREATE INDEX idx_crew_assignment_org_crew ON crew_assignment(org_id, crew_id);
  ```
- **Code Updates:** Update queries in crew scheduler to filter by orgId
- **Priority:** HIGH - Prevents crew data leakage between organizations

#### 2. crew_cert
- **Purpose:** Crew certifications and qualifications
- **Migration:**
  ```sql
  ALTER TABLE crew_cert 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_crew_cert_org_id ON crew_cert(org_id);
  CREATE INDEX idx_crew_cert_org_crew ON crew_cert(org_id, crew_id);
  ```

#### 3. crew_leave
- **Purpose:** Crew leave records
- **Migration:**
  ```sql
  ALTER TABLE crew_leave 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_crew_leave_org_id ON crew_leave(org_id);
  CREATE INDEX idx_crew_leave_org_dates ON crew_leave(org_id, start_date, end_date);
  ```

#### 4. crew_rest_day
- **Purpose:** STCW rest period tracking
- **Migration:**
  ```sql
  ALTER TABLE crew_rest_day 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_crew_rest_day_org_id ON crew_rest_day(org_id);
  ```

#### 5. crew_rest_sheet
- **Purpose:** Detailed rest hour records
- **Migration:**
  ```sql
  ALTER TABLE crew_rest_sheet 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_crew_rest_sheet_org_id ON crew_rest_sheet(org_id);
  ```

#### 6. crew_skill
- **Purpose:** Crew skills and competencies
- **Migration:**
  ```sql
  ALTER TABLE crew_skill 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_crew_skill_org_id ON crew_skill(org_id);
  ```

#### 7. shift_template
- **Purpose:** Shift definitions for scheduling
- **Migration:**
  ```sql
  ALTER TABLE shift_template 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_shift_template_org_id ON shift_template(org_id);
  ```

### Maintenance & Operations Tables (6 tables)

#### 8. drydock_window
- **Purpose:** Vessel dry dock schedules
- **Migration:**
  ```sql
  ALTER TABLE drydock_window 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_drydock_window_org_id ON drydock_window(org_id);
  CREATE INDEX idx_drydock_window_org_vessel ON drydock_window(org_id, vessel_id);
  ```

#### 9. equipment_lifecycle
- **Purpose:** Equipment service life tracking
- **Migration:**
  ```sql
  ALTER TABLE equipment_lifecycle 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_equipment_lifecycle_org_id ON equipment_lifecycle(org_id);
  CREATE INDEX idx_equipment_lifecycle_org_equip ON equipment_lifecycle(org_id, equipment_id);
  ```

#### 10. maintenance_checklist_completions
- **Purpose:** Completed maintenance checklists
- **Migration:**
  ```sql
  ALTER TABLE maintenance_checklist_completions 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_maint_checklist_comp_org_id ON maintenance_checklist_completions(org_id);
  ```

#### 11. maintenance_checklist_items
- **Purpose:** Individual checklist items
- **Migration:**
  ```sql
  ALTER TABLE maintenance_checklist_items 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_maint_checklist_items_org_id ON maintenance_checklist_items(org_id);
  ```

#### 12. maintenance_costs
- **Purpose:** Maintenance cost tracking
- **Migration:**
  ```sql
  ALTER TABLE maintenance_costs 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_maintenance_costs_org_id ON maintenance_costs(org_id);
  CREATE INDEX idx_maintenance_costs_org_date ON maintenance_costs(org_id, date);
  ```

#### 13. performance_metrics
- **Purpose:** Equipment and vessel performance data
- **Migration:**
  ```sql
  ALTER TABLE performance_metrics 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_performance_metrics_org_id ON performance_metrics(org_id);
  CREATE INDEX idx_performance_metrics_org_time ON performance_metrics(org_id, timestamp);
  ```

### Business Operations Tables (4 tables)

#### 14. alert_comments
- **Purpose:** Comments on alerts and notifications
- **Migration:**
  ```sql
  ALTER TABLE alert_comments 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_alert_comments_org_id ON alert_comments(org_id);
  ```

#### 15. alert_suppressions
- **Purpose:** Suppressed/acknowledged alerts
- **Migration:**
  ```sql
  ALTER TABLE alert_suppressions 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_alert_suppressions_org_id ON alert_suppressions(org_id);
  ```

#### 16. port_call
- **Purpose:** Vessel port call records
- **Migration:**
  ```sql
  ALTER TABLE port_call 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_port_call_org_id ON port_call(org_id);
  CREATE INDEX idx_port_call_org_vessel ON port_call(org_id, vessel_id);
  ```

#### 17. purchase_order_items
- **Purpose:** Purchase order line items
- **Migration:**
  ```sql
  ALTER TABLE purchase_order_items 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_po_items_org_id ON purchase_order_items(org_id);
  ```

---

## ℹ️ MEDIUM Priority - Needs Architectural Review (5 tables)

### Device/Telemetry Tables

These require architectural decision on device ownership model.

#### device_registry
- **Question:** Are devices owned by specific organizations or shared infrastructure?
- **If org-specific:** Add org_id column
- **If shared:** Remain global, but add org_id to device_assignments or vessel_devices junction table

#### mqtt_devices
- **Question:** Same as device_registry
- **Recommendation:** Likely needs org_id as each organization has their own edge devices

#### edge_heartbeats  
- **Question:** Should heartbeats be org-scoped?
- **Recommendation:** If devices are org-scoped, heartbeats should be too

#### digital_twins
- **Question:** Are digital twins per-organization or shared models?
- **Recommendation:** Likely needs org_id as each org has their own fleet simulations

#### raw_telemetry
- **Question:** Should raw telemetry be org-isolated?
- **Recommendation:** HIGH PRIORITY - telemetry data should definitely be org-scoped for security
- **Migration:**
  ```sql
  ALTER TABLE raw_telemetry 
  ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
  REFERENCES organizations(id);
  
  CREATE INDEX idx_raw_telemetry_org_id ON raw_telemetry(org_id);
  CREATE INDEX idx_raw_telemetry_org_time ON raw_telemetry(org_id, timestamp);
  ```

---

## ✅ Exempt Tables (17 tables - No Action Needed)

These tables are correctly global:

### System Tables
- `db_schema_version` - Database migration tracking
- `organizations` - Master organization table
- `system_settings` - Global system configuration
- `storage_config` - Storage backend configuration
- `transport_settings` - Communication settings
- `idempotency_log` - Request deduplication
- `request_idempotency` - API idempotency tracking
- `sync_journal` - Cloud synchronization log
- `sync_outbox` - Pending sync operations
- `ops_db_staged` - Operational staging table
- `replay_incoming` - Event replay buffer
- `sheet_lock` - Concurrent access control
- `sheet_version` - Version tracking

### Reference Data Tables
- `dtc_definitions` - Diagnostic Trouble Code definitions (industry standard)
- `sensor_types` - Standard sensor type catalog
- `industry_benchmarks` - Industry-wide performance benchmarks
- `telemetry_retention_policies` - Data retention policies

---

## Migration Strategy

### Phase 1: Critical Security (✅ COMPLETED)
- [x] admin_sessions - Prevents session hijacking

### Phase 2: Core Business Data (Week 1-2)
Priority order based on data sensitivity:
1. crew_* tables (8 tables) - Employee data protection
2. maintenance_* tables (4 tables) - Operational data
3. alert_* tables (2 tables) - Notification isolation
4. port_call, drydock_window (2 tables) - Operational planning
5. purchase_order_items (1 table) - Financial data

### Phase 3: Architectural Review (Week 2-3)
1. Review device/telemetry architecture
2. Decide on device ownership model
3. Apply org_id to device tables based on decision

### Phase 4: Verification (Week 3-4)
1. Re-run schema audit to verify all changes
2. Test multi-tenant isolation
3. Verify query performance with new indexes
4. Update all API queries to filter by orgId

---

## Schema Update Template

For each table migration:

### 1. Update shared/schema.ts
```typescript
export const tableName = pgTable("table_name", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id), // Add this line
  // ... rest of columns
}, (table) => ({
  orgIdIdx: index("idx_tablename_org_id").on(table.orgId), // Add this index
  // ... other indexes
}));
```

### 2. Apply SQL Migration
```sql
ALTER TABLE table_name 
ADD COLUMN org_id varchar NOT NULL DEFAULT 'default-org-id' 
REFERENCES organizations(id);

CREATE INDEX idx_tablename_org_id ON table_name(org_id);
```

### 3. Update Storage/Repository Code
- Add orgId parameter to all query methods
- Filter all SELECT queries by orgId
- Include orgId in INSERT statements
- Validate orgId in UPDATE statements

### 4. Update API Routes
- Ensure all routes extract orgId from request context
- Pass orgId to storage methods
- Validate orgId matches authenticated user's organization

---

## Progress Tracking

- **Total tables needing review:** 41
- **Exempt (no action):** 17
- **Needs org_id:** 17
- **Needs architectural review:** 7
- **Completed:** 1 (admin_sessions)
- **Remaining:** 23

---

## Next Steps

1. ✅ Complete admin_sessions (DONE)
2. 📝 Apply migrations to crew_* tables (8 tables) - Week 1
3. 📝 Apply migrations to maintenance_* tables (4 tables) - Week 1
4. 📝 Apply migrations to alert_* and operations tables (5 tables) - Week 2
5. 🔍 Architectural review for device/telemetry tables - Week 2
6. ✅ Final verification and testing - Week 3

---

**Generated:** November 7, 2025  
**Last Updated:** November 7, 2025
