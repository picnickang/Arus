# Backend Architecture: Domain Modules

## Overview

The ARUS backend follows a domain-driven architecture pattern with routes organized into domain-specific modules under `server/domains/`. This document describes the modularization status and patterns.

## Current Architecture

### Domain Module Structure

Each domain module follows a consistent layered pattern:

```
server/domains/<domain>/
├── index.ts        # Exports route registration function
├── routes.ts       # HTTP route handlers
├── service.ts      # Business logic layer
└── repository.ts   # Data access layer
```

### Registered Domain Modules

| Domain      | Unique Paths | Status | Notes                                          |
| ----------- | ------------ | ------ | ---------------------------------------------- |
| crew        | 22           | Active | Crew, certifications, documents, skills, leave |
| equipment   | 12           | Active | Equipment registry & maintenance               |
| alerts      | 11           | Active | Alert configuration and routing                |
| inventory   | 10           | Active | Parts and stock management                     |
| vessels     | 9            | Active | Vessel management                              |
| work-orders | 7            | Active | Core work order CRUD                           |
| maintenance | 6            | Active | Maintenance schedules/templates                |
| devices     | 2            | Active | Edge device management                         |

**Total extracted:** 79 unique API paths

**Note:** Counts represent unique API paths. Some paths have multiple HTTP methods (GET, POST, PUT, DELETE), so total route handlers is higher.

### Routes Still in Monolith (routes.ts)

| Category      | Routes | Priority | Notes                            |
| ------------- | ------ | -------- | -------------------------------- |
| analytics     | 70     | Medium   | Partially in routes/analytics.ts |
| logbook       | 69     | High     | Deck & engine logbooks           |
| crew          | 27     | Low      | Duplicate - needs cleanup        |
| compliance    | 21     | Medium   | Audit trail, regulatory          |
| condition     | 17     | Medium   | Condition monitoring             |
| work-orders   | 15     | Low      | Duplicate - needs cleanup        |
| ml            | 15     | Low      | ML predictions                   |
| alerts        | 14     | Low      | Duplicate - needs cleanup        |
| notifications | 12     | Medium   | Notification system              |
| admin         | 12     | Low      | Admin endpoints                  |
| schedule      | 11     | Medium   | Scheduling                       |
| pdm           | 11     | Low      | Predictive maintenance           |
| optimization  | 11     | Low      | Optimization algorithms          |
| sync          | 10     | Medium   | Data synchronization             |

**Total in monolith:** ~607 routes

## Layer Responsibilities

### Routes Layer (routes.ts)

- HTTP request/response handling
- Input validation using Zod schemas
- Rate limiting application
- Error response formatting
- Delegates to service layer

### Service Layer (service.ts)

- Business logic orchestration
- Cross-cutting concerns (caching, events)
- Transaction coordination
- Validation of business rules

### Repository Layer (repository.ts)

- Data access operations
- Database query construction
- Organization (tenant) scoping
- No business logic

## Conventions

### Route Registration

```typescript
export function registerXxxRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  // Routes here...
}
```

### Tenant Isolation

All routes must use `requireOrgId` middleware:

```typescript
app.get("/api/xxx", requireOrgId, async (req, res) => {
  const orgId = (req as AuthenticatedRequest).orgId;
  // ...
});
```

### Error Handling

Use `safeDbOperation` wrapper for database operations:

```typescript
const result = await safeDbOperation(async () => {
  return service.someOperation(orgId, data);
}, res);
```

## Migration Strategy

1. **Identify duplicate routes** - Routes defined in both domains/ and routes.ts
2. **Remove duplicates from routes.ts** - After verifying domain routes work
3. **Extract new domains** - Create modules for logbook, compliance, etc.
4. **Test after each change** - Run regression tests

## Route Duplication Analysis

### Complete Inventory (as of Dec 2024)

**Domain Module: Work Orders (server/domains/work-orders/routes.ts)**
Complete routes in domain module:

- GET /api/work-orders (lines 47-130)
- GET /api/work-orders/:id (lines 133-147)
- POST /api/work-orders (lines 150-189)
- POST /api/work-orders/with-suggestions (lines 192-218)
- PUT /api/work-orders/:id (lines 221-250)
- DELETE /api/work-orders/:id (lines 253-268)
- POST /api/work-orders/:id/complete (lines 271-346)
- GET /api/work-order-completions (lines 349-368)
- GET /api/work-orders/:id/tasks (lines 372-381)
- POST /api/work-orders/:id/tasks (lines 384-418)
- PATCH /api/work-orders/:id/tasks/:taskId (lines 421-457)
- DELETE /api/work-orders/:id/tasks/:taskId (lines 460-476)

**Duplicates in routes.ts (DEAD CODE - safe to remove):**
| Route | routes.ts Line | Domain Line | Status |
|-------|----------------|-------------|--------|
| GET /api/work-orders | 6554 | 47 | DUPLICATE |
| POST /api/work-orders | 6619 | 150 | DUPLICATE |
| GET /api/work-orders/:id | 6663 | 133 | DUPLICATE |
| POST /api/work-orders/with-suggestions | 6677 | 192 | DUPLICATE |
| PUT /api/work-orders/:id | 6773 | 221 | DUPLICATE |
| DELETE /api/work-orders/:id | 6805 | 253 | DUPLICATE |
| POST /api/work-orders/:id/complete | 6914 | 271 | DUPLICATE |

**Routes only in routes.ts (need future migration):**

- POST /api/work-orders/:id/clone (line 6859)
- GET /api/work-orders/:id/completions (line 7069)
- GET /api/work-orders/:id/history (line 7080)
- POST /api/work-orders/:id/costs (line 7102)
- GET /api/work-orders/:id/costs (line 7118)
- GET /api/work-orders/:id/parts (line 7128)
- POST /api/work-orders/:id/parts (line 7138)
- POST /api/work-orders/:id/parts/bulk (line 7156)
- GET /api/work-orders/:id/parts/costs (line 7265)
- DELETE /api/work-orders/clear (line 16339)

---

**Domain Module: Equipment (server/domains/equipment/routes.ts)**
| Route | Domain Line | routes.ts Line | Status |
|-------|------------|----------------|--------|
| GET /api/equipment | 26 | 2484 | DUPLICATE |
| GET /api/equipment/health | 86 | 2496 | DUPLICATE |
| GET /api/equipment/sensor-issues | 114 | 7672 | DUPLICATE |
| GET /api/equipment/:id/rul | 126 | 2565 | DUPLICATE |
| POST /api/equipment/rul/batch | 154 | 2611 | DUPLICATE |
| GET /api/equipment/:id | 239 | 2692 | DUPLICATE |
| DELETE /api/equipment/:id | 344 | 2775 | DUPLICATE |

**Routes only in routes.ts (need migration):**

- POST /api/equipment (2709), PUT /api/equipment/:id (2730)
- POST /api/equipment/:id/degradation (2639)
- GET /api/equipment/:id/sensor-coverage (2793), POST /api/equipment/:id/setup-sensors (2855)
- GET /api/equipment/:id/load-distribution (2895)
- GET /api/equipment/:id/dtc/active (6179), GET /api/equipment/:id/dtc/history (6197)
- GET /api/equipment/:id/dtc/health-impact (6409), GET /api/equipment/:id/dtc/report-summary (6457)
- GET /api/equipment/:equipmentId/compatible-parts (7629), GET /api/equipment/:equipmentId/suggested-parts (7651)
- GET /api/equipment/:equipmentId/sensor-health (8743)

---

**Domain Module: Alerts (server/domains/alerts/routes.ts)**
| Route | Domain Line | routes.ts Line | Status |
|-------|------------|----------------|--------|
| GET /api/alerts/configurations | 29 | 9120 | DUPLICATE |
| POST /api/alerts/configurations | 41 | 9130 | DUPLICATE |
| PUT /api/alerts/configurations/:id | 69 | 9152 | DUPLICATE |
| DELETE /api/alerts/configurations/:id | 94 | 9167 | DUPLICATE |
| GET /api/alerts/notifications | 110 | 9177 | DUPLICATE |
| POST /api/alerts/notifications | 124 | 9236 | DUPLICATE |
| POST /api/alerts/notifications/:id/comment | 183 | 9286 | DUPLICATE |
| GET /api/alerts/notifications/:id/comments | 209 | 9305 | DUPLICATE |
| POST /api/alerts/suppress | 225 | 9315 | DUPLICATE |
| GET /api/alerts/suppressions | 250 | 9335 | DUPLICATE |
| DELETE /api/alerts/suppressions/:id | 264 | 9345 | DUPLICATE |
| POST /api/alerts/notifications/:id/escalate | 280 | 9355 | DUPLICATE |
| DELETE /api/alerts/all | 333 | 9400 | DUPLICATE |

**Routes only in routes.ts:** PATCH /api/alerts/notifications/:id/acknowledge (9261)

---

**Domain Module: Crew (server/domains/crew/routes.ts)**
| Route | Domain Line | routes.ts Line | Status |
|-------|------------|----------------|--------|
| GET /api/crew | 36 | 13811 | DUPLICATE |
| POST /api/crew | 51 | 13833 | DUPLICATE |
| GET /api/crew/:id | 72 | 13990 | DUPLICATE |
| DELETE /api/crew/:id | 115 | 14025 | DUPLICATE |
| GET /api/crew/:id/skills | 239 | 14428 | DUPLICATE |
| GET /api/crew-leave | 252 | 13914 | DUPLICATE |
| DELETE /api/crew-leave/:id | 320 | 13951 | DUPLICATE |
| GET /api/crew-assignments | 336 | 16403 | DUPLICATE |
| GET /api/crew-certifications | 429 | 13870 | DUPLICATE |
| GET /api/skills | 131 | 14363 | DUPLICATE |
| DELETE /api/skills/:id | 169 | 14406 | DUPLICATE |

**Routes only in routes.ts (need migration):**

- PUT/PATCH /api/crew/:id, PATCH /api/crew/:id/rate, POST /api/crew/:id/toggle-duty
- POST /api/crew/skills, DELETE /api/crew/:crewId/skills/:skill
- POST /api/crew/certifications, PUT /api/crew/certifications/:id, DELETE /api/crew/certifications/:id
- POST /api/crew/leave, PUT /api/crew/leave/:id
- POST /api/crew/assignments, POST /api/crew/schedule/plan, POST /api/crew/schedule/plan-enhanced
- POST /api/crew/rest/_, GET /api/crew/rest/_
- POST /api/skills, PUT /api/skills/:id

---

**Domain Module: Vessels (server/domains/vessels/routes.ts)**
| Route | Domain Line | routes.ts Line | Status |
|-------|------------|----------------|--------|
| GET /api/vessels | 37 | 7832 | DUPLICATE |
| GET /api/vessels/:id | 77 | 14690 | DUPLICATE |
| GET /api/vessels/:id/equipment | 259 | 14855 | DUPLICATE |

**Routes only in routes.ts:**

- POST /api/vessels (14669), PUT /api/vessels/:id (14703)
- POST /api/vessels/:id/reset-downtime (14804), POST /api/vessels/:id/reset-operation (14817)
- GET /api/vessels/:id/power-stw-analysis (14916), GET /api/vessels/:id/operating-mode (15185)

---

**Domain Module: Devices (server/domains/devices/routes.ts)**
| Route | Domain Line | routes.ts Line | Status |
|-------|------------|----------------|--------|
| GET /api/devices | 27 | - | UNIQUE |
| GET /api/devices/:id | 46 | - | UNIQUE |
| DELETE /api/devices/:id | 125 | - | UNIQUE |

**No duplicates - fully migrated**

---

**Domain Module: Inventory (server/domains/inventory/routes.ts)**
| Route | Domain Line | routes.ts Line | Status |
|-------|------------|----------------|--------|
| GET /api/parts | 28 | 13440 | DUPLICATE |
| DELETE /api/parts/:id | 40 | 13516 | DUPLICATE |
| POST /api/parts/availability | 55 | 13531 | DUPLICATE |
| POST /api/parts/:id/sync-costs | 75 | 13547 | DUPLICATE |
| GET /api/parts-inventory | 144 | 7275 | DUPLICATE |

**Routes only in routes.ts:**

- POST /api/parts (13451), PUT /api/parts/:id (13468)
- GET /api/parts-inventory/paginated (7333), GET /api/parts-inventory/filters (7420)
- POST /api/parts-inventory (7443), PUT /api/parts-inventory/:id (7479)
- GET /api/parts/:partId/compatible-equipment (7640), PATCH /api/parts/:partId/compatibility (7688)

---

**Domain Module: Maintenance (server/domains/maintenance/routes.ts)**
| Route | Domain Line | routes.ts Line | Status |
|-------|------------|----------------|--------|
| GET /api/maintenance-schedules | 28 | 7890 | DUPLICATE |
| GET /api/maintenance-schedules/:id | 62 | - | UNIQUE |
| GET /api/maintenance-templates | 205 | 8014 | DUPLICATE |
| GET /api/maintenance-templates/:id | 223 | 8034 | DUPLICATE |

**Routes only in routes.ts:**

- GET /api/maintenance-schedules/upcoming (7903), POST /api/maintenance-schedules (7922)
- PUT /api/maintenance-schedules/:id (7962), DELETE /api/maintenance-schedules/:id (7978)
- POST /api/maintenance-schedules/auto-schedule/:equipmentId (7990)
- POST /api/maintenance-templates (8053), PUT /api/maintenance-templates/:id (8074)
- DELETE /api/maintenance-templates/:id (8096), POST /api/maintenance-templates/:id/clone (8113)
- GET /api/maintenance-templates/:id/items (8135), POST /api/maintenance-templates/:id/items (8145)
- GET /api/maintenance-checklist/:workOrderId (8229)
- DELETE /api/maintenance/schedules/clear (16353)

---

### Summary of All Domains

| Domain      | Domain Routes | TRUE Duplicates | Unique Inline | Status        |
| ----------- | ------------- | --------------- | ------------- | ------------- |
| work-orders | 12            | 7               | 10            | Partial       |
| equipment   | 7             | 7               | 13            | Partial       |
| crew        | 14            | 11              | 19+           | Partial       |
| alerts      | 13            | 13              | 1             | Near-Complete |
| vessels     | 3             | 3               | 6             | Partial       |
| devices     | 3             | 0               | 0             | Complete      |
| inventory   | 5             | 5               | 8             | Partial       |
| maintenance | 4             | 3               | 13            | Partial       |

**Total: 49 duplicate routes identified (safe to remove from routes.ts)**
**Total routes only in routes.ts: 70+ (need future migration)**

### Migration Priority

1. **High Risk**: Routes with complex validation, transactions, or side effects
2. **Medium Risk**: Standard CRUD operations
3. **Low Risk**: Simple read operations

### Safety Protocol

1. Comment out route in routes.ts (don't delete yet)
2. Run regression tests
3. Manual verification in UI
4. If successful, delete commented code
5. If failed, uncomment and investigate

## Related Documentation

- [Frontend Patterns](./frontend-patterns.md)
- [API Testing](../server/tests/README.md)
