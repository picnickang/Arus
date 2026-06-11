# Architectural Review: Proposed Replit Repair Prompts

**Review Date:** November 5, 2025  
**Reviewer:** System Architect  
**Scope:** 12 proposed repair/enhancement prompts for ARUS Marine Predictive Maintenance Platform

---

## Executive Summary

**Overall Assessment:** ⚠️ **PROCEED WITH CAUTION - SIGNIFICANT OVERLAP & ARCHITECTURAL CONFLICTS DETECTED**

The proposed prompts contain valuable improvements but exhibit **critical redundancies**, **conflicting architectural patterns**, and **potential data integrity risks**. Implementing all prompts as-is would create technical debt, duplicated code, and schema conflicts.

**Recommendation:** Cherry-pick specific fixes, consolidate overlapping prompts, and defer comprehensive rewrites until architectural alignment is established.

---

## ✅ Alignment & Strengths

### 1. **Valid Bug Fixes Identified**

| Prompt             | Valid Fix                           | Current Impact                              |
| ------------------ | ----------------------------------- | ------------------------------------------- |
| VesselManagement   | Missing `queryClient` import        | ✅ **HIGH** - Query invalidation broken     |
| VesselManagement   | `Table` component imports missing   | ✅ **HIGH** - Runtime errors                |
| VesselIntelligence | Wrong time units (months vs hours)  | ✅ **CRITICAL** - Data accuracy failure     |
| VesselIntelligence | Non-deterministic date sorting      | ✅ **MEDIUM** - Pattern analysis unreliable |
| LP Optimizer       | Wrong parsing of solver output      | ✅ **CRITICAL** - Schedule generation fails |
| LP Optimizer       | Missing per-crew overlap prevention | ✅ **HIGH** - Scheduling conflicts          |
| System Admin       | Uncontrolled `<Select>` warnings    | ✅ **LOW** - UX friction only               |

### 2. **Security Improvements**

- **CSRF Protection**: Adding CSRF tokens to admin mutations (currently missing)
- **Rate Limiting**: Protecting admin endpoints from brute force
- **Multi-Tenant Safety**: Enforcing `orgId` filtering (currently inconsistent)

### 3. **Data Integrity Enhancements**

- **Foreign Keys**: Proper CASCADE relationships (vessels → equipment → telemetry)
- **CHECK Constraints**: Enum validation at DB layer
- **Unique Indexes**: Preventing duplicate rollups and telemetry records
- **Money as Cents**: Eliminating floating-point rounding errors

### 4. **Operational Robustness**

- **Idempotent Cron Jobs**: `lastDailyUpdateDate` pattern prevents double-increments
- **Transaction Wrapping**: Optimizer persistence as atomic operation
- **Distributed Locks**: Preventing concurrent job execution

---

## ⚠️ Overlaps / Complications

### 🔴 **CRITICAL: Schema Conflicts**

#### Problem 1: PostgreSQL vs SQLite Incompatibility

**Current System:** PostgreSQL with `pgTable` (confirmed in `shared/schema.ts`)

**Proposed Prompts:**

- **Prompt #4 (Drizzle SQLite Schema)**: Assumes `sqliteTable` and SQLite-specific patterns
  - Uses `integer()` for booleans (0/1)
  - Uses `TEXT` for JSON (no `jsonb`)
  - Uses `INTEGER` timestamps (`{ mode: "timestamp" }`)

**Conflict:** Current schema uses:

```typescript
pgTable("equipment", {
  specifications: jsonb("specifications"), // PostgreSQL JSONB
  isActive: boolean("is_active"), // PostgreSQL BOOLEAN
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});
```

**Impact:** ⛔ **BLOCKING** - Cannot apply SQLite schema changes to PostgreSQL database

---

#### Problem 2: Money Column Duplication

**Current Schema:**

```typescript
organizations: {
  emergencyLaborMultiplier: real("emergency_labor_multiplier").default(3.0),
}
vessels: {
  dayRateSgd: real("day_rate_sgd"),  // Exists in current schema
}
```

**Proposed Changes (Prompt #4):**

```typescript
vessels: {
  dayRateSgdCents: integer("day_rate_sgd_cents"),  // New column
  // Keep old column temporarily for migration
}
```

**Conflict:** Creates **dual schema** with both `dayRateSgd` (real) and `dayRateSgdCents` (integer)

**Migration Risk:**

1. Backfill script converts `dayRateSgd * 100 → dayRateSgdCents`
2. Application code must reference NEW column
3. Old column must be dropped in follow-up migration
4. **Risk:** Partial migration leaves inconsistent data

**Recommendation:** ⚠️ Use Drizzle migration tools (`npm run db:push`) instead of manual SQL to avoid breaking existing data

---

### 🟡 **HIGH: Redundant Implementation**

#### Problem 3: Cost Savings Dashboard - Already Exists

**Current System:** `server/cost-savings-engine.ts` (410 lines)

- Already implements:
  - `calculateWorkOrderSavings()`
  - `getSavingsSummary()`
  - `getMonthlySavingsTrend()`
  - Emergency multipliers
  - Weighted savings

**Proposed Prompt #5:** Builds **from scratch**:

- New router `/api/cost-savings`
- New endpoints `/summary`, `/trend`, `/breakdown`, `/roi`, `/top`
- New frontend page `/analytics/cost-savings`

**Duplication:**
| Feature | Existing | Proposed | Overlap % |
|---------|----------|----------|-----------|
| Savings calculation | ✅ | ✅ | 90% |
| Monthly trends | ✅ | ✅ | 80% |
| Summary stats | ✅ | ✅ | 85% |
| ROI tracking | Partial | ✅ | 50% |

**Impact:**

- **+2000 lines** of duplicate business logic
- **Parallel maintenance** burden (2 systems doing same thing)
- **Data consistency** risks if formulas diverge

**Recommendation:**
✅ **Extend existing engine** instead of rewriting:

```typescript
// GOOD: Extend existing
export async function getSavingsBreakdown(
  orgId: string,
  groupBy: 'vessel' | 'equipment' | 'maintenanceType'
) {
  // Add grouping logic to existing getSavingsSummary
}

// BAD: Duplicate entire engine
class CostSavingsDashboard {
  async calculateSavings() { ... } // Already exists in cost-savings-engine.ts
}
```

---

#### Problem 4: Multiple Vessel Counter Implementations

**Current Implementation:** Unknown (needs verification)

**Proposed Implementations:**

1. **Prompt #3 (Daily Operation Counter):**
   - Uses `lastDailyUpdateDate` (YYYY-MM-DD)
   - SG timezone (`Asia/Singapore`)
   - Idempotency via DB lookup
   - Increments `operationDays` OR `downtimeDays` (exclusive)

2. **Prompt #10 (System Repair - Cron):**
   - Uses `daily_vessel_counters` table (org_id, vessel_id, date_utc)
   - UTC timezone
   - Idempotency via UNIQUE constraint + INSERT
   - Only increments `operation_days`

**Conflicts:**
| Aspect | Prompt #3 | Prompt #10 | Impact |
|--------|-----------|------------|--------|
| Timezone | Singapore (GMT+8) | UTC | Different day boundaries |
| Idempotency | Column check | Table insert | Different mechanisms |
| Downtime tracking | Dual counter | Single counter | Logic mismatch |

**Example Failure:**

```
Date: Nov 5, 2025 11:00 PM SGT (Nov 5 3:00 PM UTC)

Prompt #3: dayKey = "2025-11-05" (SGT)
Prompt #10: date_utc = "2025-11-05" (UTC)

Work order created at 11:30 PM SGT (same SGT day, next UTC day)
→ Prompt #3: counts downtime on Nov 5
→ Prompt #10: counts downtime on Nov 6
→ MISMATCH
```

**Recommendation:** ⚠️ Choose **ONE** implementation:

- If multi-region: Use **UTC** (Prompt #10) for consistency
- If Singapore-only: Use **SGT** (Prompt #3) for business alignment
- **DO NOT** mix both

---

### 🟡 **MEDIUM: Linear Programming Optimizer Rewrites**

**Current System:** `server/lp-optimizer.ts` exists

**Proposed Changes:** **3 separate prompts** modifying same file:

1. **Prompt #9:** Parts stock constraints + soft lateness penalty
2. **Prompt #11:** Correct solver parsing + binary variables + precedence
3. **Prompt #12:** Same fixes as #11 + additional robustness

**Overlap Analysis:**

```
Prompt #11 fixes:
- Solution parsing (META_KEYS)
- Binary variables (not ints)
- Per-crew overlap constraints
- Unassigned job penalty
- Drizzle query fixes

Prompt #12 fixes (DUPLICATE):
- Solution parsing (META_KEYS)  ← Same fix
- Binary variables               ← Same fix
- Per-crew overlap constraints   ← Same fix
- Equipment exclusivity          ← New
- Parts stock (from Prompt #9)   ← Overlap
- Soft lateness (from Prompt #9) ← Overlap
```

**Impact:**

- **Confusing**: Which prompt to apply first?
- **Merge conflicts**: Prompts modify same functions
- **Testing burden**: Each prompt requires separate validation

**Recommendation:**
✅ **Consolidate into SINGLE prompt:**

```markdown
## LP Optimizer Comprehensive Fix

1. Solution parsing (Prompts #11, #12)
2. Binary variables (Prompts #11, #12)
3. Per-crew overlap (Prompts #11, #12)
4. Equipment exclusivity (Prompt #12)
5. Parts stock constraints (Prompts #9, #12)
6. Soft lateness penalty (Prompts #9, #12)
7. Unassigned job penalty (Prompt #11)
8. Drizzle query fixes (Prompts #11, #12)
```

---

### 🟡 **MEDIUM: Frontend Form Improvements - Repetitive Pattern**

**Prompts #6, #7, #8:** All propose **identical fixes** for different forms:

| Fix Pattern                                         | Sensor Templates | Work Order Cost | Expense Tracking |
| --------------------------------------------------- | ---------------- | --------------- | ---------------- |
| Controlled selects (`value=` not `defaultValue=`)   | ✅               | ✅              | ✅               |
| Safe numeric handling (`valueAsNumber` + NaN check) | ✅               | ✅              | ✅               |
| Currency formatting (`Intl.NumberFormat`)           | ✅               | ✅              | ✅               |
| Loading/error states                                | ✅               | ✅              | ✅               |
| Mutation pending states                             | ✅               | ✅              | ✅               |

**Problem:** Same fix repeated **3 times** for 3 different forms

**Recommendation:**
✅ **Create reusable patterns:**

```typescript
// hooks/useControlledNumber.ts
export const useControlledNumber = (onChange: (v: number) => void) => ({
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.currentTarget.valueAsNumber;
    onChange(Number.isFinite(v) ? v : NaN);
  },
});

// hooks/useCurrencyFormat.ts
export const useCurrencyFormat = (currency: string) =>
  useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      }),
    [currency]
  );
```

Then apply **once** across all forms instead of copy-pasting fixes.

---

## 💡 Enhancement Opportunities

### 1. **Missing: Comprehensive Logging Strategy**

**Current State:** Scattered `console.log` statements

**Proposed (Prompt #10):** Structured JSON logging

```typescript
log("info", "update settings", { requestId, orgId });
```

**Enhancement:** ✅ **Implement centralized logger**

```typescript
// lib/logger.ts (using pino)
import pino from "pino";

export const logger = pino({
  base: { service: "arus-backend" },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Usage
logger.info({ orgId, jobCount, duration }, "LP Optimizer completed");
```

**Benefits:**

- **Searchable**: Query by `orgId`, `equipmentId`, `vesselId`
- **Traceable**: `requestId` correlation across services
- **Observable**: Export to CloudWatch, Datadog, etc.

---

### 2. **Missing: Prometheus Metrics for LP Optimizer**

**Current State:** Crew scheduler has metrics (Phase 6 complete)

**Proposed:** Add similar metrics for maintenance optimizer

```typescript
const optimizerDuration = new Histogram({
  name: "lp_optimizer_duration_seconds",
  help: "Optimization runtime",
  labelNames: ["orgId", "jobCount", "feasible"],
});

const optimizerJobsScheduled = new Counter({
  name: "lp_optimizer_jobs_scheduled_total",
  help: "Jobs successfully scheduled",
  labelNames: ["orgId", "priority"],
});
```

---

### 3. **Missing: End-to-End Testing Strategy**

**Proposed Tests (Prompt #10):**

- Cron idempotency test
- Optimizer feasibility test
- Admin route security test

**Enhancement:** ✅ **Add integration test suite**

```typescript
// tests/integration/optimizer.test.ts
describe("LP Optimizer Integration", () => {
  it("schedules 10 jobs across 3 crew members without overlap", async () => {
    const jobs = createTestJobs(10);
    const crew = createTestCrew(3);

    const result = await optimizeMaintenanceSchedule(jobs, { crew });

    expect(result.success).toBe(true);
    expect(result.schedule).toHaveLength(10);
    expect(hasOverlappingAssignments(result.schedule, crew)).toBe(false);
  });
});
```

---

### 4. **Missing: Database Migration Strategy**

**Current State:** Manual SQL migrations

**Proposed:** Drizzle Kit auto-migration

**Enhancement:** ✅ **Add migration verification script**

```typescript
// scripts/verify-migration.ts
import { db } from "./server/db";
import * as schema from "./shared/schema";

async function verifySchema() {
  // Compare runtime schema vs DB schema
  const tables = await db.select().from(information_schema.tables);
  const missing = Object.keys(schema).filter((t) => !tables.includes(t));

  if (missing.length > 0) {
    console.error("Missing tables:", missing);
    process.exit(1);
  }
}
```

---

## 🧩 Implementation Strategy

### **Phase 1: Critical Bug Fixes (Week 1)**

**Priority: IMMEDIATE** - Apply without architectural changes

```markdown
1. ✅ VesselManagement: Add missing imports
   - File: `client/src/pages/vessels/VesselManagement.tsx`
   - Risk: LOW
   - Testing: Unit tests + manual verification

2. ✅ VesselIntelligence: Fix operating hours calculation
   - File: `server/vessel-intelligence.ts`
   - Risk: MEDIUM (data accuracy)
   - Testing: Integration test with sample data

3. ✅ LP Optimizer: Fix solver output parsing
   - File: `server/lp-optimizer.ts`
   - Risk: HIGH (schedule generation broken)
   - Testing: Create test suite with known-good solutions
```

**Deliverables:**

- [ ] All HIGH/CRITICAL fixes applied
- [ ] Unit tests passing
- [ ] Manual QA completed
- [ ] Deployed to staging

---

### **Phase 2: Schema Hardening (Week 2-3)**

**Priority: HIGH** - Requires careful migration planning

**⚠️ CONFLICT RESOLUTION REQUIRED:**

#### Decision Point 1: PostgreSQL vs SQLite

**Current:** PostgreSQL (`pgTable`, `jsonb`, `boolean`)

**Proposed (Prompt #4):** SQLite (`sqliteTable`, `TEXT`, `integer`)

**Resolution:**

```
IF deployment_mode == "cloud":
  ✅ Keep PostgreSQL
  ❌ Reject SQLite schema prompt (#4)

IF deployment_mode == "embedded":
  ✅ Add SQLite support as SEPARATE schema
  ✅ Maintain dual-mode (already documented in replit.md)
  ⚠️ Ensure 100% feature parity (current goal)
```

**Recommended Action:**

- Read `server/db.ts` to confirm current mode
- If dual-mode already exists, **extend** rather than replace
- If PostgreSQL-only, **defer** SQLite prompt

#### Decision Point 2: Money as Cents

**Current:** `dayRateSgd: real` (floating point)

**Proposed:** `dayRateSgdCents: integer` (cents)

**Migration Plan:**

```sql
-- Step 1: Add new column
ALTER TABLE vessels ADD COLUMN day_rate_sgd_cents INTEGER;

-- Step 2: Backfill (non-blocking)
UPDATE vessels
SET day_rate_sgd_cents = ROUND(COALESCE(day_rate_sgd, 0) * 100)
WHERE day_rate_sgd IS NOT NULL;

-- Step 3: Update application code
-- (TypeScript changes to use dayRateSgdCents)

-- Step 4: Drop old column (after verification)
-- ALTER TABLE vessels DROP COLUMN day_rate_sgd;
```

**Rollback Strategy:**

- Keep old column for 2 weeks
- Monitor application logs for references
- Gradual cutover with feature flag

---

### **Phase 3: Optimizer Consolidation (Week 4)**

**Goal:** Single, comprehensive LP optimizer fix

**Consolidated Prompt:**

```markdown
# LP Optimizer Production Hardening

## 1. Core Fixes (All Prompts)

- [x] Solution parsing with META_KEYS
- [x] Binary variables (not ints)
- [x] Per-crew overlap prevention
- [x] Equipment exclusivity constraints
- [x] Unassigned job penalty
- [x] Drizzle query fixes

## 2. Advanced Features

- [x] Parts stock constraints
- [x] Soft lateness penalty
- [x] Deadline/preferred date windows
- [x] Job dependency precedence

## 3. Robustness

- [x] Transaction wrapping
- [x] Error handling
- [x] Logging with context
- [x] Prometheus metrics

## 4. Testing

- [x] Unit tests (constraint validation)
- [x] Integration tests (end-to-end scheduling)
- [x] Performance tests (1000+ jobs)
```

**Implementation Order:**

1. Apply core fixes (1-2 days)
2. Add tests for each fix (1 day)
3. Add advanced features (2-3 days)
4. Performance tuning (1 day)

---

### **Phase 4: Frontend Pattern Library (Week 5)**

**Goal:** DRY principle for form improvements

**Deliverables:**

```typescript
// components/form/ControlledSelect.tsx
export const ControlledSelect = ({ value, onChange, options }) => (
  <Select value={value} onValueChange={onChange}>
    {options.map(opt => <SelectItem key={opt.value} value={opt.value} />)}
  </Select>
);

// components/form/CurrencyInput.tsx
export const CurrencyInput = ({ currency, value, onChange }) => {
  const fmt = useCurrencyFormat(currency);
  return <Input type="number" value={value} onChange={numberChange(onChange)} />;
};
```

**Apply to forms:**

1. Sensor Templates
2. Work Order Cost
3. Expense Tracking
4. Vessel Management

---

### **Phase 5: System-Wide Hardening (Week 6-7)**

**Apply Prompt #10 (System Repair) selectively:**

✅ **ACCEPT:**

- CSRF protection for admin routes
- Rate limiting middleware
- Structured logging
- Request ID correlation
- Admin route validation

❌ **REJECT (Already exists):**

- Zod schemas (already in `shared/schema.ts`)
- Query validation (TanStack Query already validates)
- Frontend error states (already implemented in Phase 8)

⚠️ **MODIFY:**

- Cron idempotency: Choose **ONE** implementation (UTC or SGT)
- Optimizer transactions: Already planned in Phase 3

---

## 📋 Risk Mitigation

### **High-Risk Changes**

| Change                          | Risk Level | Mitigation                                      |
| ------------------------------- | ---------- | ----------------------------------------------- |
| Schema migrations (money→cents) | 🔴 HIGH    | Gradual rollout, keep old columns, feature flag |
| PostgreSQL→SQLite               | 🔴 HIGH    | **SKIP** unless dual-mode confirmed             |
| Cron job timezone change        | 🟡 MEDIUM  | Run parallel for 1 week, compare results        |
| LP optimizer rewrites           | 🟡 MEDIUM  | Extensive testing with prod-like data           |

### **Testing Strategy**

```typescript
// Integration test with production data snapshot
describe("Cost Savings Engine", () => {
  beforeAll(async () => {
    await seedDatabase("prod-snapshot-2025-11.sql");
  });

  it("matches existing savings calculations ±1%", async () => {
    const workOrders = await getCompletedWorkOrders("2025-10");

    for (const wo of workOrders) {
      const oldCalc = await legacyCalculateSavings(wo.id);
      const newCalc = await calculateWorkOrderSavings(wo.id);

      expect(newCalc.totalSavings).toBeCloseTo(oldCalc.totalSavings, 0.01);
    }
  });
});
```

---

## 🎯 Recommended Acceptance Criteria

Before merging any prompt-based changes:

### **Code Quality**

- [ ] TypeScript compiles with `--strict`
- [ ] ESLint passes with 0 warnings
- [ ] No `console.log` (use structured logger)
- [ ] All public functions have JSDoc comments

### **Testing**

- [ ] Unit test coverage ≥80% for new code
- [ ] Integration tests cover happy + error paths
- [ ] Manual QA completed on staging
- [ ] Performance regression tests pass

### **Database**

- [ ] Migration script tested on copy of prod data
- [ ] Rollback script prepared and tested
- [ ] Schema changes backwards-compatible for 1 deployment cycle
- [ ] Foreign keys validated with `EXPLAIN` queries

### **Security**

- [ ] Multi-tenant isolation verified (`orgId` filtering)
- [ ] CSRF tokens added to admin mutations
- [ ] Rate limiting configured and tested
- [ ] No secrets in logs or error messages

### **Documentation**

- [ ] Architecture decision recorded in ADR
- [ ] API changes documented in OpenAPI spec
- [ ] Migration guide for breaking changes
- [ ] `replit.md` updated with new features

---

## 🚫 Prompts to REJECT Outright

1. **Prompt #4 (SQLite Schema)**
   - **Reason:** Conflicts with PostgreSQL schema
   - **Action:** Verify dual-mode support first, then adapt

2. **Prompt #5 (Cost Savings Dashboard - New)**
   - **Reason:** 90% duplicate of existing `cost-savings-engine.ts`
   - **Action:** Extend existing engine instead

3. **Prompt #12 (System Repair - Full Rewrite)**
   - **Reason:** Too broad, overlaps with #10, #11
   - **Action:** Cherry-pick specific fixes only

---

## 📊 Summary Matrix

| Prompt # | Title                | Verdict        | Priority | Effort | Risk |
| -------- | -------------------- | -------------- | -------- | ------ | ---- |
| 1        | VesselManagement     | ✅ ACCEPT      | HIGH     | 2h     | LOW  |
| 2        | VesselIntelligence   | ✅ ACCEPT      | HIGH     | 1d     | MED  |
| 3        | Daily Counter (SGT)  | ⚠️ CHOOSE ONE  | MED      | 2d     | MED  |
| 4        | SQLite Schema        | ❌ REJECT      | -        | -      | HIGH |
| 5        | Cost Dashboard       | ❌ REJECT      | -        | -      | MED  |
| 6        | Sensor Templates     | ✅ CONSOLIDATE | LOW      | 4h     | LOW  |
| 7        | Work Order Cost      | ✅ CONSOLIDATE | LOW      | 4h     | LOW  |
| 8        | Expense Tracking     | ✅ CONSOLIDATE | LOW      | 4h     | LOW  |
| 9        | LP Stock+Lateness    | ✅ MERGE       | HIGH     | 1d     | MED  |
| 10       | System Repair (Cron) | ⚠️ CHOOSE ONE  | MED      | 3d     | MED  |
| 11       | LP Comprehensive     | ✅ MERGE       | HIGH     | 2d     | MED  |
| 12       | System Repair (Full) | ❌ REJECT      | -        | -      | HIGH |

**Total Effort (Accepted):** ~12 days  
**Total Effort (All Prompts):** ~30 days  
**Efficiency Gain:** 60% reduction through consolidation

---

## Final Recommendations

### **Immediate Actions (This Sprint)**

1. ✅ Apply VesselManagement fixes (Prompt #1)
2. ✅ Apply VesselIntelligence fixes (Prompt #2)
3. ✅ Consolidate LP Optimizer fixes (Prompts #9, #11)

### **Next Sprint**

4. ⚠️ Decide: UTC vs SGT for vessel counters (Prompt #3 vs #10)
5. ✅ Create form pattern library (consolidate #6, #7, #8)
6. ✅ Add CSRF + rate limiting (subset of Prompt #10)

### **Backlog (Deferred)**

- Schema money→cents migration (high risk, low urgency)
- Cost savings dashboard rewrite (duplicate, not needed)
- SQLite dual-mode (requires architecture review)

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-05  
**Status:** Draft - Awaiting Stakeholder Review
