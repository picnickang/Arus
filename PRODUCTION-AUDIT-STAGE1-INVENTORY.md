# ARUS Production Audit - STAGE 1: Orientation & Inventory

**Generated:** November 23, 2025  
**Auditor:** Replit AI  
**Scope:** Full codebase production-readiness assessment

---

## 📋 Executive Summary

The ARUS application is a complex predictive maintenance and fleet management system with dual-deployment architecture (Cloud PostgreSQL + Vessel SQLite). The codebase is well-structured with modern tooling, but requires hardening in several areas for true production readiness.

**Current Status:** ⚠️ **Production-capable with areas needing hardening**

---

## 1. Framework & Tooling Inventory

### Package Manager & Scripts
**File:** `package.json`

**Key Scripts:**
- `npm run dev` - Development server (tsx server/index.ts)
- `npm run build` - Full build (Vite + esbuild server bundle)
- `npm run build:electron` - Electron desktop app build
- `npm run dist:mac/win/linux` - Platform-specific Electron distributables
- `npm run db:push` - Drizzle schema migration

**Package Manager:** npm (type: "module" - ESM-only)

**Critical Dependencies:**
- Express (backend framework)
- Vite + React 18 (frontend)
- Drizzle ORM (database layer)
- @libsql/client (Turso/SQLite support)
- @neondatabase/serverless (PostgreSQL support)
- Electron (desktop app framework)
- TensorFlow.js, XGBoost (ML/AI predictive maintenance)

### Build Configurations

**Vite Configs:**
1. `vite.config.ts` - Main frontend build
   - Output: `dist/public/`
   - Production optimization enabled
   - React + TypeScript

2. `vite.config.electron.ts` - Electron variant
   - Electron-specific optimizations
   - Node integration handling

3. `electron.vite.config.ts` - Electron main process build
   - TypeScript compilation to `dist-electron/main.cjs`
   - Preload script bundling

**Server Build:**
- esbuild bundler
- Input: `server/index.ts`
- Output: `server/index.js` (ESM) + `dist/index.js` (production)
- Platform: node
- Format: ESM
- External packages (not bundled)

**TypeScript:** Multiple tsconfig.json files (project-wide + per-package)

### Electron Entry Points

**Main Process:**
- **File:** `electron/main.ts` (builds to `dist-electron/main.cjs`)
- **Key Features:**
  - Dynamic port allocation (5000-5003 fallback)
  - ELECTRON_RUN_AS_NODE for production (no system Node.js dependency)
  - Process tree cleanup (prevents orphan processes)
  - Single-instance lock
  - Window resilience with retry logic
  - Embedded server lifecycle management

**Preload Script:**
- **File:** `electron/preload.ts`
- Purpose: IPC bridge + contextBridge security

**Development Mode:**
- Spawns: `node server/index-wrapper.js`
- Working directory: Project root
- Environment: `EMBEDDED_MODE=true, LOCAL_MODE=true`

**Production Mode:**
- Spawns: Electron binary with `ELECTRON_RUN_AS_NODE=1`
- Server path: `process.resourcesPath/app.asar.unpacked/server/index-wrapper.js`
- asarUnpack: `server/`, `shared/` directories unpacked from ASAR

---

## 2. Backend Architecture

### Express Server Entry
**File:** `server/index.ts` (854 lines)

**Bootstrap Sequence:**
1. Suppress TensorFlow warnings (env var)
2. Global uncaught error handlers (embedded-mode aware)
3. Module imports (health checks, lazy for optional services)
4. Environment validation (DATABASE_URL, SESSION_SECRET, etc.)
5. Express app setup (middleware, security, CORS)
6. Database initialization (PostgreSQL OR SQLite based on mode)
7. Route registration via `registerRoutes()`
8. Background jobs initialization (conditionally)
9. Schedulers setup (insights, predictive maintenance, ML retraining, cleanup)
10. Vite dev server integration (development only)
11. Static file serving + SPA fallback
12. Server listening on port 5000 (or dynamic in Electron)

**Critical Global Handlers:**
```typescript
process.on("uncaughtException", ...)  // Embedded-mode aware
process.on("unhandledRejection", ...) // Logs but doesn't exit in embedded mode
```

### Route Registration
**File:** `server/routes.ts` (20,198 lines - MASSIVE!)

**Primary Route Registration Function:** `registerRoutes(app: Express, server: Server)`

**Rate Limiting:**
- Telemetry: 600 req/min (10/sec) per IP
- General API: Configured with express-rate-limit
- IP-based key generation

**Security Middleware (Applied Globally):**
- Helmet CSP
- CORS (wildcard origin support for dev)
- Additional security headers
- Request data sanitization
- Attack pattern detection

**Route Organization:** Domain-driven structure under `server/domains/`:
- `devices/routes.ts`
- `equipment/routes.ts`
- `vessels/routes.ts`
- `work-orders/routes.ts`
- `inventory/routes.ts`
- `crew/routes.ts`
- `maintenance/routes.ts`

**Special Routers:**
- `beast-mode-routes.ts` - Advanced features
- `ml-routes.ts` - Machine learning endpoints
- `governance/routes.ts` - Compliance + audit
- `sensor-routes.ts` (mountSensorRoutes)
- `routes/kb-routes.ts` - Knowledge base
- `sensorBundles` and `sensorTemplates` routers

### Middleware Pipeline

**Authentication & Tenant Isolation:**
**File:** `server/middleware/auth.ts` (409 lines)

**Key Middleware:**
1. `requireOrgId` - CRITICAL tenant isolation
   - Validates `x-org-id` header
   - Format: alphanumeric + hyphens, 3-128 chars
   - Development mode: Bypasses auth if valid org-id present
   - Production mode: Requires authenticated user + org membership
   - Forbidden IDs: `default-org-id`, `test-org-id`, `placeholder-org-id`
   - Logs violations and blocks cross-tenant access

**Interface:**
```typescript
export interface AuthenticatedRequest extends Request {
  orgId: string;
  user?: {
    id: string;
    orgId: string;
    email: string;
    role: string;
    name?: string;
    isActive: boolean;
  };
}
```

**Exempt Paths (No Auth Required):**
- `/api/healthz`
- `/api/readyz`
- `/api/health`
- `/api/metrics`
- `/api/admin/auth/verify`

**Other Middleware:**
- `apiReadyGate` - Prevents requests before initialization complete
- `requireAdminAuth` - Admin-only endpoints
- `auditAdminAction` - Admin action logging
- `validateOrgIdHeader` - Org ID format validation
- `sanitizeRequestData` - Input sanitization
- `detectAttackPatterns` - Security threat detection
- `metricsMiddleware` - Prometheus-style metrics

### Background Jobs & Schedulers

**Job Processors:**
**File:** `server/job-processors.ts`, `server/background-jobs.ts`

**Services Running in Background:**
1. **Connection Pool Health Checks**
   - ISSUE: Calls `db.execute()` which requires libSQL client
   - GUARDS NEEDED: Should only run in CLOUD mode with libSQL available

2. **Update Scheduler**
   - Queries `update_settings` table
   - ISSUE: Table may not exist in SQLite/vessel mode
   - GUARDS NEEDED: Should only run in CLOUD mode

3. **Telemetry Pruning Service**
   - Large-scale data cleanup for PostgreSQL
   - Should only run with TimescaleDB features

4. **Sync Manager** (`server/sync-manager.ts`)
   - Vessel → Cloud synchronization
   - Uses MQTT reliable sync
   - Should only run in CLOUD mode to receive vessel data

5. **Materialized View Scheduler**
   - PostgreSQL-specific feature
   - Should only run in CLOUD mode

6. **ML Retraining Service**
   - Cron-based model retraining
   - Can run in both modes (uses available data)

7. **Insights Scheduler**
   - Computes fleet insights
   - Can run in both modes

8. **Predictive Maintenance Scheduler**
   - RUL calculations
   - Can run in both modes

**Schedulers Location:**
- `server/insights-scheduler.ts`
- `server/optimization-cleanup-scheduler.ts`
- `server/materialized-view-scheduler.ts`
- `server/telemetry-pruning-service.ts`
- `server/vessel-scheduler.ts`

---

## 3. Database & Storage Architecture

### Deployment Mode Configuration

**EXCELLENT IMPLEMENTATION ✅**

**File:** `server/config/runtimeEnv.ts` (208 lines)

**Deployment Mode Detection:**
```typescript
export const isLocalMode = 
  process.env.LOCAL_MODE === "true" || 
  process.env.EMBEDDED_MODE === "true" ||
  process.env.DEPLOYMENT_MODE === "VESSEL";

export const isVesselMode = 
  process.env.DEPLOYMENT_MODE === "VESSEL" ||
  process.env.EMBEDDED_MODE === "true";

export const isCloudMode = !isLocalMode;

export const deploymentMode: "VESSEL" | "CLOUD" = isVesselMode ? "VESSEL" : "CLOUD";
```

**Database Availability Flags:**
```typescript
export const canUseCloudDb = !!(
  process.env.DATABASE_URL || 
  process.env.TURSO_DB_URL ||
  process.env.NEON_DATABASE_URL
);

export const canUseEmbeddedDb = isLocalMode || !canUseCloudDb;
export const hasPostgresFeatures = canUseCloudDb && isCloudMode;
export const hasLibSQLFeatures = !!(process.env.TURSO_DB_URL && process.env.TURSO_AUTH_TOKEN);
```

**Feature Flags:**
- `cloudOnlyFeatures` - Connection pool health, TimescaleDB, materialized views, sync manager
- `vesselOnlyFeatures` - Offline buffering, local MQTT, sync conflict resolution
- `sharedFeatures` - Equipment monitoring, maintenance, WebSocket, AI insights

**Guard Functions:**
- `requireCloudMode(operation)` - Throws if not in cloud mode
- `requirePostgres(operation)` - Throws if PostgreSQL not available
- `requireLibSQL(operation)` - Throws if libSQL not available
- `canUseCloudFeature(featureName)` - Returns boolean, no throw

**CRITICAL: Module is PURE** - No side effects, only reads process.env

### Database Initialization

**File:** `server/db-config.ts` (285 lines)

**Initialization Order:**
1. Auto-fallback logic (EMBEDDED_MODE + no DATABASE_URL → LOCAL_MODE=true)
2. Dynamic import of `runtimeEnv.ts` (ensures fallback runs first)
3. Export `isLocalMode` and `deploymentMode` for backward compatibility

**Cloud Mode (PostgreSQL):**
- Neon Pool with WebSocket support
- Connection pool: max 20, idle timeout 60s
- Drizzle ORM with query logging (dev mode)
- Schema: `@shared/schema-runtime`

**Vessel Mode (SQLite):**
- libSQL client (local file OR Turso sync)
- Database path: `data/vessel-local.db`
- Optional Turso sync if TURSO_SYNC_URL + TURSO_AUTH_TOKEN set
- Schema: `@shared/schema-sqlite-vessel` (vessel-specific)
- Also has: `@shared/schema-sqlite-sync` (sync tables)

**Exports:**
```typescript
export const db = cloudDatabase || localDatabase || null;
export const isLocalMode: boolean;
export const deploymentMode: "VESSEL" | "CLOUD";
```

**ISSUE FOUND:** Some code still calls `db.execute()` assuming libSQL client, but in PostgreSQL mode this doesn't exist.

### Schema Definitions

**Schema Files:**
1. `shared/schema.ts` - Main PostgreSQL schema (173 tables)
2. `shared/schema-runtime.ts` - Dual-mode runtime schema with guards
3. `shared/schema-sqlite-vessel.ts` - Vessel-specific SQLite schema
4. `shared/schema-sqlite-sync.ts` - Sync coordination tables
5. `shared/telemetry-schema.ts` - Telemetry-specific types
6. `shared/search.ts` - Search types
7. `shared/sync-conflicts-schema.ts` - Conflict resolution

**Key Tables (Domain Objects):**
- `equipment` - Marine equipment registry
- `equipmentTelemetry` - Time-series sensor data
- `maintenanceSchedules` - Planned maintenance
- `workOrders` - Maintenance work orders
- `alerts` - Equipment alerts
- `vessels` - Fleet vessels
- `organizations` - Multi-tenant orgs
- `users` - User accounts
- `crew` - Crew members
- `inventoryParts` - Spare parts inventory
- `update_settings` - Software update configuration (CLOUD ONLY?)
- `ml_models` - Trained ML models
- `insight_snapshots` - Fleet insights
- `operating_condition_alerts` - Condition monitoring

**Tenant Isolation Columns:**
- `orgId` - Present on almost all tables
- `vesselId` - Present on vessel-specific data

**SQLite Compatibility:**
- PostgreSQL schema uses `jsonb`, `.array()`, `serial` types
- SQLite schema uses `text()` for JSON storage, `integer` for auto-increment
- **Separate schemas maintained for compatibility**

### Storage Layer

**File:** `server/storage.ts`

**Pattern:** Repository/service abstraction layer

**Key Repositories:**
- Equipment repository
- Vessel repository
- Work order repository
- Inventory repository
- Maintenance schedule repository

**Dual-Write Pattern:**
- Logs indicate `[DualWrite:equipment]` entries
- Likely writes to both local + cloud DB in some deployment scenarios
- Consistency checks performed

---

## 4. Frontend Architecture

### React Application Root

**File:** `client/src/App.tsx` (264 lines)

**Application Structure:**
```typescript
<ErrorBoundary>
  <QueryClientProvider>
    <ThemeProvider>
      <TooltipProvider>
        <FocusModeProvider>
          <AdminAccessProvider>
            <OrganizationProvider>
              <Router />
            </OrganizationProvider>
          </AdminAccessProvider>
        </FocusModeProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
</ErrorBoundary>
```

**Key Providers:**
- QueryClient (React Query) - Server state management
- ThemeProvider - Dark/light mode
- OrganizationProvider - Multi-tenant org context
- AdminAccessProvider - Admin mode state
- FocusModeProvider - UI state management

**Routing:** Wouter (lightweight React Router alternative)

**Lazy Loading:** All routes except Dashboard are lazy-loaded for performance

**Real-time Sync:** `useRealtimeSync()` hook enables WebSocket synchronization

**Mobile Support:**
- `useIsMobile()` hook
- Conditional Sidebar (desktop) vs BottomNavigation (mobile)
- Mobile-optimized containers

**PWA Support:**
- `<PWAInstallPrompt />` component
- Service worker registration (dev mode skipped)

### API Client

**File:** `client/src/lib/queryClient.ts` (197 lines)

**HTTP Client:** Native `fetch` API with custom wrapper

**Request Flow:**
1. Automatic header injection:
   - `x-org-id` - From `getCurrentOrgId()` (OrganizationContext)
   - `X-Device-Id` - From `getCurrentDeviceId()` (for Hub & Sync)
   - `Content-Type: application/json` (for mutations)
2. Credentials: `include` (cookies)
3. Error handling: Status code + JSON error parsing
4. Zod validation error formatting

**Base URL Logic:**
- ❌ NOT FOUND in queryClient.ts - Likely uses relative URLs
- Electron mode: Should use `http://localhost:{dynamicPort}`
- Browser dev: Likely `http://localhost:5000` or Vite proxy
- Production cloud: HTTPS domain

**ISSUE:** No explicit base URL configuration - may cause issues in Electron with dynamic ports

**React Query Configuration:**
```typescript
{
  refetchInterval: false, // Manual polling per query
  refetchOnWindowFocus: false,
  staleTime: 5 minutes (default),
  retry: 1,
}
```

**Cache Times:**
- REALTIME: 30s (telemetry)
- MODERATE: 5min (devices, work orders)
- STABLE: 60min (vessels, equipment)
- EXPENSIVE: 24hr (AI insights, reports)

**Helper Functions:**
- `apiRequest(method, url, data)` - Mutations
- `getQueryFn({ on401 })` - Query function factory
- `optimisticUpdate()` - Optimistic UI updates
- `rollbackUpdate()` - Rollback on error

### Organization Context

**File:** `client/src/contexts/OrganizationContext.tsx`

**Key Functions:**
- `getCurrentOrgId()` - Returns current org ID (used by queryClient)
- `useOrganization()` - Hook for org context
- Fallback org: `"default-org-id"` in development/embedded mode

**CRITICAL:** All API requests include `x-org-id` header automatically

---

## 5. Electron Integration Summary

### Development Mode Flow
1. Electron main process starts
2. Spawns: `node server/index-wrapper.js`
3. Server starts with `EMBEDDED_MODE=true, LOCAL_MODE=true, PORT={dynamic}`
4. Polls `/livez` endpoint until healthy
5. Loads `http://localhost:{port}` in BrowserWindow

### Production Mode Flow
1. Electron main process starts
2. Spawns: Electron binary with `ELECTRON_RUN_AS_NODE=1`
3. Server location: `app.asar.unpacked/server/index-wrapper.js`
4. Same health check + window loading logic

### Critical Electron Features
- ✅ Dynamic port allocation (no hardcoded 5000)
- ✅ Process tree cleanup (SIGTERM → SIGKILL fallback)
- ✅ Single-instance lock
- ✅ Window retry logic on load failure
- ✅ User-facing error dialogs
- ✅ No system Node.js dependency (ELECTRON_RUN_AS_NODE)

### Electron Security
- Preload script with contextBridge
- nodeIntegration: false (assumed - should verify)
- contextIsolation: true (assumed - should verify)

---

## 6. Summary of Where Critical Decisions Are Made

### Deployment Mode Determination
**Single source of truth:** `server/config/runtimeEnv.ts`
- Read by: `server/db-config.ts` (after auto-fallback)
- Used by: All services that need mode awareness

### Database Initialization
**File:** `server/db-config.ts`
- Auto-fallback: EMBEDDED_MODE + no DATABASE_URL → LOCAL_MODE
- Initializes: PostgreSQL Pool OR SQLite client
- Exports: `db`, `isLocalMode`, `deploymentMode`

### Tenant/Vessel Isolation Enforcement
**Primary middleware:** `server/middleware/auth.ts::requireOrgId`
- Validates: `x-org-id` header
- Used on: Most `/api/*` routes
- Development bypass: Available for testing

**Frontend injection:** `client/src/lib/queryClient.ts::createHeaders`
- Reads: `getCurrentOrgId()` from OrganizationContext
- Attaches: `x-org-id` to all requests automatically

### Background Jobs Configuration
**Files:** `server/job-processors.ts`, scheduler files
- **ISSUE:** Not all jobs check deployment mode before starting
- **NEEDED:** Guards using `cloudOnlyFeatures` flags from runtimeEnv

### Frontend Base URL
**ISSUE:** No explicit configuration found
- Likely uses: Relative URLs (works in browser, might fail in Electron)
- **NEEDED:** Dynamic base URL based on:
  - Electron: `http://localhost:{serverPort}` from IPC
  - Dev browser: Vite proxy or localhost:5000
  - Production: HTTPS domain

---

## 🔍 Critical Findings - Issues Requiring Attention

### HIGH PRIORITY

1. **❌ Background Jobs Missing Mode Guards**
   - Connection pool health checks call `db.execute()` in all modes
   - Update scheduler queries tables that don't exist in SQLite
   - Telemetry pruning assumes PostgreSQL features
   - **Impact:** Crashes in vessel/embedded mode

2. **❌ Frontend Base URL Not Configured**
   - No explicit base URL in queryClient
   - Electron uses dynamic port - frontend must know it
   - **Impact:** API requests fail in Electron production

3. **⚠️ Rate Limiting May Be Too Aggressive**
   - Dashboard polls multiple endpoints
   - Rate limits may cause 429 errors
   - **Impact:** UX degradation, spinning loaders

4. **⚠️ Development Mode Auth Bypass**
   - `requireOrgId` bypasses auth in development if org-id header present
   - **Impact:** Security risk if deployed with NODE_ENV=development

### MEDIUM PRIORITY

5. **⚠️ Dual Database Client Usage**
   - Some code assumes `db.execute()` (libSQL method)
   - PostgreSQL client doesn't have this method
   - **Impact:** Runtime errors in cloud mode with PostgreSQL

6. **⚠️ Update Settings Table**
   - Queried by update scheduler
   - May not exist in SQLite schema
   - **Impact:** Query failures in vessel mode

7. **⚠️ Session Secret Handling**
   - Auto-generated in embedded mode (good)
   - Warns about defaults in production (good)
   - **Verify:** Production deployments have strong SESSION_SECRET

### LOW PRIORITY

8. **ℹ️ Large routes.ts File**
   - 20,198 lines - difficult to maintain
   - **Recommendation:** Split into domain-specific route files

9. **ℹ️ Schema Duplication**
   - Three schema files (PostgreSQL, SQLite vessel, SQLite sync)
   - **Recommendation:** Consider schema generation tools

---

## ✅ What's Working Well

1. **Excellent Deployment Mode Architecture**
   - Clean separation via `runtimeEnv.ts`
   - Feature flags for conditional services
   - Guard functions for safety

2. **Solid Tenant Isolation**
   - `requireOrgId` middleware properly validates
   - Automatic header injection in frontend
   - Development fallbacks for testing

3. **Robust Error Handling**
   - Uncaught exception handlers
   - Embedded-mode aware (doesn't crash app)
   - Detailed logging

4. **Modern Frontend Stack**
   - React Query for server state
   - Lazy loading for performance
   - PWA support
   - Mobile-responsive design

5. **Electron Production Hardening**
   - Dynamic port allocation
   - No system Node.js dependency
   - Process cleanup
   - User-friendly error dialogs

6. **Comprehensive Feature Set**
   - Equipment monitoring
   - Predictive maintenance
   - ML/AI capabilities
   - Fleet management
   - Crew scheduling
   - Inventory management

---

## 📊 Codebase Statistics

**Backend:**
- Main server file: 854 lines
- Routes file: 20,198 lines (❗ needs refactoring)
- Config/middleware: ~100-400 lines per file
- Total server files: ~150+ files

**Frontend:**
- Main App: 264 lines
- Pages: Lazy-loaded (20+ pages)
- Components: Extensive shadcn/ui usage

**Schemas:**
- PostgreSQL: 173 tables
- SQLite vessel: Separate schema maintained
- Zod validation: Generated from Drizzle schemas

**Database:**
- PostgreSQL (Neon): Max 450 connections supported, using 20
- SQLite (libSQL): Local file with optional Turso sync

---

## 🎯 Next Steps (STAGE 2-7)

**STAGE 2:** Fix deployment mode guards in background jobs  
**STAGE 3:** Review and fix database schema compatibility issues  
**STAGE 4:** Audit and harden tenant isolation and rate limiting  
**STAGE 5:** Enhance error handling and health endpoints  
**STAGE 6:** Fix frontend base URL configuration for Electron  
**STAGE 7:** Verify and test Electron dev/build process  

---

**End of Stage 1 Inventory**
