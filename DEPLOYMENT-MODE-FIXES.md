# ARUS Deployment Mode Hardening - Implementation Guide

**Status:** 🟡 In Progress - Core infrastructure complete, final fixes pending  
**Created:** November 23, 2025  
**Architect Approved:** Pending final review

---

## Executive Summary

This guide documents the systematic hardening of ARUS for dual-deployment modes:
- **CLOUD mode**: PostgreSQL/libSQL with TimescaleDB on Neon/Render
- **VESSEL mode**: SQLite (libSQL/Turso) with offline-first architecture on Electron desktop

---

## ✅ Completed Work

### 1. Centralized Runtime Environment Config (`server/config/runtimeEnv.ts`)

**Purpose:** Single source of truth for deployment mode detection and feature flags.

**Exports:**
```typescript
// Deployment Mode Detection
export const isLocalMode: boolean
export const isVesselMode: boolean  
export const isCloudMode: boolean
export const deploymentMode: "VESSEL" | "CLOUD"

// Database Availability
export const canUseCloudDb: boolean
export const canUseEmbeddedDb: boolean
export const hasPostgresFeatures: boolean
export const hasLibSQLFeatures: boolean

// Feature Flags
export const cloudOnlyFeatures: { ... }
export const vesselOnlyFeatures: { ... }
export const sharedFeatures: { ... }

// Guard Functions
export function requireCloudMode(operation: string): void
export function requirePostgres(operation: string): void
export function requireLibSQL(operation: string): void
```

**Usage:**
```typescript
import { isVesselMode, hasPostgresFeatures } from "./config/runtimeEnv";

// Skip cloud-only operations in vessel mode
if (isVesselMode || !hasPostgresFeatures) {
  console.log("ℹ️  TimescaleDB operations skipped in SQLite mode");
  return;
}
```

---

### 2. Safe SQL Execution Helper (`server/utils/safeSql.ts`)

**Purpose:** Mode-aware SQL execution that works in both cloud and vessel modes.

**API:**
```typescript
// Execute SQL with automatic fallback
await safeSql(db, sql`SELECT * FROM equipment`, {
  skipInVesselMode: true,  // Skip entirely in vessel mode
  skipMessage: "Operation requires PostgreSQL"
});

// Execute raw SQL (PostgreSQL-only, skips in SQLite)
await safeRawSql(db, "SET LOCAL app.current_org_id = 'org-123'");

// Check if raw SQL execution available
if (canExecuteRawSql()) {
  // Cloud-specific logic
}
```

**Behavior:**
- **Cloud mode**: Uses `db.execute()` (libSQL/PostgreSQL)
- **Vessel mode with skip**: Returns empty result, logs message
- **Vessel mode without skip**: Falls back to `db.all()` or `db.get()` (SQLite)

---

### 3. Fixed Critical Files

#### Fixed with Module-Level Guards (Cloud-Only)
These files skip all operations in VESSEL/SQLite mode:

| File | Strategy | Status |
|------|----------|--------|
| `server/timescaledb-bootstrap.ts` | Early return if `isVesselMode \|\| !hasPostgresFeatures` | ✅ Complete |
| `server/timescaledb-optimization.ts` | Guard in `enableCompressionPolicy()` | ✅ Complete |
| `server/timescaledb-config.ts` | Guard in `getHypertableInfo()` | ✅ Complete |

#### Fixed with safeSql Helper (Dual-Mode)
These files work in both modes with appropriate fallbacks:

| File | Strategy | Status |
|------|----------|--------|
| `server/observability.ts` | Replaced `db.execute()` with `safeSql()` in health check | ✅ Complete |

---

### 4. SQLite Schema Updates

**Added missing table:** `updateSettingsSqlite` in `shared/schema-sqlite-vessel.ts`
- Maps PostgreSQL `update_settings` table to SQLite
- Enables update scheduler queries in vessel mode
- Updated `schema-runtime.ts` to export both versions

---

### 5. Verification Script (`scripts/arus-verify-fix.mjs`)

**Checks:**
1. ✅ All schema imports use `@shared/schema-runtime`
2. ✅ No PostgreSQL-only UUIDs in application code (schema files exempt)
3. ✅ `update_settings` table exists in SQLite schema
4. 🟡 db.execute() usage still detected (expected - many files pending)

**Run:** `node scripts/arus-verify-fix.mjs`

---

## 🟡 Remaining Work

### Files Still Using `db.execute()` (16 cloud-only + 4 dual-mode)

#### Cloud-Only Files (Skip Entirely in Vessel Mode)
Apply module-level guards using `isVesselMode || !hasPostgresFeatures`:

```typescript
import { isVesselMode, hasPostgresFeatures } from "./config/runtimeEnv";

export async function myCloudFunction() {
  // Skip in vessel mode
  if (isVesselMode || !hasPostgresFeatures) {
    console.log("ℹ️  Cloud-only operation skipped in SQLite mode");
    return { success: true, skipped: true };
  }
  
  // Cloud operations...
  await db.execute(sql`...`);
}
```

**Files:**
- `server/backup-recovery.ts` - PostgreSQL pg_dump/restore
- `server/db-backup.ts` - Backup automation
- `server/db-indexes.ts` - Index management
- `server/db-performance.ts` - Performance monitoring
- `server/materialized-view-scheduler.ts` - View refresh scheduling
- `server/schema-views.ts` - Database view creation
- `server/vector-index-service.ts` - pgvector operations
- `server/services/patch-applicator.ts` - Software patching
- `server/tests/setup/test-db.ts` - Test database setup

#### Dual-Mode Files (Use safeSql Helper)
Replace `db.execute()` with `safeSql()`:

```typescript
import { safeSql } from "./utils/safeSql";

// Before
const result = await db.execute(sql`SELECT * FROM equipment`);

// After
const result = await safeSql(db, sql`SELECT * FROM equipment`);
```

**Files:**
- `server/storage.ts` - Line 12315 (parts inventory query)
- `server/repos/sequenceRepo.ts` - Sequence generation
- `server/rul-engine.ts` - Remaining Useful Life calculations
- `server/telemetry-pruning-service.ts` - Data cleanup

#### Already Guarded (Verify Only)
These files likely already have guards, verify and confirm:

- `server/middleware/db-context.ts` - Already has `isLocalMode` checks ✅

---

## 🎯 Implementation Patterns

### Pattern 1: Module-Level Guard (Cloud-Only)

```typescript
import { isVesselMode, hasPostgresFeatures } from "./config/runtimeEnv";

export async function bootstrapFeature(): Promise<Result> {
  // Early return for vessel mode
  if (isVesselMode || !hasPostgresFeatures) {
    console.log("ℹ️  Feature skipped (SQLite/VESSEL mode)");
    return {
      success: true,
      steps: [],
      skipped: ["Feature not available in SQLite/VESSEL mode"],
    };
  }

  // Cloud-only logic
  await db.execute(sql`CREATE EXTENSION ...`);
  // ... rest of function
}
```

### Pattern 2: safeSql Helper (Dual-Mode)

```typescript
import { safeSql } from "./utils/safeSql";
import { sql } from "drizzle-orm";

// Health check (works in both modes)
await safeSql(db, sql`SELECT 1 as health_check`);

// Cloud-only query (skip in vessel mode)
await safeSql(db, sql`SELECT * FROM timescaledb_information.hypertables`, {
  skipInVesselMode: true,
  skipMessage: "TimescaleDB query requires PostgreSQL"
});
```

### Pattern 3: Conditional Logic

```typescript
import { canExecuteRawSql } from "./utils/safeSql";

if (canExecuteRawSql()) {
  // Cloud path: use PostgreSQL-specific SQL
  await db.execute(sql`SET LOCAL ...`);
} else {
  // Vessel path: use Drizzle ORM queries
  // (row-level security not available in SQLite)
}
```

---

## 📋 Next Steps

### Step 1: Apply Fixes to Remaining Files (60-90 min)

**Cloud-Only Files (use Pattern 1):**
1. Add import: `import { isVesselMode, hasPostgresFeatures } from "./config/runtimeEnv";`
2. Add guard at function start: `if (isVesselMode || !hasPostgresFeatures) { return {...}; }`
3. Test: Verify function returns early in vessel mode

**Dual-Mode Files (use Pattern 2):**
1. Add import: `import { safeSql } from "./utils/safeSql";`
2. Replace: `db.execute(sql\`...\`)` → `safeSql(db, sql\`...\`)`
3. Test: Verify query works in both modes

### Step 2: Run Verification Script

```bash
node scripts/arus-verify-fix.mjs
```

**Expected Output:** All checks passing (🎉)

### Step 3: Test in Both Modes

**Cloud Mode (Replit PostgreSQL):**
```bash
# Already running - verify no regressions
npm run dev
```

**Vessel Mode (Local SQLite):**
```bash
export LOCAL_MODE=true
export EMBEDDED_MODE=true
rm -rf data/  # Start with fresh database
npm run dev
```

**Verify:**
- ✅ Application starts without errors
- ✅ No `db.execute is not a function` errors
- ✅ No `SQLITE_ERROR` messages
- ✅ All API endpoints return 200

### Step 4: Final Architect Review

Call architect tool with:
- All modified files
- Full git diff
- Test results from both modes

---

## 📊 Progress Tracking

| Component | Status | Notes |
|-----------|--------|-------|
| Runtime environment config | ✅ Complete | `server/config/runtimeEnv.ts` |
| safeSql helper | ✅ Complete | `server/utils/safeSql.ts` |
| Verification script | ✅ Complete | `scripts/arus-verify-fix.mjs` |
| SQLite schema updates | ✅ Complete | `update_settings` table added |
| Critical files fixed | ✅ Complete | observability, timescaledb-* |
| Cloud-only files | 🟡 9/9 pending | See list above |
| Dual-mode files | 🟡 4/4 pending | See list above |
| Testing in both modes | ⏳ Pending | After all fixes |
| Final architect review | ⏳ Pending | After testing |

---

## 🔍 Testing Checklist

### Cloud Mode (PostgreSQL)
- [ ] Application starts successfully
- [ ] Health check endpoint returns 200
- [ ] TimescaleDB optimizations run without errors
- [ ] Materialized views refresh correctly
- [ ] All API endpoints functional

### Vessel Mode (SQLite)
- [ ] Application starts successfully
- [ ] No `db.execute is not a function` errors
- [ ] Health check endpoint returns 200
- [ ] Equipment and telemetry APIs work
- [ ] Cloud-only features skip gracefully with log messages

---

## 📚 Reference

### Environment Variables

**Cloud Mode:**
- `DATABASE_URL` or `TURSO_DB_URL` - Cloud database connection
- `TURSO_AUTH_TOKEN` - (if using libSQL/Turso)

**Vessel Mode:**
- `LOCAL_MODE=true` - Enable local/embedded mode
- `EMBEDDED_MODE=true` - Enable vessel-specific features
- `DEPLOYMENT_MODE=VESSEL` - Explicit vessel mode

### Key Concepts

**db.execute()** - libSQL/Turso-specific method for raw SQL execution
- Available in: Cloud mode with libSQL client
- NOT available in: Vessel mode with basic SQLite

**safeSql()** - Mode-aware wrapper that handles both modes
- Cloud: Uses `db.execute()`
- Vessel: Uses `db.all()` or `db.get()` (Drizzle ORM methods)

**Mode Detection** - Based on environment variables
- `isVesselMode` - True if `DEPLOYMENT_MODE=VESSEL` or `EMBEDDED_MODE=true`
- `hasLibSQLFeatures` - True if libSQL client available (Turso)
- `hasPostgresFeatures` - True if PostgreSQL database available

---

## 🎓 Lessons Learned

1. **Don't use raw db.execute() directly** - Always use safeSql() or guards
2. **Classify modules early** - Cloud-only vs dual-mode determines strategy
3. **PostgreSQL schemas are correct** - `gen_random_uuid()` is valid for PostgreSQL tables
4. **Build outputs don't count** - index.js/index.mjs are generated, skip in verification
5. **Module-level guards are clearest** - For cloud-only modules, fail fast at entry
6. **Verification scripts save time** - Automated checking prevents manual inspection

---

**For Questions:** Review this guide, check `server/config/runtimeEnv.ts` for flags, or examine fixed files as examples.
