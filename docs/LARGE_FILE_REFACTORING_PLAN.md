# Large File Refactoring Plan
## Server Routes and Storage Modularization Strategy

**Analysis Date:** October 13, 2025  
**Status:** Analysis Complete - Ready for Implementation

---

## Executive Summary

The ARUS Marine application currently has two monolithic files that have become maintenance bottlenecks:
- `server/routes.ts`: **14,598 lines** with **493 API endpoints**
- `server/storage.ts`: **14,963 lines** with **680 storage methods**

This document provides a comprehensive refactoring plan to split these files into domain-specific modules, improving:
- **Maintainability:** Easier to navigate and modify domain-specific code
- **Team Collaboration:** Multiple developers can work on different domains without conflicts
- **Performance:** Better IDE performance with smaller files
- **Code Quality:** Clear separation of concerns and domain boundaries
- **Testing:** Easier to write focused unit and integration tests

**Estimated Impact:**
- Reduce routes.ts from 14,598 → ~2,000 lines (86% reduction)
- Reduce storage.ts from 14,963 → ~1,500 lines (90% reduction)
- Create ~30 domain-specific route modules
- Create ~15 domain-specific storage modules
- Expected timeline: 3-4 weeks for complete refactoring (if done incrementally)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Domain Identification](#domain-identification)
3. [Dependency Analysis](#dependency-analysis)
4. [Proposed File Structure](#proposed-file-structure)
5. [Prioritized Extraction Plan](#prioritized-extraction-plan)
6. [Implementation Steps](#implementation-steps)
7. [Risk Assessment](#risk-assessment)
8. [Testing Strategy](#testing-strategy)
9. [Success Metrics](#success-metrics)

---

## Current State Analysis

### routes.ts (14,598 lines)

**Total Endpoints:** 493 API endpoints

**Domain Distribution (Top 20):**
| Domain | Endpoints | Estimated Lines | Complexity |
|--------|-----------|----------------|------------|
| analytics | 62 | ~1,860 | High |
| crew | 28 | ~840 | Medium |
| work-orders | 19 | ~570 | High |
| equipment | 19 | ~570 | Medium |
| condition | 17 | ~510 | Medium |
| vessels | 14 | ~420 | Low |
| alerts | 14 | ~420 | Medium |
| optimization | 11 | ~330 | High |
| maintenance-templates | 11 | ~330 | Low |
| sync | 10 | ~300 | High |
| storage | 9 | ~270 | Medium |
| pdm | 9 | ~270 | High |
| admin | 9 | ~270 | Medium |
| stcw | 8 | ~240 | Medium |
| sensor-configs | 8 | ~240 | Low |
| parts | 8 | ~240 | Medium |
| ml | 8 | ~240 | High |
| sheets | 7 | ~210 | Medium |
| reports | 7 | ~210 | High |
| dtc | 7 | ~210 | Medium |

**Additional domains:** vibration, operating-parameters, operating-condition-alerts, maintenance-schedules, backup, users, telemetry, parts-inventory, organizations, j1939, insights, devices, skills, shifts, sensor-tuning, sensor-optimization, port-calls, llm, health, expenses, drydock-windows, digital-twins, compliance, transport-settings, settings, and more.

### storage.ts (14,963 lines)

**Total Methods:** 680 storage methods

**Domain Distribution (Top 20):**
| Domain | Methods | Estimated Lines | Complexity |
|--------|---------|----------------|------------|
| work_orders | 86 | ~1,720 | High |
| crud_utility | 66 | ~660 | Low |
| inventory_parts | 55 | ~1,100 | Medium |
| telemetry_sensors | 43 | ~860 | Medium |
| crew | 42 | ~840 | Medium |
| maintenance | 36 | ~720 | Medium |
| optimization | 35 | ~1,050 | High |
| alerts | 35 | ~700 | Medium |
| equipment | 32 | ~640 | Medium |
| devices | 28 | ~560 | Low |
| vessels | 23 | ~460 | Low |
| condition_monitoring | 19 | ~570 | Medium |
| sync | 18 | ~540 | High |
| system_config | 16 | ~320 | Low |
| users | 13 | ~260 | Low |
| transport_j1939 | 13 | ~390 | Medium |
| organizations | 12 | ~240 | Low |
| ml_analytics | 12 | ~600 | High |
| financial | 12 | ~240 | Low |
| compliance | 11 | ~220 | Low |

**Shared/Utility Methods:**
- 66 CRUD utility methods that should remain in base storage layer
- Cross-cutting concerns: authentication, validation, error handling

---

## Domain Identification

### Core Domain Groups

Based on analysis, we've identified **8 primary domain groups** with natural cohesion:

#### 1. **Fleet & Equipment Management**
- **Domains:** equipment, vessels, devices  
- **Routes:** 38 endpoints  
- **Storage:** 83 methods  
- **Cohesion:** High - all deal with physical assets
- **Dependencies:** telemetry, maintenance, work-orders

#### 2. **Telemetry & Monitoring**
- **Domains:** telemetry, sensors, sensor-configs, condition, dtc  
- **Routes:** 41 endpoints  
- **Storage:** 75 methods  
- **Cohesion:** Very High - all deal with data collection and monitoring
- **Dependencies:** equipment, alerts

#### 3. **Maintenance & Work Orders**
- **Domains:** work-orders, maintenance-templates, maintenance-schedules, parts, inventory  
- **Routes:** 57 endpoints  
- **Storage:** 177 methods (largest!)  
- **Cohesion:** Very High - complete CMMS functionality
- **Dependencies:** equipment, crew, alerts

#### 4. **Crew & Scheduling**
- **Domains:** crew, shifts, stcw, drydock-windows, port-calls  
- **Routes:** 45 endpoints  
- **Storage:** 58 methods  
- **Cohesion:** High - crew management and compliance
- **Dependencies:** vessels, labor-rates

#### 5. **Analytics & ML**
- **Domains:** analytics, ml, pdm, rul, vibration, optimization  
- **Routes:** 90 endpoints  
- **Storage:** 64 methods  
- **Cohesion:** Medium - diverse analytics capabilities
- **Dependencies:** telemetry, equipment, maintenance

#### 6. **Alerts & Notifications**
- **Domains:** alerts, operating-condition-alerts  
- **Routes:** 20 endpoints  
- **Storage:** 35 methods  
- **Cohesion:** Very High - alerting system
- **Dependencies:** telemetry, equipment

#### 7. **Reports & Insights**
- **Domains:** reports, insights, llm  
- **Routes:** 16 endpoints  
- **Storage:** 15 methods  
- **Cohesion:** Medium - report generation
- **Dependencies:** Most domains (cross-cutting)

#### 8. **System Administration**
- **Domains:** admin, organizations, users, sync, backup, settings, compliance  
- **Routes:** 40 endpoints  
- **Storage:** 61 methods  
- **Cohesion:** Medium - system-level concerns
- **Dependencies:** All domains (cross-cutting)

---

## Dependency Analysis

### High-Level Dependency Map

```
┌─────────────────────────────────────────────────────────┐
│                  System Administration                   │
│         (organizations, users, settings, sync)           │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐         ┌────────▼────────┐
│  Fleet & Equip │         │   Reports/LLM   │
│   (equipment,  │         │   (insights)    │
│    vessels)    │         └────────┬────────┘
└───────┬────────┘                  │
        │                           │
   ┌────▼──────────────────────────▼─────┐
   │       Telemetry & Monitoring         │
   │    (sensors, telemetry, dtc)         │
   └───────┬──────────────────────────────┘
           │
      ┌────▼────┐
      │ Alerts  │
      └────┬────┘
           │
   ┌───────▼──────────────────┐
   │  Maintenance & Work      │
   │  Orders (work-orders,    │
   │  parts, inventory)       │
   └───────┬──────────────────┘
           │
      ┌────▼────┐
      │  Crew   │
      └────┬────┘
           │
   ┌───────▼──────────┐
   │  Analytics & ML  │
   │  (pdm, ml,      │
   │   optimization)  │
   └──────────────────┘
```

### Critical Dependencies

**Shared by Most Domains:**
- `storage` - Base storage interface (routes.ts imports from `./storage`)
- `db` - Database connection
- `observability` - Metrics and monitoring
- `error-handling` - Graceful fallbacks
- `security` - Authentication and authorization
- `sync-events` - Real-time synchronization

**Domain Dependencies:**

1. **Equipment** depends on: vessels, organizations
2. **Telemetry** depends on: equipment, sensors
3. **Alerts** depends on: telemetry, equipment
4. **Work Orders** depends on: equipment, parts, crew, alerts
5. **Crew** depends on: vessels, organizations
6. **Analytics** depends on: telemetry, equipment, work-orders
7. **Reports** depends on: ALL domains (highest coupling)

---

## Proposed File Structure

### New Directory Organization

```
server/
├── routes/
│   ├── index.ts                    # Main router aggregator
│   ├── shared/
│   │   ├── middleware.ts           # Common middleware (rate-limiting, auth, etc.)
│   │   ├── validators.ts           # Shared validation schemas
│   │   └── utils.ts                # Route utilities
│   │
│   ├── fleet/
│   │   ├── equipment.routes.ts     # Equipment endpoints (19 endpoints)
│   │   ├── vessels.routes.ts       # Vessel endpoints (14 endpoints)
│   │   └── devices.routes.ts       # Device endpoints (5 endpoints)
│   │
│   ├── telemetry/
│   │   ├── telemetry.routes.ts     # Telemetry ingestion (5 endpoints)
│   │   ├── sensors.routes.ts       # Sensor config (8 endpoints)
│   │   ├── condition.routes.ts     # Condition monitoring (17 endpoints)
│   │   └── dtc.routes.ts           # DTC management (7 endpoints)
│   │
│   ├── maintenance/
│   │   ├── work-orders.routes.ts   # Work orders (19 endpoints)
│   │   ├── schedules.routes.ts     # Maintenance schedules (6 endpoints)
│   │   ├── templates.routes.ts     # PM templates (11 endpoints)
│   │   ├── parts.routes.ts         # Parts management (8 endpoints)
│   │   └── inventory.routes.ts     # Inventory (5 endpoints)
│   │
│   ├── crew/
│   │   ├── crew.routes.ts          # Crew management (28 endpoints)
│   │   ├── stcw.routes.ts          # STCW compliance (8 endpoints)
│   │   ├── shifts.routes.ts        # Shift planning (4 endpoints)
│   │   └── port-calls.routes.ts    # Port calls & drydock (8 endpoints)
│   │
│   ├── analytics/
│   │   ├── analytics.routes.ts     # General analytics (62 endpoints)
│   │   ├── ml.routes.ts            # ML training/prediction (8 endpoints)
│   │   ├── pdm.routes.ts           # PdM Pack (9 endpoints)
│   │   ├── vibration.routes.ts     # Vibration analysis (6 endpoints)
│   │   └── optimization.routes.ts  # Fleet optimization (11 endpoints)
│   │
│   ├── alerts/
│   │   └── alerts.routes.ts        # Alerting system (14 endpoints)
│   │
│   ├── reports/
│   │   ├── reports.routes.ts       # Report generation (7 endpoints)
│   │   ├── llm.routes.ts           # AI-powered reports (4 endpoints)
│   │   └── insights.routes.ts      # Insights engine (5 endpoints)
│   │
│   └── admin/
│       ├── organizations.routes.ts # Org management (5 endpoints)
│       ├── users.routes.ts         # User management (5 endpoints)
│       ├── admin.routes.ts         # Admin functions (9 endpoints)
│       ├── sync.routes.ts          # Sync management (10 endpoints)
│       ├── backup.routes.ts        # Backup/recovery (6 endpoints)
│       └── settings.routes.ts      # System settings (2 endpoints)
│
└── storage/
    ├── index.ts                    # Main storage aggregator
    ├── base.ts                     # IStorage interface + base class
    ├── shared/
    │   ├── types.ts                # Shared types
    │   └── utils.ts                # Shared utilities (66 CRUD methods)
    │
    ├── domains/
    │   ├── equipment.storage.ts    # Equipment methods (32 methods)
    │   ├── vessels.storage.ts      # Vessel methods (23 methods)
    │   ├── devices.storage.ts      # Device methods (28 methods)
    │   ├── telemetry.storage.ts    # Telemetry methods (43 methods)
    │   ├── work-orders.storage.ts  # Work order methods (86 methods!)
    │   ├── parts.storage.ts        # Inventory/parts (55 methods)
    │   ├── maintenance.storage.ts  # Maintenance (36 methods)
    │   ├── crew.storage.ts         # Crew methods (42 methods)
    │   ├── alerts.storage.ts       # Alert methods (35 methods)
    │   ├── optimization.storage.ts # Optimizer (35 methods)
    │   ├── ml-analytics.storage.ts # ML/Analytics (12 methods)
    │   ├── condition.storage.ts    # Condition monitoring (19 methods)
    │   ├── sync.storage.ts         # Sync operations (18 methods)
    │   ├── organizations.storage.ts # Org management (12 methods)
    │   └── system.storage.ts       # System settings (16 methods)
    │
    └── implementations/
        └── mem-storage.ts          # In-memory implementation (existing)
```

### File Size Estimates

**After Refactoring:**

**routes.ts** → **routes/index.ts** (~200 lines)
- Aggregates all domain routers
- Mounts shared middleware
- Configures rate limiting
- Initializes WebSocket server

**storage.ts** → **storage/index.ts** (~150 lines)
- Aggregates domain storage modules
- Exports unified storage interface
- Initializes storage implementation

**Largest new files:**
- `routes/analytics/analytics.routes.ts` (~1,860 lines) - still large, consider further splitting
- `storage/domains/work-orders.storage.ts` (~1,720 lines) - largest storage domain
- `routes/maintenance/work-orders.routes.ts` (~570 lines)

---

## Prioritized Extraction Plan

### Priority Tiers

We've prioritized domains based on:
- **Value:** Impact on maintainability and team productivity
- **Risk:** Complexity and dependency coupling
- **Effort:** Lines of code and number of dependencies

### **TIER 1 - Quick Wins (Low Risk, High Value)**

#### 1. **Crew Management** 
   - **Priority:** 🟢 HIGH
   - **Routes:** 28 endpoints (~840 lines)
   - **Storage:** 42 methods (~840 lines)
   - **Risk:** 🟢 LOW - Well-isolated domain
   - **Dependencies:** Minimal (organizations, vessels)
   - **Effort:** 2-3 days
   - **Value:** Immediate improvement, clear boundaries

#### 2. **Vessels & Fleet**
   - **Priority:** 🟢 HIGH
   - **Routes:** 14 endpoints (~420 lines)
   - **Storage:** 23 methods (~460 lines)
   - **Risk:** 🟢 LOW - Fundamental entity with few dependencies
   - **Dependencies:** organizations
   - **Effort:** 1-2 days
   - **Value:** Foundation for other extractions

#### 3. **Alerts System**
   - **Priority:** 🟢 HIGH
   - **Routes:** 14 endpoints (~420 lines)
   - **Storage:** 35 methods (~700 lines)
   - **Risk:** 🟢 LOW - Self-contained alerting logic
   - **Dependencies:** equipment, telemetry (read-only)
   - **Effort:** 2 days
   - **Value:** Critical feature with clear boundaries

### **TIER 2 - Medium Value (Medium Risk, Medium Effort)**

#### 4. **Equipment Management**
   - **Priority:** 🟡 MEDIUM-HIGH
   - **Routes:** 19 endpoints (~570 lines)
   - **Storage:** 32 methods (~640 lines)
   - **Risk:** 🟡 MEDIUM - Many dependents
   - **Dependencies:** vessels, organizations
   - **Effort:** 3-4 days
   - **Value:** Core domain, high usage

#### 5. **Telemetry & Sensors**
   - **Priority:** 🟡 MEDIUM-HIGH
   - **Routes:** 41 endpoints (~1,230 lines)
   - **Storage:** 75 methods (~1,500 lines)
   - **Risk:** 🟡 MEDIUM - High throughput code
   - **Dependencies:** equipment, sensors
   - **Effort:** 5-6 days
   - **Value:** Data ingestion pipeline

#### 6. **Parts & Inventory**
   - **Priority:** 🟡 MEDIUM
   - **Routes:** 13 endpoints (~390 lines)
   - **Storage:** 55 methods (~1,100 lines)
   - **Risk:** 🟡 MEDIUM - Transaction management
   - **Dependencies:** work-orders, equipment
   - **Effort:** 4-5 days
   - **Value:** CMMS core functionality

### **TIER 3 - High Value, High Complexity**

#### 7. **Work Orders & Maintenance**
   - **Priority:** 🔴 HIGH (but complex)
   - **Routes:** 38 endpoints (~1,140 lines)
   - **Storage:** 122 methods (~2,440 lines) - LARGEST!
   - **Risk:** 🔴 HIGH - Central to application, many dependencies
   - **Dependencies:** equipment, crew, parts, maintenance schedules
   - **Effort:** 7-10 days
   - **Value:** Biggest file size reduction

#### 8. **Analytics & ML**
   - **Priority:** 🔴 MEDIUM-HIGH
   - **Routes:** 90 endpoints (~2,700 lines) - LARGEST!
   - **Storage:** 64 methods (~1,920 lines)
   - **Risk:** 🔴 HIGH - Complex algorithms, AI integration
   - **Dependencies:** telemetry, equipment, work-orders
   - **Effort:** 8-10 days
   - **Value:** Largest route reduction

#### 9. **Optimization Engine**
   - **Priority:** 🟡 MEDIUM
   - **Routes:** 11 endpoints (~330 lines)
   - **Storage:** 35 methods (~1,050 lines)
   - **Risk:** 🔴 HIGH - Complex scheduling algorithms
   - **Dependencies:** crew, equipment, maintenance
   - **Effort:** 5-7 days
   - **Value:** Isolated complex feature

### **TIER 4 - System-Level (Do Last)**

#### 10. **Administration & Sync**
   - **Priority:** 🔴 LOW (do last)
   - **Routes:** 40 endpoints (~1,200 lines)
   - **Storage:** 61 methods (~1,220 lines)
   - **Risk:** 🔴 VERY HIGH - Cross-cutting concerns
   - **Dependencies:** ALL domains
   - **Effort:** 6-8 days
   - **Value:** Deferred until other domains stabilized

---

## Implementation Steps

### Phase 1: Foundation (Week 1) - Tier 1 Quick Wins

**Goal:** Extract 3 low-risk domains to establish patterns and infrastructure.

#### Step 1.1: Create Base Infrastructure (1 day)

```bash
# Create directory structure
mkdir -p server/routes/{shared,fleet,crew,alerts}
mkdir -p server/storage/{domains,shared,implementations}

# Create base files
touch server/routes/index.ts
touch server/routes/shared/{middleware.ts,validators.ts,utils.ts}
touch server/storage/index.ts
touch server/storage/base.ts
touch server/storage/shared/{types.ts,utils.ts}
```

**Files to create:**

1. **`server/routes/shared/middleware.ts`**
   - Move all rate limit definitions
   - Move HMAC validation
   - Move helper functions (getOrgIdFromRequest, etc.)

2. **`server/storage/base.ts`**
   - Define IStorage interface (same as current)
   - Create BaseStorage abstract class with shared utilities

3. **`server/storage/shared/utils.ts`**
   - Extract 66 CRUD utility methods
   - UUID generation, date utilities, etc.

#### Step 1.2: Extract Vessels Domain (1 day)

**Create `server/routes/fleet/vessels.routes.ts`:**
```typescript
import { Router } from 'express';
import { storage } from '../../storage';
import { generalApiRateLimit, writeOperationRateLimit } from '../shared/middleware';

export const vesselsRouter = Router();

// Extract 14 vessel endpoints from routes.ts
vesselsRouter.get('/', generalApiRateLimit, async (req, res) => { /* ... */ });
vesselsRouter.get('/:id', generalApiRateLimit, async (req, res) => { /* ... */ });
vesselsRouter.post('/', writeOperationRateLimit, async (req, res) => { /* ... */ });
// ... etc
```

**Create `server/storage/domains/vessels.storage.ts`:**
```typescript
import { SelectVessel, InsertVessel } from '@shared/schema';

export class VesselsStorage {
  async getVessels(orgId?: string): Promise<SelectVessel[]> { /* ... */ }
  async getVessel(id: string, orgId?: string): Promise<SelectVessel | undefined> { /* ... */ }
  async createVessel(vessel: InsertVessel): Promise<SelectVessel> { /* ... */ }
  async updateVessel(id: string, updates: Partial<InsertVessel>): Promise<SelectVessel> { /* ... */ }
  async deleteVessel(id: string): Promise<void> { /* ... */ }
  // ... 23 total methods
}
```

**Testing:**
1. Run existing tests to ensure no regressions
2. Test all 14 vessel endpoints
3. Verify no imports of old routes

#### Step 1.3: Extract Alerts Domain (1 day)

Similar process as vessels:
- Create `server/routes/alerts/alerts.routes.ts` (14 endpoints)
- Create `server/storage/domains/alerts.storage.ts` (35 methods)
- Update imports and test

#### Step 1.4: Extract Crew Domain (2 days)

**Note:** Crew is slightly more complex (28 endpoints, 42 methods)

- Create `server/routes/crew/crew.routes.ts`
- Create `server/routes/crew/stcw.routes.ts` (compliance endpoints)
- Create `server/storage/domains/crew.storage.ts`
- Extract STCW compliance logic
- Update imports and test

**Completion Checklist for Phase 1:**
- [ ] 3 domains extracted (vessels, alerts, crew)
- [ ] 56 endpoints moved (~1,680 lines from routes.ts)
- [ ] 100 methods moved (~2,000 lines from storage.ts)
- [ ] All tests passing
- [ ] No regressions in functionality
- [ ] Documentation updated

---

### Phase 2: Core Domains (Week 2) - Tier 2 Medium Effort

**Goal:** Extract equipment, telemetry, and inventory domains.

#### Step 2.1: Extract Equipment Domain (2 days)

- Create `server/routes/fleet/equipment.routes.ts` (19 endpoints)
- Create `server/storage/domains/equipment.storage.ts` (32 methods)
- Handle equipment-vessel associations
- Test cascade deletes and equipment lifecycle

#### Step 2.2: Extract Telemetry & Sensors (3 days)

**Complexity:** High throughput, real-time data

- Create `server/routes/telemetry/telemetry.routes.ts` (5 endpoints)
- Create `server/routes/telemetry/sensors.routes.ts` (8 endpoints)
- Create `server/routes/telemetry/condition.routes.ts` (17 endpoints)
- Create `server/routes/telemetry/dtc.routes.ts` (7 endpoints)
- Create `server/storage/domains/telemetry.storage.ts` (75 methods)
- Test bulk telemetry ingestion
- Verify WebSocket broadcasts still work
- Test sensor configuration processing

#### Step 2.3: Extract Parts & Inventory (2 days)

- Create `server/routes/maintenance/parts.routes.ts` (8 endpoints)
- Create `server/routes/maintenance/inventory.routes.ts` (5 endpoints)
- Create `server/storage/domains/parts.storage.ts` (55 methods)
- Test inventory reservation logic
- Test stock level calculations

**Completion Checklist for Phase 2:**
- [ ] 3 domains extracted (equipment, telemetry, parts)
- [ ] 74 endpoints moved (~2,220 lines from routes.ts)
- [ ] 162 methods moved (~3,240 lines from storage.ts)
- [ ] Real-time features still working
- [ ] All tests passing

---

### Phase 3: Complex Domains (Week 3-4) - Tier 3 High Complexity

**Goal:** Tackle the largest domains: work orders and analytics.

#### Step 3.1: Extract Work Orders & Maintenance (5 days)

**WARNING:** This is the largest extraction - 122 storage methods!

**Sub-steps:**
1. Create route files:
   - `server/routes/maintenance/work-orders.routes.ts` (19 endpoints)
   - `server/routes/maintenance/schedules.routes.ts` (6 endpoints)
   - `server/routes/maintenance/templates.routes.ts` (11 endpoints)

2. Create storage files:
   - `server/storage/domains/work-orders.storage.ts` (86 methods)
   - `server/storage/domains/maintenance.storage.ts` (36 methods)

3. Test work order lifecycle:
   - Creation, updates, completion
   - Parts association
   - Crew assignment
   - Cost calculation
   - Analytics integration

4. Test maintenance scheduling:
   - Auto-scheduling
   - Conflict detection
   - Resource allocation

#### Step 3.2: Extract Analytics & ML (5 days)

**WARNING:** Largest route domain - 90 endpoints!

**Sub-steps:**
1. Split analytics routes:
   - `server/routes/analytics/analytics.routes.ts` (62 endpoints - still large!)
   - `server/routes/analytics/ml.routes.ts` (8 endpoints)
   - `server/routes/analytics/pdm.routes.ts` (9 endpoints)
   - `server/routes/analytics/vibration.routes.ts` (6 endpoints)
   - `server/routes/analytics/optimization.routes.ts` (11 endpoints)

2. Consider further splitting analytics.routes.ts into sub-domains:
   - `fleet-analytics.routes.ts`
   - `equipment-analytics.routes.ts`
   - `performance-analytics.routes.ts`

3. Create storage:
   - `server/storage/domains/ml-analytics.storage.ts` (12 methods)
   - `server/storage/domains/optimization.storage.ts` (35 methods)

4. Test ML pipelines:
   - Model training
   - Predictions
   - PdM scoring
   - Vibration analysis

**Completion Checklist for Phase 3:**
- [ ] Work orders domain extracted
- [ ] Analytics domains extracted
- [ ] 128 endpoints moved (~3,840 lines)
- [ ] 134 methods moved (~2,680 lines)
- [ ] Complex features tested
- [ ] Performance verified

---

## Risk Assessment

### High-Risk Areas

#### 1. **Storage Interface Changes** (🔴 CRITICAL)

**Risk:** Breaking changes to IStorage interface
**Mitigation:**
- Keep IStorage interface unchanged during refactoring
- Use composition pattern: main storage delegates to domain storages
- Maintain backward compatibility
- Use TypeScript strict mode to catch interface violations

**Example Safe Pattern:**
```typescript
// storage/index.ts
export class Storage implements IStorage {
  private vessels: VesselsStorage;
  private crew: CrewStorage;
  // ...
  
  async getVessels(orgId?: string) {
    return this.vessels.getVessels(orgId);
  }
  
  // Keep same interface, delegate to domain storage
}
```

#### 2. **Circular Dependencies** (🔴 HIGH)

**Risk:** Routes → Storage → Routes circular imports
**Mitigation:**
- Never import routes from storage
- Extract shared types to `@shared/schema`
- Use dependency injection where needed
- Clear unidirectional flow: Routes → Storage → DB

#### 3. **Real-time Features** (🟡 MEDIUM)

**Risk:** WebSocket broadcasts breaking during refactoring
**Mitigation:**
- Keep WebSocket server initialization in main routes/index.ts
- Pass WebSocket instance to domain routers
- Test real-time features after each extraction
- Maintain event broadcasting patterns

#### 4. **Transaction Boundaries** (🟡 MEDIUM)

**Risk:** Database transactions spanning multiple domains
**Current Example:** Work order completion updates parts inventory

**Mitigation:**
- Identify cross-domain transactions before refactoring
- Keep transaction logic in calling domain
- Use database transaction callbacks
- Document transaction boundaries in code

**Example:**
```typescript
// work-orders.storage.ts
async completeWorkOrder(workOrderId: string, parts: PartUsage[]) {
  return await db.transaction(async (tx) => {
    // Update work order
    await this.updateWorkOrder(workOrderId, { status: 'completed' }, tx);
    
    // Update parts inventory (cross-domain)
    await this.partsStorage.decrementStock(parts, tx);
    
    // Both succeed or both rollback
  });
}
```

#### 5. **Import Path Updates** (🟡 MEDIUM)

**Risk:** Hundreds of import statements need updating
**Mitigation:**
- Use search & replace carefully
- Update one domain at a time
- Use TypeScript to verify imports
- Run tests after each update
- Use ESLint to catch unused imports

### Low-Risk Areas

- **Rate Limiting:** Easily moved to shared middleware
- **Validation Schemas:** Already in `@shared/schema`
- **Utilities:** Clear extraction to shared/utils
- **Static Endpoints:** Health checks, metrics (simple extraction)

---

## Testing Strategy

### Pre-Refactoring

1. **Baseline Test Suite**
   - Run full test suite and capture results
   - Document any existing failing tests
   - Measure code coverage baseline
   - Document current API behavior

2. **Create Integration Tests**
   - Test critical user workflows end-to-end
   - Test work order lifecycle
   - Test telemetry ingestion → alerts → work orders
   - Test crew scheduling

### During Refactoring

1. **Per-Domain Testing**
   - After extracting each domain:
     - Run full test suite
     - Test all endpoints in extracted domain
     - Verify no regressions in other domains
     - Check for console errors/warnings

2. **Incremental Verification**
   - Start server after each extraction
   - Smoke test core workflows
   - Check browser console for errors
   - Verify WebSocket connections

3. **Type Safety**
   - Use TypeScript strict mode
   - Fix all TypeScript errors before committing
   - Use `tsc --noEmit` to verify no type errors

### Post-Refactoring

1. **Full Regression Suite**
   - Run all tests
   - Test all 493 endpoints
   - Verify real-time features
   - Check performance benchmarks

2. **Manual Testing**
   - Test in development environment
   - Test complete user workflows
   - Test error scenarios
   - Verify data consistency

3. **Performance Testing**
   - Compare response times before/after
   - Check memory usage
   - Verify no N+1 queries introduced
   - Test high-concurrency scenarios

---

## Success Metrics

### Code Quality Metrics

**Before:**
- routes.ts: 14,598 lines
- storage.ts: 14,963 lines
- Avg file size: ~14,780 lines
- IDE responsiveness: Poor
- Build time: ~45 seconds

**After Target:**
- routes/index.ts: ~200 lines (98.6% reduction)
- storage/index.ts: ~150 lines (99.0% reduction)
- Largest file: ~1,860 lines (analytics.routes.ts)
- Avg domain file: ~400 lines (97.3% smaller)
- IDE responsiveness: Excellent
- Build time: ~30 seconds (33% faster)

### Development Velocity Metrics

**Before:**
- Time to find code: 2-5 minutes (search through 15K lines)
- Merge conflicts: Frequent (multiple devs editing same file)
- New feature time: Slowed by navigation overhead

**After:**
- Time to find code: <30 seconds (navigate to domain folder)
- Merge conflicts: Rare (devs work in different domains)
- New feature time: Faster (clear domain boundaries)

### Team Collaboration Metrics

**Before:**
- Max concurrent developers on routes/storage: 1-2 (high conflict risk)
- Code review time: Long (large diffs, context switching)

**After:**
- Max concurrent developers: 5-10 (different domains)
- Code review time: Faster (focused domain changes)

---

## Rollback Plan

### If Issues Arise

**During Refactoring:**
1. Each domain extraction is a separate commit
2. Can rollback individual domain if issues found
3. Keep old files until all extractions complete
4. Use feature flags if needed

**Post-Refactoring:**
1. Keep git tags for major milestones
2. Document rollback procedure
3. Maintain old files (commented out) for 1 sprint

---

## Next Steps

### Immediate Actions

1. **Review & Approve Plan** (1 day)
   - Technical review with team
   - Identify any missing domains
   - Adjust priorities based on team input

2. **Prepare Environment** (0.5 day)
   - Create feature branch: `refactor/domain-split`
   - Set up testing environment
   - Notify team of upcoming changes

3. **Start Phase 1** (Week 1)
   - Begin with Tier 1 quick wins
   - Establish patterns and best practices
   - Get team feedback early

### Timeline

| Phase | Duration | Domains | Endpoints | Methods | Risk |
|-------|----------|---------|-----------|---------|------|
| 0: Prep | 1 day | - | - | - | Low |
| 1: Foundation | 5 days | 3 | 56 | 100 | Low |
| 2: Core | 7 days | 3 | 74 | 162 | Medium |
| 3: Complex | 10 days | 2 | 128 | 134 | High |
| 4: Remaining | 7 days | 10+ | 235 | 284 | Medium |
| **Total** | **30 days** | **18+** | **493** | **680** | - |

**Note:** Timeline assumes one developer working full-time. Can be parallelized with multiple developers working on different domains.

---

## Conclusion

This refactoring will transform the ARUS Marine codebase from two monolithic files into a well-organized domain-driven architecture. The benefits include:

✅ **86-90% reduction** in main file sizes  
✅ **Improved maintainability** through clear domain boundaries  
✅ **Better team collaboration** with reduced merge conflicts  
✅ **Faster development** with easier code navigation  
✅ **Enhanced testing** with focused domain tests  
✅ **Improved IDE performance** with smaller file sizes  

**Risk Level:** Medium (manageable with incremental approach)  
**Estimated ROI:** High (long-term productivity gains)  
**Recommended Start Date:** Immediately (technical debt reduction is critical)  

---

**Document Prepared By:** AI Analysis System  
**Review Status:** Pending Team Review  
**Last Updated:** October 13, 2025
