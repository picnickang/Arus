# ARUS Architecture Optimization Scan
## Part 1: Architecture Scan Results

**Scan Date:** November 29, 2025  
**Scan Type:** Non-destructive architecture-aware analysis

---

## 1. Project Directory Structure

```
/
├── server/          # Backend Express/TypeScript API (154 root-level .ts files!)
│   ├── services/    # Business logic services
│   ├── routes/      # API route handlers  
│   ├── domains/     # Domain-driven modules (crew, equipment, vessels, work-orders)
│   ├── integrations/ # External system integrations (FMCC, etc.)
│   ├── infrastructure/ # Cross-cutting concerns
│   ├── middleware/  # Express middleware
│   ├── compliance/  # Regulatory compliance logic
│   ├── governance/  # Data governance, lineage
│   ├── scheduler/   # Cron and scheduled jobs
│   ├── ai/          # AI/copilot services
│   └── utils/       # Utility functions
├── client/src/      # React frontend
│   ├── pages/       # 67 page components
│   ├── components/  # UI components (many subdirectories)
│   ├── hooks/       # Custom React hooks
│   ├── lib/         # Client utilities
│   └── contexts/    # React contexts
├── shared/          # Shared types and schemas
├── electron/        # Electron desktop shell
├── tests/           # Test files
├── scripts/         # Build and utility scripts
└── docs/            # Documentation
```

---

## 2. GOD-FILES IDENTIFIED (600+ lines)

### 🔴 CRITICAL (>5000 lines) - Highest Priority
| File | Lines | Risk Level | Notes |
|------|-------|------------|-------|
| `server/storage.ts` | 23,935 | **EXTREME** | All storage operations - unsafe to refactor without full system test |
| `server/routes.ts` | 23,681 | **EXTREME** | All API routes - unsafe to refactor without full system test |
| `shared/schema.ts` | 9,025 | **HIGH** | Database schema - changes break dual-DB sync |

### 🟠 HIGH PRIORITY (1500-5000 lines)
| File | Lines | Risk Level | Notes |
|------|-------|------------|-------|
| `shared/schema-sqlite-vessel.ts` | 3,797 | HIGH | SQLite schema parity |
| `server/sqlite-init.ts` | 3,379 | HIGH | Critical for offline mode |
| `client/src/pages/system-administration.tsx` | 2,205 | MEDIUM | Can be safely split |
| `client/src/components/HoursOfRestGrid.tsx` | 2,031 | MEDIUM | Complex STCW compliance |
| `server/beast-mode-routes.ts` | 1,867 | MEDIUM | Beast mode API |
| `client/src/pages/advanced-analytics.tsx` | 1,861 | MEDIUM | Analytics page |
| `client/src/pages/engine-logbook.tsx` | 1,849 | MEDIUM | Engine log |
| `server/compliance/routes.ts` | 1,846 | MEDIUM | Compliance API |
| `client/src/components/CrewScheduler.tsx` | 1,799 | MEDIUM | Crew scheduling |
| `client/src/pages/deck-logbook.tsx` | 1,601 | MEDIUM | Deck logbook |
| `client/src/pages/optimization-tools.tsx` | 1,563 | MEDIUM | Optimization tools |

### 🟡 MEDIUM PRIORITY (1000-1500 lines)
| File | Lines | Risk Level | Notes |
|------|-------|------------|-------|
| `client/src/components/equipment/EquipmentViewDialog.tsx` | 1,470 | MEDIUM | Equipment dialog |
| `server/ml-prediction-service.ts` | 1,398 | HIGH | ML pipeline - careful! |
| `server/enhanced-trends.ts` | 1,360 | MEDIUM | Trend analysis |
| `client/src/components/UnifiedCrewManagement.tsx` | 1,323 | MEDIUM | Crew management |
| `client/src/pages/ml-training.tsx` | 1,265 | MEDIUM | ML training UI |
| `server/services/data-export-import.ts` | 1,246 | HIGH | Data migration |
| `server/observability.ts` | 1,193 | MEDIUM | Monitoring |
| `server/openai.ts` | 1,143 | MEDIUM | AI integration |
| `server/routes/analytics.ts` | 1,139 | MEDIUM | Analytics routes |
| `server/digital-twin-service.ts` | 1,137 | HIGH | Digital twin |
| `client/src/pages/vessel-management.tsx` | 1,118 | MEDIUM | Vessel UI |
| `client/src/pages/pdm-pack.tsx` | 1,118 | MEDIUM | PDM UI |
| `server/mqtt-reliable-sync.ts` | 1,113 | **CRITICAL** | Sync logic - DO NOT MODIFY |
| `server/rul-engine.ts` | 1,093 | HIGH | RUL predictions |
| `client/src/pages/inventory-management.tsx` | 1,069 | MEDIUM | Inventory UI |
| `server/enhanced-llm.ts` | 1,059 | MEDIUM | LLM integration |
| `server/swagger.ts` | 1,049 | LOW | API docs |
| `server/services/dev-fake-data-service.ts` | 1,038 | LOW | Dev only |
| `client/src/pages/maintenance-schedules.tsx` | 1,018 | MEDIUM | Maintenance UI |

### 🟢 LOWER PRIORITY (600-1000 lines)
- 45+ additional files in the 600-1000 line range
- Many are feature-specific and can be safely modularized

---

## 3. DUPLICATION ANALYSIS

### 3.1 Time/Date Utilities (PARTIAL DUPLICATION)
**Finding:** Two time utility modules with overlapping functionality

| Location | Purpose | Dependencies |
|----------|---------|--------------|
| `server/time-utils.ts` (402 lines) | Backend SGT time handling | Native Intl API |
| `client/src/lib/time-utils.ts` (87 lines) | Frontend SGT formatting | date-fns, date-fns-tz |

**Assessment:** SAFE to keep separate - different dependencies for different runtimes. 
Frontend uses date-fns (browser-optimized), backend uses native Intl API (Node-optimized).

### 3.2 Database Operations
**Finding:** 398 direct `db.select/insert/update/delete` calls across server code

**Recommendation:** Most are appropriate but consider:
- Common query patterns could be extracted to repository layer
- The `TenantScopedRepository` (907 lines) provides good abstraction - use it more

### 3.3 Console Logging
**Finding:** 1500+ console.log/error/warn calls across server code

**Recommendation:** 
- Structured logging is already in `server/logging.ts` and `server/structured-logging.ts`
- Many services still use raw console calls - gradual migration recommended
- NOT a breaking change candidate

### 3.4 Error Handling Patterns
**Finding:** Mixed error handling styles across codebase
- Some use typed error classes
- Some use raw try/catch with console.error
- `server/utils/api-response.ts` provides standardized API responses

**Recommendation:** Standardize on `api-response.ts` utilities for new code

### 3.5 Form Components (Frontend)
**Finding:** 30+ files using zodResolver/useForm/FormField patterns
- Good: Using react-hook-form consistently
- Opportunity: Some form validation logic is repeated

### 3.6 API Data Fetching (Frontend)
**Finding:** 
- 100+ useQuery({ calls
- 60+ useMutation({ calls
- Good: Consistent TanStack Query v5 patterns
- Opportunity: Some queryFn patterns are repeated

---

## 4. LAYERING VIOLATIONS

### 4.1 Direct Storage Access from Routes
**Files affected:** `server/routes.ts` (23,681 lines)
**Issue:** Routes file directly calls storage methods - acceptable given storage layer abstraction
**Verdict:** NOT a violation - storage.ts provides the abstraction layer

### 4.2 Schema Runtime Logic
**Files affected:** `shared/schema-runtime.ts`
**Purpose:** Handles PostgreSQL vs SQLite schema differences at runtime
**Verdict:** Correct architecture for dual-database system

### 4.3 Root-Level Server Files
**Finding:** 154 TypeScript files in `server/` root directory
**Issue:** Flat structure makes navigation difficult
**Recommendation:** Group related files into subdirectories (gradual, non-breaking)

---

## 5. STRUCTURAL RISKS

### 5.1 UNSAFE TO MODIFY (Leave as-is)
| Component | Reason |
|-----------|--------|
| `server/storage.ts` | Core data layer - too many dependencies |
| `server/routes.ts` | All API endpoints - frontend coupling |
| `shared/schema.ts` | Database schema - dual-DB sync |
| `server/mqtt-reliable-sync.ts` | Sync logic - data integrity risk |
| `server/sqlite-init.ts` | Offline mode initialization |
| `server/ml-prediction-service.ts` | ML pipeline stability |
| `server/infrastructure/DualWriteAdapter.ts` | Dual-database consistency |

### 5.2 SAFE TO REFACTOR (Gradual)
| Component | Approach |
|-----------|----------|
| Frontend pages >1500 lines | Split into sub-components |
| UI components | Extract reusable patterns |
| Server services | Extract common utilities |
| `server/beast-mode-routes.ts` | Split into domain routes |
| Analytics routes | Consolidate with analytics.ts |

---

## 6. PERFORMANCE CONCERNS

### 6.1 Backend
- **Telemetry batching:** Already implemented in mqtt-ingestion-service.ts ✅
- **DB caching:** Redis cache enabled for inventory/analytics ✅
- **Rate limiting:** Configured via express-rate-limit ✅
- **Potential issue:** 1034 `new Date()` calls - consider caching in hot paths

### 6.2 Frontend
- **List virtualization:** Already using @tanstack/react-virtual for inventory ✅
- **Query caching:** TanStack Query configured ✅
- **Potential issue:** Some components may benefit from React.memo()

### 6.3 Database
- **Indexes:** `server/db-indexes.ts` manages indexes
- **TimescaleDB:** Configured with fallbacks for Apache license
- **WAL mode:** Configured in SQLite init

---

## 7. RECOMMENDED SAFE OPTIMIZATIONS

### Priority 1: Quick Wins (No Risk)
1. ✅ Extract reusable UI patterns from large page components
2. ✅ Add React.memo() to expensive list item components
3. ✅ Group server/*.ts files into logical subdirectories (cosmetic)

### Priority 2: Medium Effort (Low Risk)
1. ⚠️ Split `beast-mode-routes.ts` into domain-specific route files
2. ⚠️ Extract common form validation patterns to shared utilities
3. ⚠️ Consolidate error handling to use api-response.ts

### Priority 3: Deferred (Requires Testing)
1. ❌ DO NOT refactor storage.ts or routes.ts without full regression suite
2. ❌ DO NOT modify schema.ts without schema parity verification
3. ❌ DO NOT modify sync/MQTT logic

---

## 8. SUMMARY

**Total god-files identified:** 65+  
**Critical (unsafe to modify):** 7  
**Safe for gradual refactor:** 45+  
**Immediate optimization opportunities:** 15+  

**Next Steps:**
1. Address safe frontend component splits
2. Add memoization to expensive components
3. Consider domain-based directory structure for server
4. Leave critical infrastructure files unchanged

---

## Part 2: Deduplication Analysis (SAFE MODE)

### ✅ ALREADY DEDUPLICATED (Good Patterns in Place)

The codebase already has strong deduplication in key areas:

#### Frontend Shared Components
```
client/src/components/shared/
├── Breadcrumb.tsx          # Navigation breadcrumbs
├── CollapsibleSection.tsx  # Collapsible panels
├── ConfirmDialog.tsx       # Confirmation modals
├── EmptyState.tsx          # Empty state displays
├── EquipmentSelector.tsx   # Equipment picker
├── MetricCard.tsx          # Metric displays
├── ResponsiveTable.tsx     # Generic responsive table
├── StatusBadge.tsx         # Status indicators
├── TableSkeleton.tsx       # Loading skeletons
└── VesselSelector.tsx      # Vessel picker
```

#### Frontend UI Patterns
```
client/src/components/patterns/
├── ErrorState.tsx   # Standardized error display (202 lines, well-designed)
├── LoadingState.tsx # Loading indicators
└── index.ts         # Exports
```

#### Backend API Response Utilities
```
server/utils/api-response.ts (430 lines)
- Standardized ApiSuccess/ApiError types
- Comprehensive error codes (ApiErrorCodes)
- Response builders: successResponse(), errorResponse(), paginatedResponse()
- Express helpers: sendSuccess(), sendError(), asyncHandler()
- Field validation: validateRequiredFields()
```

#### Backend Validation
```
server/validation/engine-log-schemas.ts
- validateRequest<T>() - Generic Zod validation
- formatValidationError() - Standardized error formatting
- Domain-specific schemas (engine logs, autofill, etc.)
```

### 🟡 OPPORTUNITIES FOR FURTHER DEDUPLICATION

#### 1. Table Components (LOW PRIORITY)
Five table components share similar patterns:
- `VirtualizedWorkOrderTable.tsx`
- `VirtualizedInventoryTable.tsx`
- `ModelTable.tsx`
- `ResponsiveTable.tsx`
- `EquipmentTable.tsx`

**Assessment:** Each serves a specific domain with custom columns/behavior. 
Consolidation could reduce code but would make components less flexible.
**Recommendation:** Leave as-is; domain-specific tables are appropriate.

#### 2. Form Validation Patterns (MEDIUM PRIORITY)
30+ components use zodResolver + useForm patterns.

**Assessment:** Forms are sufficiently different that a generic wrapper adds complexity.
**Recommendation:** Consider a `useZodForm()` hook that wraps common boilerplate.

#### 3. API Data Fetching (LOW PRIORITY)
100+ useQuery and 60+ useMutation calls.

**Assessment:** TanStack Query is already optimized; adding more abstraction could hurt type safety.
**Recommendation:** Leave as-is; current pattern is idiomatic.

### 🔴 DO NOT DEDUPLICATE (Risk Areas)

| Pattern | Reason |
|---------|--------|
| Time utils (server vs client) | Different runtime dependencies (Intl vs date-fns) |
| Storage methods | Domain-specific, type-safe implementations |
| Route handlers | API contract stability |
| Schema definitions | Dual-database consistency |

---

## Part 3: God-File Refactor Assessment

### Files Safe for Gradual Refactor

#### 1. `client/src/pages/system-administration.tsx` (2,205 lines)
- **Components inside:** Admin sections, user management, system config
- **Recommendation:** Extract tab content into separate components:
  - `SystemAdminUsersTab.tsx`
  - `SystemAdminConfigTab.tsx`
  - `SystemAdminLogsTab.tsx`

#### 2. `client/src/components/HoursOfRestGrid.tsx` (2,031 lines)
- **Complexity:** STCW compliance logic embedded
- **Recommendation:** Extract to:
  - `HoursOfRestGrid.tsx` (main grid)
  - `HoursOfRestCell.tsx` (cell rendering)
  - `HoursOfRestValidation.tsx` (compliance rules)

#### 3. `server/beast-mode-routes.ts` (1,867 lines)
- **Issue:** Many unrelated "beast mode" endpoints
- **Recommendation:** Split by domain:
  - `beast-mode/analytics-routes.ts`
  - `beast-mode/ml-routes.ts`
  - `beast-mode/admin-routes.ts`

### Files Unsafe to Refactor (Leave as-is)

| File | Lines | Risk |
|------|-------|------|
| `server/storage.ts` | 23,935 | All CRUD operations; changes break everything |
| `server/routes.ts` | 23,681 | All API endpoints; frontend coupling |
| `shared/schema.ts` | 9,025 | Database schema; dual-DB sync |
| `server/mqtt-reliable-sync.ts` | 1,113 | Sync integrity |

**Marked with TODO comments instead:**
```typescript
// TODO (safe-refactor): This file is a god-file but refactor is unsafe until:
// - Full regression test suite is in place
// - Dual-database sync is verified
// - API contract stability is confirmed
```

---

## Part 4: Performance Optimization Assessment

### ✅ Already Optimized

| Area | Status | Implementation |
|------|--------|----------------|
| Telemetry batching | ✅ | mqtt-ingestion-service.ts |
| Redis caching | ✅ | Inventory/analytics caching enabled |
| Rate limiting | ✅ | express-rate-limit configured |
| List virtualization | ✅ | @tanstack/react-virtual used |
| Query caching | ✅ | TanStack Query configured |
| DB indexes | ✅ | db-indexes.ts manages indexes |
| WAL mode | ✅ | SQLite WAL configured |

### 🟡 Potential Optimizations

1. **React.memo for list items** - Some list components could benefit
2. **Query deduplication** - Avoid redundant API calls on page load
3. **Lazy loading** - Some heavy pages load all data upfront

---

## Part 5: Multi-Device & Offline Mode Review

### ✅ Properly Implemented

| Area | Status | Notes |
|------|--------|-------|
| MQTT reconnection | ✅ | Exponential backoff in mqtt-reliable-sync.ts |
| SQLite write frequency | ✅ | Batched writes with WAL |
| Dual-write consistency | ✅ | DualWriteAdapter handles sync |
| Conflict resolution | ✅ | conflict-resolution-service.ts |
| Cache invalidation | ✅ | TanStack Query handles this |

### ⚠️ Advisory Notes

- `mqtt-reliable-sync.ts` should NOT be modified without extensive testing
- Sync logic has graceful degradation for offline mode
- TimescaleDB features fallback to standard PostgreSQL on Apache license

---

## Part 6: Final Summary

### Optimizations Performed
1. ✅ Created comprehensive architecture scan document
2. ✅ Identified 65+ god-files with risk levels
3. ✅ Documented existing deduplication patterns
4. ✅ Assessed performance optimizations already in place

### Structural Risks Found
1. **CRITICAL:** `storage.ts` (23,935 lines) and `routes.ts` (23,681 lines) are too large
2. **HIGH:** 154 root-level files in `server/` directory
3. **MEDIUM:** Some frontend pages exceed 1,500 lines

### Recommended Non-Breaking Improvements
1. Extract tab content from `system-administration.tsx`
2. Split `HoursOfRestGrid.tsx` into sub-components
3. Create `server/beast-mode/` subdirectory for beast-mode routes
4. Add `React.memo()` to expensive list item components
5. Group root-level server files into logical subdirectories

### Unsafe to Modify Now
1. `server/storage.ts` - Core data layer
2. `server/routes.ts` - API endpoints  
3. `shared/schema.ts` - Database schema
4. `server/mqtt-reliable-sync.ts` - Sync logic
5. `server/sqlite-init.ts` - Offline initialization
6. `server/ml-prediction-service.ts` - ML pipeline
7. `server/infrastructure/DualWriteAdapter.ts` - Dual-DB sync

---

*Scan completed. This document serves as the architectural audit for safe optimization planning.*
*No destructive code changes were made during this analysis.*
