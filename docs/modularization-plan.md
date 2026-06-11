# ARUS Backend Modularization Plan

## Executive Summary

**Current State:**

- `server/routes.ts`: 12,457 lines (~239 active inline routes)
- `server/storage.ts`: 24,164 lines
- **Target**: ~2,000-3,000 lines each

**Domain Modules (32 existing):**

- Total routes in domain modules: ~469 routes
- Total domain module code: ~10,000+ lines

---

## PHASE 1: Route Mapping by Domain

### Already Extracted (Domain Modules)

| Domain                | Routes | Lines | Coverage                     |
| --------------------- | ------ | ----- | ---------------------------- |
| logbook               | 57     | 1,149 | Deck/Engine logs, compliance |
| crew                  | 36     | 933   | Crew management, certs       |
| work-orders           | 26     | 814   | WO lifecycle, tasks          |
| sensor-management     | 26     | 632   | Sensor configs, J1939        |
| analytics             | 26     | 1,049 | Maintenance analytics        |
| ml-analytics          | 21     | 703   | ML exports, predictions      |
| storage-backup        | 19     | 254   | Backup management            |
| compliance            | 18     | 367   | STCW compliance              |
| condition-monitoring  | 17     | 353   | Oil analysis, wear           |
| scheduling            | 15     | 309   | Maintenance scheduling       |
| equipment             | 15     | 434   | Equipment registry           |
| alerts                | 14     | 345   | Alert configs                |
| vessels               | 13     | 313   | Vessel management            |
| settings              | 12     | 172   | System settings              |
| port-operations       | 12     | 197   | Port calls, drydock          |
| notifications         | 12     | 202   | Email notifications          |
| maintenance           | 12     | 324   | Schedules, templates         |
| dtc                   | 12     | 387   | Diagnostic codes             |
| inventory             | 11     | 410   | Parts inventory              |
| health-monitoring     | 11     | 240   | Health checks                |
| sync                  | 10     | 380   | Sync health                  |
| stormgeo              | 10     | 173   | Weather integration          |
| external-integrations | 10     | 128   | MQTT, webhooks               |
| admin                 | 10     | 230   | Org/user mgmt                |
| expenses              | 9      | 131   | Expenses tracking            |
| vibration             | 8      | 330   | FFT analysis                 |
| operating-params      | 8      | 108   | Operating conditions         |
| telemetry             | 7      | 166   | Telemetry reads              |
| integrations          | 7      | 276   | FMCC integration             |
| devices               | 5      | 142   | Edge devices                 |
| cost-savings          | 5      | 152   | Cost tracking                |

**Total Domain Routes: ~469**

---

### Remaining Inline Routes (Need Extraction)

| Category      | Routes | Lines Est. | Target Domain         | Priority |
| ------------- | ------ | ---------- | --------------------- | -------- |
| HEALTH        | 12     | ~400       | health-monitoring     | LOW      |
| LLM-REPORTS   | 5      | ~400       | llm-reports (NEW)     | MEDIUM   |
| REPORTS       | 5      | ~500       | reports (NEW)         | MEDIUM   |
| ML-TRAINING   | 10     | ~600       | ml-analytics          | HIGH     |
| RUL-ENGINE    | 3      | ~150       | ml-analytics          | MEDIUM   |
| ACOUSTIC      | 2      | ~100       | vibration             | MEDIUM   |
| CREW          | 20     | ~500       | crew                  | MEDIUM   |
| SCHEDULING    | 15     | ~400       | scheduling            | MEDIUM   |
| INVENTORY     | 6      | ~300       | inventory             | LOW      |
| COMPLIANCE    | 2      | ~100       | compliance            | LOW      |
| PORT-OPS      | 4      | ~150       | port-operations       | LOW      |
| VESSELS       | 10     | ~800       | vessels               | MEDIUM   |
| EQUIPMENT     | 3      | ~200       | equipment             | LOW      |
| TELEMETRY     | 2      | ~100       | telemetry             | LOW      |
| MAINTENANCE   | 3      | ~200       | maintenance           | LOW      |
| ANALYTICS     | 3      | ~150       | analytics             | LOW      |
| SETTINGS      | 2      | ~100       | settings              | LOW      |
| DIGITAL-TWINS | 4      | ~200       | ml-analytics          | MEDIUM   |
| EXTERNAL      | 5      | ~200       | external-integrations | LOW      |
| ADMIN         | 50+    | ~3,000     | admin                 | HIGH     |
| ERROR-LOGS    | 4      | ~150       | health-monitoring     | LOW      |
| FLEET         | 1      | ~100       | vessels               | LOW      |
| CONTEXT       | 3      | ~100       | context (NEW)         | LOW      |
| ANOMALIES     | 1      | ~50        | ml-analytics          | LOW      |
| COPILOT       | 1      | ~200       | copilot (NEW)         | MEDIUM   |
| STORMGEO      | 10     | ~300       | stormgeo              | LOW      |
| LOGBOOK       | 12     | ~400       | logbook               | LOW      |
| DEV-TOOLS     | 3      | ~150       | dev-tools (NEW)       | LOW      |
| MQTT          | 1      | ~50        | sync                  | LOW      |

**Total Inline Routes: ~192**
**Estimated Lines: ~9,000**

---

## PHASE 2: Storage Method Mapping

### Storage Interface Categories

| Category        | Methods | Lines Est. | Target Storage Module |
| --------------- | ------- | ---------- | --------------------- |
| Organizations   | 6       | ~200       | admin-storage         |
| Users           | 6       | ~200       | admin-storage         |
| Devices         | 5       | ~150       | devices-storage       |
| Heartbeats      | 3       | ~100       | devices-storage       |
| PDM Scores      | 3       | ~100       | ml-storage            |
| Work Orders     | 25+     | ~1,500     | work-orders-storage   |
| Settings        | 2       | ~100       | settings-storage      |
| Telemetry       | 10+     | ~800       | telemetry-storage     |
| Sensor Configs  | 15+     | ~600       | sensor-storage        |
| J1939           | 5       | ~200       | dtc-storage           |
| DTC             | 8+      | ~400       | dtc-storage           |
| Alerts          | 15+     | ~600       | alerts-storage        |
| Dashboard       | 5       | ~300       | analytics-storage     |
| Maintenance     | 15+     | ~800       | maintenance-storage   |
| Crew            | 30+     | ~1,500     | crew-storage          |
| Inventory       | 20+     | ~1,000     | inventory-storage     |
| Equipment       | 15+     | ~600       | equipment-storage     |
| Vessels         | 15+     | ~600       | vessels-storage       |
| Logbook         | 40+     | ~2,000     | logbook-storage       |
| STCW/Compliance | 20+     | ~1,000     | compliance-storage    |
| ML Models       | 15+     | ~600       | ml-storage            |
| Insights        | 10+     | ~400       | analytics-storage     |

**Total Storage Methods: ~280+**
**Estimated Lines: ~14,000**

---

## PHASE 3: Dependency Graph

### Cross-Domain Dependencies

```
storage → ALL DOMAINS (shared interface)
├── telemetry-storage → equipment, sensors
├── work-orders-storage → equipment, inventory, crew
├── maintenance-storage → equipment, work-orders
├── alerts-storage → equipment, telemetry
├── crew-storage → vessels, compliance
├── logbook-storage → vessels, telemetry, crew
├── inventory-storage → equipment, work-orders
└── ml-storage → equipment, telemetry

routes.ts shared dependencies:
├── requireOrgId middleware
├── rate limiters (general, write, critical)
├── storage interface
├── error handlers
└── logging utilities
```

### Cyclic Dependencies (Need Breaking)

1. `work-orders ↔ inventory` (parts reservation)
2. `equipment ↔ telemetry` (health calculation)
3. `maintenance ↔ work-orders` (schedule generation)
4. `crew ↔ vessels` (assignment lookups)

---

## PHASE 4: Extraction Order

### Tier 1 - Low Risk (Simple CRUD)

1. health-monitoring (consolidate health routes)
2. settings (simple get/put)
3. error-logs → health-monitoring
4. port-operations (CRUD only)
5. context → context (NEW module)

### Tier 2 - Medium Risk (Cross-references)

1. vessels (admin routes)
2. inventory (remaining routes)
3. crew (remaining routes)
4. scheduling (remaining routes)
5. stormgeo (remaining routes)
6. logbook (remaining routes)
7. llm-reports (NEW module)
8. reports (NEW module)
9. copilot (NEW module)

### Tier 3 - High Risk (Complex Logic)

1. admin (large section, auth logic)
2. ml-training → ml-analytics
3. digital-twins → ml-analytics
4. telemetry-ingestion (performance-critical)
5. equipment health (RUL engine integration)
6. alerts engine (real-time processing)

---

## New Domain Modules Needed

| Module      | Purpose                  | Routes | Lines Est. |
| ----------- | ------------------------ | ------ | ---------- |
| llm-reports | OpenAI report generation | 5      | ~400       |
| reports     | PDF/compliance reports   | 5      | ~500       |
| copilot     | AI chat interface        | 1      | ~200       |
| context     | Event context mgmt       | 3      | ~100       |
| dev-tools   | Development utilities    | 3      | ~150       |

---

## Storage Modularization Strategy

### Interface Extraction Pattern

```typescript
// storage/interfaces/index.ts
export interface IOrganizationStorage { ... }
export interface IUserStorage { ... }
export interface IEquipmentStorage { ... }
// ... etc

// storage/implementations/organization-storage.ts
export class OrganizationStorage implements IOrganizationStorage { ... }

// storage/index.ts (facade)
export class Storage implements IStorage {
  organizations: IOrganizationStorage;
  users: IUserStorage;
  // Compose all sub-storage modules
}
```

### Extraction Priority for storage.ts

1. **First Wave** (~5,000 lines):
   - Organizations/Users → admin-storage
   - Settings → settings-storage
   - Devices/Heartbeats → devices-storage

2. **Second Wave** (~5,000 lines):
   - Equipment → equipment-storage
   - Telemetry → telemetry-storage
   - Sensors → sensor-storage

3. **Third Wave** (~5,000 lines):
   - Work Orders → work-orders-storage
   - Inventory → inventory-storage
   - Maintenance → maintenance-storage

4. **Fourth Wave** (~5,000 lines):
   - Crew → crew-storage
   - STCW/Compliance → compliance-storage
   - Logbook → logbook-storage

5. **Fifth Wave** (~4,000 lines):
   - Alerts → alerts-storage
   - ML/Analytics → ml-storage
   - Remaining utilities

---

## Safety Checklist Per Extraction

Before removing ANY inline route:

- [ ] Verify path matches exactly
- [ ] Verify HTTP method matches
- [ ] Verify middleware chain (rate limiters, requireOrgId)
- [ ] Verify request validation schema
- [ ] Verify storage method calls match
- [ ] Verify response shape matches
- [ ] Verify error handling matches
- [ ] Run typecheck after extraction
- [ ] Test endpoint manually or with playwright

---

## Target End State

### routes.ts (~2,000 lines)

- Imports and type definitions
- Middleware setup
- Domain module registrations
- Global error handlers
- Health/metrics endpoints (optional)

### storage.ts (~2,000 lines)

- Interface definitions
- Storage facade class
- Module composition
- Common utilities

### Domain Modules (~20,000+ lines total)

- 35+ domain modules
- Each self-contained with routes + storage
- Dependency injection pattern
