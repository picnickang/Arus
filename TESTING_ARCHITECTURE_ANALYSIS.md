# ARUS Test Architecture & Gap Analysis Report

**Generated:** 2025-11-29  
**Phase:** 0 - Architecture & Gap Analysis (MANDATORY BEFORE CODING)

---

## Executive Summary

The ARUS marine operations application has a **moderate testing infrastructure** with 20+ existing test files but significant gaps in coverage for critical subsystems. The codebase includes a sophisticated telemetry simulator, comprehensive test utilities, but lacks end-to-end testing, logbook-specific tests, and CI/CD automation.

---

## 1. Subsystem Architecture Summary

### 1.1 Telemetry Ingestion & Processing Pipeline

| Component | File(s) | Status |
|-----------|---------|--------|
| Batch Writer | `server/telemetry-batch-writer.ts` | Production |
| MQTT Ingestion | `server/mqtt-ingestion-service.ts` | Production |
| Dead Letter Logging | `server/utils/dead-letter-logger.ts` | Production |
| Vessel Simulator | `server/vessel-simulator.ts` (709 lines) | **Existing** |
| Telemetry Metrics | `server/observability/telemetry-metrics.ts` | Production |

**Testability:** 🟡 Partially testable
- ✅ Vessel simulator exists with physics-aware simulation (11 vessel types, fault injection)
- ❌ No integration tests for MQTT ingestion
- ❌ No load testing for batch writer
- ❌ Simulator not integrated into test suite

### 1.2 Vessel / Equipment / Engine / Generator Models

| Component | File(s) | Tests |
|-----------|---------|-------|
| Equipment Domain | `server/domains/equipment/` | Some coverage |
| Vessel Intelligence | `server/vessel-intelligence.ts` | ❌ No tests |
| Digital Twin | `server/digital-twin-service.ts` | ❌ No tests |
| Sensor Taxonomy | `server/sensor-taxonomy.ts` | ❌ No tests |

**Testability:** 🟡 Partially testable
- ✅ Equipment CRUD has integration tests
- ❌ No vessel-specific tests
- ❌ No digital twin state validation tests

### 1.3 Engine Room Logbook (ER)

| Component | File(s) | Tests |
|-----------|---------|-------|
| Auto-fill Service | `server/services/engine-log-autofill-service.ts` (982 lines) | ❌ No tests |
| Event Service | `server/services/engine-log-event-service.ts` | ❌ No tests |
| Anomaly Thresholds | `ENGINE_ANOMALY_THRESHOLDS` in routes.ts | ❌ No tests |
| Routes | `server/routes.ts` (logbook endpoints) | ❌ No tests |

**Testability:** 🔴 Not testable
- ❌ No auto-fill tests
- ❌ No hourly entry validation tests
- ❌ No generator log tests
- ❌ No daily summary tests
- ❌ No signing/locking workflow tests

### 1.4 Deck Logbook

| Component | File(s) | Tests |
|-----------|---------|-------|
| Event Service | `server/services/deck-log-event-service.ts` | ❌ No tests |
| StormGeo Integration | `server/services/stormgeo-integration-service.ts` | ❌ No tests |
| Track Log Service | `server/services/track-log-service.ts` | ❌ No tests |

**Testability:** 🔴 Not testable
- ❌ No voyage entry tests
- ❌ No weather auto-fill tests
- ❌ No position/time tests
- ❌ No fuel/emissions log tests

### 1.5 Work Orders & Parts Inventory Linkage

| Component | File(s) | Tests |
|-----------|---------|-------|
| Work Orders Domain | `server/domains/work-orders/` | ❌ No dedicated tests |
| Inventory Domain | `server/domains/inventory/` | ❌ No dedicated tests |
| Maintenance Domain | `server/domains/maintenance/` | ❌ No dedicated tests |
| Inventory Auto-Optimization | `server/inventory/auto-optimization.ts` | ❌ No tests |
| Inventory Risk | `server/inventory-risk.ts` | ❌ No tests |

**Testability:** 🔴 Not testable
- ❌ No work order CRUD tests
- ❌ No status transition tests
- ❌ No inventory linking tests
- ❌ No parts consumption tests

### 1.6 Crew Management & Hours of Rest

| Component | File(s) | Tests |
|-----------|---------|-------|
| HoR Generator | `server/scheduler/hor-generator.ts` | ✅ `hor-generator.test.ts` |
| STCW Compliance | `server/stcw-compliance.ts` (487 lines) | ❌ No tests |
| Crew Alert Evaluators | `server/domains/alerts/crew-alert-evaluators.ts` | ❌ No tests |
| Scheduler API | `server/scheduler/scheduler-controller.ts` | ✅ `scheduler-api.test.ts` |
| Scheduler Constraints | Multiple files | ✅ `scheduler-constraints.test.ts` |

**Testability:** 🟡 Partially testable
- ✅ HoR generator has basic tests
- ✅ Scheduler API has tests
- ❌ No STCW violation detection tests
- ❌ No 7-day rolling compliance tests
- ❌ No fatigue score tests

### 1.7 Alerts & Notifications

| Component | File(s) | Tests |
|-----------|---------|-------|
| Alerts Service | `server/domains/alerts/service.ts` | ❌ No tests |
| Alert Runner | `server/domains/alerts/alert-runner.ts` | ❌ No tests |
| Alert Repository | `server/domains/alerts/repository.ts` | ❌ No tests |
| Email Notification | `server/services/email-notification-service.ts` (601 lines) | ❌ No tests |
| Email Provider | `server/services/email-provider-service.ts` | ❌ No tests |
| Compliance Rules Engine | `server/services/compliance-rules-engine.ts` | ❌ No tests |

**Testability:** 🔴 Not testable
- ❌ No alert creation tests
- ❌ No WebSocket broadcast tests
- ❌ No email sending tests
- ❌ No email retry logic tests

### 1.8 Sync & Dual Database

| Component | File(s) | Tests |
|-----------|---------|-------|
| Dual-Write Adapter | `server/infrastructure/TenantScopedRepository.ts` | ✅ `dual-write-adapter.test.ts` |
| Sync Manager | `server/sync-manager.ts` | ❌ No tests |
| MQTT Reliable Sync | `server/mqtt-reliable-sync.ts` | ❌ No tests |
| SQLite Init | `server/sqlite-init.ts` | ❌ No tests |
| Conflict Resolution | `server/conflict-resolution-service.ts` | ❌ No tests |

**Testability:** 🟡 Partially testable
- ✅ Dual-write adapter has tests
- ❌ No sync manager tests
- ❌ No offline/online transition tests
- ❌ No schema parity validation

### 1.9 Electron Integration

| Component | File(s) | Tests |
|-----------|---------|-------|
| Main Process | `electron/main.ts` (615 lines) | ❌ No tests |
| Preload | `electron/preload.ts` | ❌ No tests |
| IPC Channels | Various | ❌ No validation |

**Testability:** 🔴 Not testable
- ❌ No startup flow tests
- ❌ No IPC contract tests
- ❌ No health check integration tests
- ❌ No window lifecycle tests

### 1.10 React/React Query Usage

| Component | Location | Tests |
|-----------|----------|-------|
| Query Client | `client/src/lib/queryClient.ts` | ❌ No tests |
| Pages | `client/src/pages/` | ❌ No E2E tests |
| Components | `client/src/components/` | ❌ No unit tests |
| Formatters | `client/src/lib/formatters.ts` | ✅ `formatters.test.ts` |

**Testability:** 🔴 Not testable (mostly)
- ✅ Formatters have unit tests
- ❌ No component tests
- ❌ No page-level E2E tests
- ❌ No form validation tests

---

## 2. Existing Test Infrastructure

### 2.1 Test Files Inventory

```
server/tests/
├── setup/
│   ├── fixtures/sensorOptimization.ts
│   ├── test-auth.ts
│   └── test-db.ts
├── api-response-envelope.test.ts (NEW)
├── critical-path.test.ts
├── dual-write-adapter.test.ts
├── fixtures.ts
├── hor-generator.test.ts
├── integration.test.ts
├── middleware-auth.test.ts
├── ml-circuit-breaker.test.ts
├── ml-components.test.ts
├── money-utils.test.ts
├── new-routes.test.ts
├── README.md
├── rul-engine.test.ts
├── rul-utils.test.ts
├── scheduler-api.test.ts
├── scheduler-constraints.test.ts
├── security.test.ts
├── tenant-scoped-repository.test.ts
└── test-app.ts

server/__tests__/
├── pdm-smoke.test.ts
└── pdm-math.test.ts

client/tests/
└── formatters.test.ts

tests/
├── helpers/
│   ├── test-data-factory.ts
│   └── test-logger.ts
├── setup/
│   └── test-app.ts
├── unit/marine-pdm-logger.test.ts
├── integration/analytics-flow.test.ts
├── e2e/equipment-health-flow.test.ts
└── ai-sensor-optimization.test.ts
```

### 2.2 Existing Test Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `createTestApp()` | `server/tests/test-app.ts` | Express app for integration tests |
| `createAuthHeaders()` | `server/tests/test-app.ts` | Multi-tenant auth headers |
| `setupTestDb()` | `server/tests/setup/test-db.ts` | Database setup/teardown |
| `setTestAuth()` | `server/tests/setup/test-auth.ts` | Auth context management |
| `MultiTenantScenario` | `server/tests/fixtures.ts` | Multi-org test data |
| `createTestTelemetry()` | `server/tests/fixtures.ts` | Telemetry test data |

### 2.3 Existing Simulators

| Simulator | Location | Features |
|-----------|----------|----------|
| **Vessel Telemetry Simulator** | `server/vessel-simulator.ts` | 11 vessel types, physics engine, fault injection, realistic torque/thermal curves |

### 2.4 Existing CI Scripts

**Status:** ❌ No GitHub Actions workflow files found in `.github/workflows/`

The `server/tests/README.md` references a CI pipeline but no actual workflow files exist.

---

## 3. Gap Analysis

### 3.1 API Routes Without Tests

| Route Category | Endpoints | Priority |
|----------------|-----------|----------|
| Engine Logbook | `/api/logbook/engine/*` | 🔴 Critical |
| Deck Logbook | `/api/logbook/deck/*` | 🔴 Critical |
| Work Orders | `/api/work-orders/*` | 🔴 Critical |
| Inventory | `/api/inventory/*`, `/api/parts/*` | 🔴 Critical |
| Alerts | `/api/alerts/*` | 🔴 Critical |
| Crew Management | `/api/crew/*` (except toggle-duty) | 🟡 High |
| Vessel Tracking | `/api/vessels/*/track` | 🟡 High |
| FMCC Integration | `/api/fmcc/*` | 🟡 High |

### 3.2 Critical Business Logic Without Coverage

| Logic | Location | Priority |
|-------|----------|----------|
| Engine log auto-fill from telemetry | `engine-log-autofill-service.ts` | 🔴 Critical |
| STCW compliance violation detection | `stcw-compliance.ts` | 🔴 Critical |
| Work order status transitions | `work-orders/service.ts` | 🔴 Critical |
| Alert threshold evaluation | `alert-runner.ts` | 🔴 Critical |
| Email notification delivery | `email-notification-service.ts` | 🟡 High |
| Inventory reorder logic | `inventory-risk.ts` | 🟡 High |
| Sync conflict resolution | `conflict-resolution-service.ts` | 🟡 High |

### 3.3 Database Schema Without Integration Tests

| Schema | Tables | Priority |
|--------|--------|----------|
| Logbooks | `engine_log_hourly`, `engine_log_generator`, `engine_log_daily`, `deck_log_entry` | 🔴 Critical |
| Work Orders | `work_orders`, `work_order_tasks`, `work_order_parts` | 🔴 Critical |
| Crew/HoR | `crew_rest_sheet`, `crew_rest_day`, `crew_leave` | 🔴 Critical |
| Alerts | `alert_configurations`, `alert_notifications`, `alert_suppressions` | 🟡 High |
| Inventory | `parts`, `inventory_transactions`, `stock_levels` | 🟡 High |

### 3.4 IPC Channels Not Validated

| Channel | Direction | Purpose |
|---------|-----------|---------|
| Server startup | Main → Renderer | Health check polling |
| Port allocation | Main → Renderer | Dynamic port communication |
| Window lifecycle | Main ↔ Renderer | Close/minimize/maximize |
| Update notifications | Main → Renderer | Version update alerts |

### 3.5 UI Flows Without E2E Tests

| Flow | Priority |
|------|----------|
| Create/edit engine room logbook entry | 🔴 Critical |
| Sign and lock logbook | 🔴 Critical |
| Create work order from alert | 🔴 Critical |
| Crew scheduling with HoR validation | 🔴 Critical |
| Inventory search and filter | 🟡 High |
| Equipment health dashboard | 🟡 High |
| Settings configuration | 🟡 High |

### 3.6 Telemetry/Logging Blind Spots

| Blind Spot | Impact |
|------------|--------|
| No structured logging in logbook services | Hard to debug auto-fill issues |
| No correlation IDs in logbook operations | Cannot trace request lifecycle |
| No metrics for logbook operations | No visibility into latency/errors |
| No dead-letter queue for failed auto-fills | Silent data loss |

---

## 4. Testability Classification Summary

| Subsystem | Status | Existing Tests | Key Gaps |
|-----------|--------|----------------|----------|
| Telemetry Ingestion | 🟡 Partial | Simulator exists | Integration tests, load tests |
| Equipment/Vessel | 🟡 Partial | Some CRUD | Vessel-specific, digital twin |
| Engine Room Logbook | 🔴 None | 0 tests | All functionality |
| Deck Logbook | 🔴 None | 0 tests | All functionality |
| Work Orders | 🔴 None | 0 tests | CRUD, status transitions |
| Inventory | 🔴 None | 0 tests | CRUD, search, performance |
| Crew/HoR | 🟡 Partial | HoR, scheduler | STCW violations, fatigue |
| Alerts | 🔴 None | 0 tests | Creation, WebSocket, email |
| Sync/Dual DB | 🟡 Partial | Dual-write | Sync manager, conflicts |
| Electron | 🔴 None | 0 tests | IPC, startup, lifecycle |
| React UI | 🔴 None | Formatters only | Components, pages, E2E |

---

## 5. Recommendations for Phase 1

### 5.1 Reuse Existing Infrastructure

1. **DO NOT** create new test app harness - extend `server/tests/test-app.ts`
2. **DO NOT** create new DB setup - extend `server/tests/setup/test-db.ts`
3. **REUSE** `MultiTenantScenario` and `createTestTelemetry()` fixtures
4. **EXTEND** vessel simulator for logbook auto-fill testing

### 5.2 Priority Implementation Order

1. **Engine Room Logbook Tests** (Critical - core business logic)
2. **Deck Logbook Tests** (Critical - regulatory compliance)
3. **Work Order Tests** (Critical - operational workflow)
4. **STCW Compliance Tests** (Critical - safety regulations)
5. **Alert Engine Tests** (High - operational awareness)
6. **CI/CD Pipeline** (High - automated quality gate)
7. **E2E UI Tests** (Medium - user workflow validation)
8. **Electron IPC Tests** (Medium - desktop stability)
9. **Performance Tests** (Medium - scalability validation)
10. **Diagnostic Dashboard** (Low - operational visibility)

---

## 6. Next Steps

With this analysis complete, proceed to **Phase 1** implementation focusing on:

1. Extend vessel simulator for logbook-specific telemetry patterns
2. Create logbook automation test suite (ER + Deck)
3. Build work order and inventory test groups
4. Implement STCW compliance tests
5. Add alert engine test suite

**Ready to proceed to Phase 1 implementation.**
