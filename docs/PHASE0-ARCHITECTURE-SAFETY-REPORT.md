# Phase 0: Architecture Safety Check Report

**Date:** December 1, 2025  
**Status:** COMPLETE - Safe to Proceed with Phased Approach

---

## 1. Folder Structure Mapping

### Frontend (`client/src/`)

| Domain           | Location                                                                 | Status           |
| ---------------- | ------------------------------------------------------------------------ | ---------------- |
| Fleet Overview   | `pages/FleetOverview.tsx`                                                | ✔ Consolidated  |
| Bridge View      | `pages/bridge-view.tsx`                                                  | ✔ Consolidated  |
| Equipment Health | `pages/health-monitor.tsx`                                               | ✔ Consolidated  |
| Dashboard        | `pages/dashboard.tsx`, `dashboard-improved.tsx`                          | ⚠ Duplicated    |
| Analytics        | `pages/analytics.tsx`, `analytics-hub.tsx`, `analytics-consolidated.tsx` | ⚠ Duplicated    |
| Telemetry        | `pages/manual-telemetry-upload.tsx`                                      | ✔ Stable        |
| Work Orders      | `pages/work-orders.tsx`                                                  | ✔ Stable        |
| Inventory        | `pages/inventory-management.tsx`                                         | ✔ Stable        |
| Crew Management  | `pages/crew-management.tsx`, `crew-scheduler.tsx`                        | ✔ Stable        |
| Hours of Rest    | `pages/hours-of-rest.tsx`                                                | ✔ Stable        |
| Deck Logbook     | `pages/deck-logbook.tsx`                                                 | ✔ Stable        |
| Engine Logbook   | `pages/engine-logbook.tsx`                                               | ✔ Stable        |
| Compliance       | `pages/logs-compliance-hub.tsx`                                          | ✔ Stable        |
| Settings         | `pages/settings.tsx`, `configuration-hub.tsx`                            | ⚠ Review needed |
| Sensors          | `pages/sensor-*.tsx`, `sensors-hub.tsx`                                  | ✔ Stable        |
| ML/AI            | `pages/ml-*.tsx`, `ai-*.tsx`, `AIStudioPage.tsx`                         | ⚠ Fragmented    |
| Knowledge Base   | `pages/knowledge-base.tsx`                                               | ✔ Stable        |

### Backend (`server/`)

| Domain         | Key Files                                  | Status                             |
| -------------- | ------------------------------------------ | ---------------------------------- |
| Routes         | `routes.ts` (23k+ lines)                   | ❌ God-file - needs modularization |
| Storage        | `storage.ts` (23k+ lines)                  | ❌ God-file - needs modularization |
| Database       | `db.ts`, `db-config.ts`, `sqlite-init.ts`  | ✔ Dual-mode supported             |
| MQTT Ingestion | `mqtt-ingestion-service.ts`                | ✔ Hardened                        |
| Telemetry      | `telemetry-batch-writer.ts`                | ✔ Optimized                       |
| ML Pipeline    | `ml-*.ts` (20+ files)                      | ✔ Comprehensive                   |
| Compliance     | `compliance/`, `stcw-compliance.ts`        | ✔ Stable                          |
| Crew           | `crew-scheduler.ts`, `hor-plan-utils.ts`   | ✔ Stable                          |
| Sync           | `sync-manager.ts`, `mqtt-reliable-sync.ts` | ✔ Stable                          |
| Auto-update    | `electron/auto-updater.ts`                 | ✔ Stable                          |

### Shared (`shared/`)

| File                    | Purpose                | Status               |
| ----------------------- | ---------------------- | -------------------- |
| `schema.ts`             | PostgreSQL schema      | ✔ Primary           |
| `schema-sqlite-sync.ts` | SQLite sync schema     | ✔ Parity maintained |
| `schema-runtime.ts`     | Runtime mode detection | ✔ Stable            |
| `telemetry-schema.ts`   | Telemetry types        | ✔ Stable            |

### Electron (`electron/`)

| File              | Purpose        | Status    |
| ----------------- | -------------- | --------- |
| `main.ts`         | Main process   | ✔ Stable |
| `preload.ts`      | Context bridge | ✔ Stable |
| `auto-updater.ts` | GitHub updates | ✔ Stable |

---

## 2. Duplicate Code & Redundancy Analysis

### UI Components - Already Consolidated

- ✔ `FleetKpiHeader` - Shared KPI cards (light/dark variants)
- ✔ `EquipmentHealthCard` - Unified equipment display (compact/light/dark variants)

### UI Components - Need Consolidation

| Component Pattern | Found In                      | Recommendation              |
| ----------------- | ----------------------------- | --------------------------- |
| Status Cards      | Analytics, Dashboard, Reports | Create `SharedStatusCard`   |
| Vessel Headers    | Multiple pages                | Create `SharedVesselHeader` |
| Alert Panels      | Alerts, Dashboard, Equipment  | Create `SharedAlertPanel`   |
| Data Tables       | Work Orders, Inventory, Crew  | Standardize table component |
| Filter Panels     | Multiple pages                | Unify filter patterns       |

### Overlapping Screens

| Issue                   | Pages                                                              | Recommendation            |
| ----------------------- | ------------------------------------------------------------------ | ------------------------- |
| Multiple dashboards     | `dashboard.tsx`, `dashboard-improved.tsx`                          | Merge to single dashboard |
| Analytics fragmentation | `analytics.tsx`, `analytics-hub.tsx`, `analytics-consolidated.tsx` | Consolidate to one        |
| ML/AI pages             | 6+ separate pages                                                  | Create unified ML hub     |

---

## 3. Architecture Support Validation

### Multi-Device Consistency

| Feature          | Status       | Notes                                    |
| ---------------- | ------------ | ---------------------------------------- |
| Shared React SPA | ✔ Supported | Same codebase for web/Electron/Capacitor |
| Electron bridge  | ✔ Supported | Dynamic port binding, CSP configured     |
| Capacitor iOS    | ✔ Supported | Native shell with SQLite                 |
| API consistency  | ✔ Supported | Single Express API surface               |

### Offline-First Operation

| Feature              | Status       | Notes                                      |
| -------------------- | ------------ | ------------------------------------------ |
| SQLite local storage | ✔ Supported | `LOCAL_MODE` + SQLite                      |
| Sync journal         | ✔ Supported | `sync-manager.ts`, `mqtt-reliable-sync.ts` |
| Conflict resolution  | ✔ Supported | `conflict-resolution-service.ts`           |
| Offline telemetry    | ✔ Supported | Simulated data available                   |

### Dual-Storage Transaction Safety

| Feature            | Status              | Notes                    |
| ------------------ | ------------------- | ------------------------ |
| Schema parity      | ⚠ Needs validation | Test harness recommended |
| Transaction safety | ⚠ Partial          | No formal proof          |
| Sync reliability   | ✔ Supported        | Retry logic exists       |

### Telemetry Scaling

| Feature           | Status       | Notes                       |
| ----------------- | ------------ | --------------------------- |
| Batch writing     | ✔ Optimized | `telemetry-batch-writer.ts` |
| Rate limiting     | ✔ Supported | Configurable                |
| Buffer management | ✔ Supported | 10k buffer, eviction        |
| Deduplication     | ✔ Supported | Built-in                    |

### Concurrency & Background Tasks

| Feature               | Status       | Notes                  |
| --------------------- | ------------ | ---------------------- |
| Job queue             | ✔ Supported | `job-queue-service.ts` |
| Background processors | ✔ Supported | 5 workers configured   |
| Schedulers            | ✔ Supported | Cron-based             |
| Debouncing            | ✔ Supported | Rate limiters          |

### MQTT Ingestion

| Feature           | Status       | Notes              |
| ----------------- | ------------ | ------------------ |
| Stable ingestion  | ✔ Hardened  | Structured logging |
| Retry logic       | ✔ Supported | Configurable       |
| Backpressure      | ✔ Supported | Buffer limits      |
| Schema validation | ✔ Supported | Zod validation     |

---

## 4. Conflict Detection

### High-Risk Areas (DO NOT Modify Without Tests)

| Area                       | Risk                   | Mitigation               |
| -------------------------- | ---------------------- | ------------------------ |
| `server/routes.ts`         | Breaking API contracts | Add contract tests first |
| `server/storage.ts`        | Breaking data access   | Add storage tests first  |
| `shared/schema.ts`         | Breaking migrations    | Never change ID types    |
| `electron/auto-updater.ts` | Breaking updates       | Test update flow         |

### Existing Features - DO NOT Duplicate

| Feature                 | Location                               | Status            |
| ----------------------- | -------------------------------------- | ----------------- |
| Fleet shared components | `components/fleet/`                    | ✔ Already exists |
| Health legend           | `components/HealthLegend.tsx`          | ✔ Already exists |
| Technician insights     | `components/TechnicianInsightCard.tsx` | ✔ Already exists |
| Status indicator        | `components/status-indicator.tsx`      | ✔ Already exists |

---

## 5. Compatibility Report Summary

### ✔ Safe to Modify

- UI component consolidation (non-breaking)
- New shared components
- Documentation
- Test suites
- Performance optimizations (caching, debouncing)

### ⚠ Needs Adjustment

- Dashboard consolidation (requires migration plan)
- Analytics page merge (requires user communication)
- Settings unification (requires feature flag)
- ML page consolidation (requires navigation update)

### ❌ Conflicts with Existing System

- Schema ID type changes (NEVER do this)
- Breaking API route changes
- Removing god-files without migration
- Changing Electron IPC contracts

---

## 6. Recommended Phase Execution Order

1. **Phase 1** (UI Unification) - LOW RISK - Proceed
2. **Phase 2** (Database Validation) - MEDIUM RISK - Add tests first
3. **Phase 3** (Telemetry Hardening) - LOW RISK - Proceed
4. **Phase 4** (Work Orders/Inventory) - LOW RISK - Proceed
5. **Phase 5** (Crew Management) - LOW RISK - Proceed
6. **Phase 6** (Logbook System) - LOW RISK - Proceed
7. **Phase 7** (Compliance System) - LOW RISK - Proceed
8. **Phase 8** (Update System) - MEDIUM RISK - Test thoroughly
9. **Phase 9** (Test Suite) - LOW RISK - Proceed
10. **Phase 10** (Performance) - LOW RISK - Proceed

---

## 7. Next Steps

1. Create task list for Phase 1 UI Unification
2. Build integration test harness for dual-database validation
3. Extend shared component audit to remaining pages
4. Document API contracts before any backend changes
