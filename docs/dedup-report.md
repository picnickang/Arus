# ARUS Codebase Deduplication Report

**Generated:** 2026-01-05  
**Last Updated:** 2026-01-05  
**Tool Versions:** jscpd 4.x, knip 5.x  
**Total Codebase:** 217,489 lines TypeScript/TSX (after removing 1,068 lines dead code)

---

## Recent Changes (2026-01-05)

### Phase 1: Testing Infrastructure (COMPLETED)

- Jest configured with @swc/jest for fast TypeScript compilation
- Test factory pattern in server/app.ts with `createTestApp()`
- Integration test templates created for: work-orders, crew-scheduling, telemetry, compliance-exports, rag-conversations
- Unit tests added for api-helpers (23 passing tests)
- Test-only schema facade created to handle dual-mode (PostgreSQL/SQLite) ESM issues

### Phase 2: Dead Code Removal (COMPLETED)

- **Removed `server/auto-fix/`** (246 lines) - Complete AutoFix service that was never integrated
- **Kept `server/acoustic-monitoring/`** - Used by ml-pipeline/routes.ts
- **Kept `server/analytics-data-normalizer/`** - Used by 5 ml-analytics route files
- **Compliance exports assessed** - Already well-modularized, no consolidation needed

### Phase 3: API Helpers Pattern Adoption (COMPLETED)

- **work-orders domain**: Refactored core.ts, tasks.ts, extended.ts, parts.ts
  - Replaced 25+ lines of manual pagination parsing with `parsePagination` (strict validation preserved)
  - Replaced manual `safeParse` patterns with `validateBody` + `sendValidationError`
  - Updated error responses with `sendBadRequest` + `sendConflict`
- **crew-extensions domain**: Refactored assignments-routes.ts, scheduler-routes.ts
  - Updated validation endpoints to use `sendBadRequest`
- **inventory-optimization**: Refactored routes.ts
  - Updated optimize and auto-optimize endpoints to use `sendBadRequest`
- **Pattern benefits**: Consistent 400/409 error responses, reduced boilerplate, improved maintainability

### Total Lines Removed This Session

- Previous dead code removal: 822 lines
- auto-fix subsystem: 246 lines
- **Total removed: 1,068 lines**
- **Lines reduced via pattern consolidation**: ~50+ lines across 7 route files

---

## Executive Summary

| Metric                    | Value          |
| ------------------------- | -------------- |
| Total Files Analyzed      | 2,016          |
| Total Lines               | 236,309        |
| Duplicate Clones Found    | 273            |
| Duplicated Lines          | 4,895 (2.07%)  |
| Unused Files (knip)       | 729            |
| Estimated Removable Lines | ~15,000-25,000 |

---

## Phase 0: Repository Discovery

### Package Manager & Structure

- **Package Manager:** npm (package-lock.json)
- **Workspace Structure:** Single package (no monorepo workspaces)
- **Module System:** ESM ("type": "module")

### Frontend Stack

- **Framework:** React 18
- **Bundler:** Vite 5
- **Router:** Wouter
- **State:** TanStack Query v5
- **UI:** shadcn/ui + Radix + Tailwind CSS
- **Build:** esbuild for server, Vite for client

### Backend Stack

- **Framework:** Express.js
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL (Neon cloud) + SQLite (Turso local)
- **Architecture:** DDD Modular Monolith with Hexagonal patterns

### TypeScript Configuration

- Single tsconfig.json covering client/server/shared
- Path aliases: `@/*` (client), `@shared/*` (shared)
- Strict mode enabled

---

## Phase 2: Duplication Analysis

### Summary by Language

| Format           | Files | Lines   | Clones | Dup Lines | Dup % |
| ---------------- | ----- | ------- | ------ | --------- | ----- |
| TypeScript (.ts) | 1,482 | 167,577 | 232    | 4,082     | 2.44% |
| TSX (.tsx)       | 275   | 44,020  | 32     | 541       | 1.23% |
| JavaScript       | 259   | 24,712  | 9      | 272       | 1.10% |
| **Total**        | 2,016 | 236,309 | 273    | 4,895     | 2.07% |

---

## Top 20 Duplicated Regions by Lines

### Category A: API/Route Plumbing (HIGHEST PRIORITY)

| Rank | Files                                                            | Lines | Category                    |
| ---- | ---------------------------------------------------------------- | ----- | --------------------------- |
| 1    | `work-orders/interfaces/extended.ts` ↔ `routes/extended.ts`     | 193   | Route/Interface duplication |
| 2    | `work-orders/interfaces/core.ts` ↔ `routes/core.ts`             | 161   | Route/Interface duplication |
| 3    | `work-orders/interfaces/completion.ts` ↔ `routes/completion.ts` | 122   | Route/Interface duplication |
| 4    | `work-orders/interfaces/parts.ts` ↔ `routes/parts.ts`           | 118   | Route/Interface duplication |
| 5    | `work-orders/interfaces/tasks.ts` ↔ `routes/tasks.ts`           | 98    | Route/Interface duplication |
| 6    | `parts-enrichment.ts` internal blocks                            | 69    | Service logic duplication   |
| 7    | `stcw-rest/routes/data.ts` internal blocks                       | 50    | Route handler patterns      |
| 8    | `stcw-rest/routes/fatigue.ts` internal blocks                    | 37    | Route handler patterns      |

**Estimated Lines:** ~850+ lines of duplicated API plumbing

### Category B: Logbook Types/Exports (HIGH PRIORITY)

| Rank | Files                                                    | Lines | Category             |
| ---- | -------------------------------------------------------- | ----- | -------------------- |
| 9    | `deck-log/types.ts` ↔ `engine-log/types.ts`             | 22    | Type definitions     |
| 10   | `logbook/types.ts` ↔ `engine-log/types.ts`              | 22    | Type definitions     |
| 11   | `deck-log/routes/types.ts` ↔ `storage/logbook/types.ts` | 14    | Type re-declarations |
| 12   | `deckExport.ts` ↔ `engineExport.ts`                     | 35    | Export logic         |

**Estimated Lines:** ~100+ lines of duplicated logbook code

### Category C: UI Components (MEDIUM PRIORITY)

| Rank | Files                                            | Lines | Category              |
| ---- | ------------------------------------------------ | ----- | --------------------- |
| 13   | `ModelTable.tsx` internal blocks                 | 36    | Table rendering logic |
| 14   | `AccuracyTrendChart.tsx` internal blocks         | 28    | Chart components      |
| 15   | `ServiceOrderFormDialog.tsx` internal blocks     | 19    | Form field patterns   |
| 16   | `RagAnalyticsDashboard.tsx` internal blocks      | 16    | Dashboard sections    |
| 17   | `PartsRequestCard.tsx` ↔ `ServiceOrderCard.tsx` | 12    | Card layout patterns  |

**Estimated Lines:** ~110+ lines of duplicated UI code

### Category D: Scheduling/Crew Types (MEDIUM PRIORITY)

| Rank | Files                                                    | Lines | Category         |
| ---- | -------------------------------------------------------- | ----- | ---------------- |
| 18   | `crew-scheduler-ortools/types.ts` ↔ `crewScheduling.ts` | 17    | Type definitions |
| 19   | `crew-scheduler.ts` ↔ `crew-scheduler-ortools/types.ts` | 20    | Scheduler types  |
| 20   | `constraint-scheduler.ts` ↔ `scheduler.ts`              | 10    | Constraint logic |

**Estimated Lines:** ~50 lines of duplicated scheduling types

### Category E: Compliance Export (LOW PRIORITY)

| Files                                            | Lines | Category          |
| ------------------------------------------------ | ----- | ----------------- |
| `compliance-excel/*.ts` ↔ `compliance-pdf/*.ts` | 50+   | Export formatting |

---

## Unused Files Analysis (knip)

### Summary: 729 Unused Files Detected

**WARNING:** knip uses static analysis and may produce false positives for:

- Dynamically imported modules
- Files registered via string paths
- Test fixtures and dev utilities

### Breakdown by Category

| Category                  | Count | Action                    |
| ------------------------- | ----- | ------------------------- |
| **Client UI Components**  | ~50   | Review for dead features  |
| **Client Hooks**          | ~30   | Check if feature-flagged  |
| **Server Domain Modules** | ~300  | Major review needed       |
| **Server DB Modules**     | ~50   | Already cleaned mem-\*.ts |
| **Server Services**       | ~100  | Review for dynamic usage  |
| **Index/Barrel Files**    | ~100  | Often re-export hubs      |

### High-Value Unused Modules (Verify Before Deletion)

1. **`server/acoustic-monitoring/*`** (6 files) - Feature may be WIP
2. **`server/analytics-data-normalizer/*`** (7 files) - Possibly unused
3. **`server/auto-fix/*`** (6 files) - Self-healing system?
4. **`server/condition-monitoring/*`** (6 files) - Duplicate of db version?
5. **`server/cost-savings-engine/*`** (6 files) - Feature enabled?
6. **`server/domains/crew-extensions/*`** (32 files) - Full DDD domain
7. **`server/domains/crew/*`** (24 files) - Full DDD domain
8. **`server/domains/inventory/*`** (17 files) - Full DDD domain

---

## Prioritized Refactor Recommendations

> **IMPORTANT CAVEAT:** The architect review identified that many "duplications" are actually vestigial code (dead `routes/` alongside active `interfaces/`) rather than true abstractions needed. The knip unused file count (729) is likely inflated due to dynamic imports and barrel exports that static analysis cannot trace.

### Tier 1: INVESTIGATION REQUIRED (Do First)

#### 1.1 Work Orders Interface/Route Audit

**Status:** ✅ COMPLETED (2026-01-05)  
**Lines Removed:** 822  
**Risk:** Verified safe

**Resolution:**

- Confirmed `server/domains/work-orders/index.ts` exports from `./interfaces` only
- `diff` showed routes/ and interfaces/ were 100% identical (byte-for-byte)
- Deleted `server/domains/work-orders/routes/` directory
- App restarted successfully, all 42 domain modules loaded

#### 1.2 Logbook Types Audit

**Status:** ✅ COMPLETED (2026-01-05)  
**Lines Saved:** ~52  
**Risk:** Verified safe

**Resolution:**

- `deck-log/types.ts` and `engine-log/types.ts` duplicated `SignData`, `LockData`, `*LogFilters`, `*LogComplete`
- Consolidated child types to re-export from parent `logbook/types.ts`
- Import paths preserved for backward compatibility
- App restarted successfully, logbook routes (deck: 25, engine: 35) confirmed working

### Tier 2: Knip False Positive Investigation

#### 2.1 Validate "Unused" Domain Modules

**Status:** ✅ COMPLETED (2026-01-05) - CONFIRMED FALSE POSITIVES  
**Issue:** Knip flagged 729 files as unused including entire DDD domains (crew, crew-extensions, inventory, alerts).

**Resolution:**

- Traced registration via `server/routes/domain-router-registry.ts`
- Domains are registered using **dynamic imports with string paths** that static analysis cannot trace:
  ```typescript
  { name: "CrewExtensions", importPath: "../domains/crew-extensions/index.js", functionName: "registerCrewExtensionsRoutes" }
  ```
- Verified alerts domain is imported by `purchasing/email-templates.ts`, `service-orders/email-templates.ts`, and `services/email-notification/crew-notifications.ts`
- **Conclusion:** 729 "unused" files are nearly all false positives due to:
  1. Dynamic import registry pattern
  2. Barrel exports (`export * from`)
  3. Runtime registration via function calls

### Tier 3: Completed Low-Risk Consolidations

#### 3.1 API Response Helpers

**Status:** ✅ COMPLETED (2026-01-05)  
**Lines Added:** ~150 (consolidation foundation)  
**Risk:** Low (additive)

**Implementation:** Created `server/lib/api-helpers.ts` with:

- Re-exports from `route-utils.ts` and `tenant-guards.ts`
- Pagination helpers: `parsePagination()`, `paginatedResponse()`
- Validation helpers: `validateBody()`, `validateQuery()`, `validateParams()`
- Response helpers: `sendSuccess()`, `sendBadRequest()`, `sendUnauthorized()`, `sendForbidden()`, `sendConflict()`, `sendServerError()`
- Utility helpers: `requireOrgId()`, `parseIntParam()`, `parseUUID()`, `parseDateRange()`

#### 3.2 Compliance Export Consolidation

**Lines Saved:** ~50  
**Risk:** Low  
**Approach:** `compliance-excel/*.ts` and `compliance-pdf/*.ts` share formatting logic that could be extracted

---

## CI Enforcement Recommendations

### Proposed Thresholds

```json
{
  "threshold": 3,
  "minLines": 15,
  "minTokens": 75
}
```

### GitHub Actions Job (when ready)

```yaml
duplication-check:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm ci
    - run: npx jscpd --threshold 3 --min-lines 15
```

---

## Next Steps

1. **Immediate (Safe):**
   - Review work-orders interface/route duplication
   - Consolidate logbook types
   - Add API response helpers

2. **Short-term (After Investigation):**
   - Audit knip unused files against dynamic imports
   - Remove verified dead code
   - Add duplication CI threshold

3. **Long-term:**
   - Consider route code generation for CRUD endpoints
   - Establish shared component patterns for forms/tables

---

## Appendix: Full jscpd Report

HTML report available at: `reports/jscpd/html/index.html`

## Appendix: Knip Output

Full output saved at: `reports/knip-console.log`
