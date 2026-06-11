# RUL Engine Enhancement - Production Implementation Strategy

**Date:** November 4, 2025  
**Objective:** Zero-risk, production-grade implementation of 8 RUL enhancements  
**Timeline:** 14 phases with quality gates and architect reviews

---

## Strategic Principles

### 🎯 Core Objectives

1. **Zero Production Impact** - Each phase is independently testable and reversible
2. **Comprehensive Testing** - Unit → Integration → E2E at every phase
3. **Performance Validated** - Before/after benchmarks with p95 gates
4. **Architect-Reviewed** - Critical phases require sign-off
5. **Evidence-Based** - Every claim backed by test results and metrics

### 🛡️ Risk Mitigation Strategy

**Layered Safety Net:**

```
Layer 1: Feature Flags (can disable enhancements via env vars)
Layer 2: Graceful Degradation (fallback to old logic if new fails)
Layer 3: Database Backups (before schema changes)
Layer 4: Rollback Scripts (reverse each phase)
Layer 5: Canary Deployment (10% → 50% → 100%)
```

**Rollback Triggers:**

- Any test failure stops the pipeline
- Performance regression >20% stops deployment
- Architect review rejection stops phase
- Data quality issues revert to previous version

---

## Phase Breakdown

### 📋 Phase 1: Foundation Utilities (ZERO Production Impact)

**Goal:** Build battle-tested utility library without touching production code

**Tasks:**

1. Create `server/utils/rul-utils.ts` with 4 functions:
   - `deriveOpMode()` - Operating mode inference
   - `dataQualityScore()` - 4-factor quality calculation
   - `modeThresholdMultiplier()` - Per-mode adjustment factors
   - `calibrateFailureProb()` - Isotonic-like calibration

2. Create `server/tests/rul-utils.test.ts` with 20+ test cases:
   - Mode derivation: All 7 modes (DP, Transit, Harbor, Cargo_Ops, Standby, Docking, Unknown)
   - Quality scoring: Edge cases (0 samples, stale data, 100% missing, perfect data)
   - Multipliers: DP < Cargo < Transit < Harbor < Standby
   - Calibration: Extreme probabilities (0.01, 0.99) pulled toward base rate

3. Performance baseline:
   - Benchmark each utility function
   - Target: <1ms per call
   - Record in `docs/audit/_artifacts/phase1_baseline.json`

**Quality Gates:**

- ✅ 100% test coverage on utilities
- ✅ All tests pass
- ✅ TypeScript strict mode (no `any` types)
- ✅ ESLint clean
- ✅ Performance <1ms per function

**Verification:**

```bash
npm test -- rul-utils.test.ts
npx tsx scripts/benchmark-utils.ts  # Creates this script
```

**Architect Review:** Not required (utilities only)

**Rollback:** Delete files (no production impact)

---

### 📋 Phase 2: Schema Enhancement (Low Risk)

**Goal:** Add database fields for repair tracking and quality metrics

**Schema Changes:**

```typescript
// shared/schema.ts additions

// Option A: Extend failureHistory with resolvedAt
export const failureHistory = pgTable("failure_history", {
  // ... existing fields ...
  resolvedAt: timestamp("resolved_at"), // NEW: When repair completed
  status: varchar("status", { length: 50 }).default("open"), // NEW: open|resolved
});

// Option B: Add quality metadata to componentDegradation
export const componentDegradation = pgTable("component_degradation", {
  // ... existing fields ...
  dataQuality: real("data_quality"), // NEW: Pre-computed quality score
});

// Option C: Extend failurePredictions metadata
export const failurePredictions = pgTable("failure_predictions", {
  // ... existing fields ...
  metadata: jsonb("metadata"), // Already exists, will add: { operatingMode, dataQuality, baseRate }
});
```

**Migration Plan:**

1. Backup database: `pg_dump arus_db > backup_pre_phase2.sql`
2. Run `npm run db:push` (or `--force` if needed)
3. Verify schema: Check columns exist
4. Seed test data with new fields

**Quality Gates:**

- ✅ Schema push successful (no errors)
- ✅ Existing data intact (row count verification)
- ✅ New columns nullable (backward compatible)
- ✅ Rollback script tested

**Verification:**

```bash
npm run db:push
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='failure_history';"
```

**Rollback:**

```sql
-- If needed (schema changes are additive, safe to leave)
ALTER TABLE failure_history DROP COLUMN IF EXISTS resolved_at;
ALTER TABLE failure_history DROP COLUMN IF EXISTS status;
```

---

### 📋 Phase 3: RUL Engine Core Upgrade (Medium Risk)

**Goal:** Integrate utilities into RUL engine with feature flag protection

**Code Changes:**

```typescript
// server/rul-engine.ts modifications

// Add feature flag at top
const ENABLE_MODE_AWARE = process.env.RUL_MODE_AWARE !== 'false'; // default ON
const ENABLE_QUALITY_SCORING = process.env.RUL_QUALITY_SCORING !== 'false';
const ENABLE_REPAIR_CENSORING = process.env.RUL_REPAIR_CENSORING !== 'false';
const ENABLE_CALIBRATION = process.env.RUL_CALIBRATION !== 'false';

async calculateRul(equipmentId: string, orgId: string): Promise<RulPrediction | null> {
  // EXISTING CODE PRESERVED

  // NEW: Operating mode detection (line ~115)
  let opMode: OpMode = 'UNKNOWN';
  if (ENABLE_MODE_AWARE) {
    opMode = await this.detectOperatingMode(equipmentId, orgId);
  }

  // NEW: Data quality scoring (line ~135)
  let q = 1.0; // Default: perfect quality
  if (ENABLE_QUALITY_SCORING) {
    q = await this.calculateDataQuality(equipmentId, orgId);
    confidenceScore = Math.max(0.1, Math.min(0.95, confidenceScore * (0.6 + 0.4*q)));
  }

  // NEW: Repair awareness (line ~96, before analyzeDegradationPattern)
  let degradationDataFiltered = degradationData;
  if (ENABLE_REPAIR_CENSORING) {
    const lastRepair = await this.getLastRepair(equipmentId, orgId);
    if (lastRepair) {
      degradationDataFiltered = degradationData.filter(d =>
        d.measurementTimestamp > lastRepair.resolvedAt
      );
    }
  }

  // NEW: Probability calibration (line ~148)
  if (ENABLE_CALIBRATION) {
    const baseRate = await this.getBaseFailureRate(equipmentType, orgId);
    failureProbability = calibrateFailureProb(failureProbability, baseRate);
  }

  // NEW: Mode multiplier (line ~116)
  if (ENABLE_MODE_AWARE && opMode !== 'UNKNOWN') {
    remainingDays = Math.round(remainingDays * modeThresholdMultiplier(opMode));
  }

  // EXISTING CODE CONTINUES...
}
```

**New Helper Methods:**

```typescript
private async detectOperatingMode(equipmentId: string, orgId: string): Promise<OpMode> {
  const latestTelemetry = await this.db.select()
    .from(equipmentTelemetry)
    .where(and(
      eq(equipmentTelemetry.equipmentId, equipmentId),
      eq(equipmentTelemetry.orgId, orgId)
    ))
    .orderBy(desc(equipmentTelemetry.ts))
    .limit(1);

  if (!latestTelemetry.length) return 'UNKNOWN';

  const detector = new ModeDetector();
  const window = detector.toTelemetryWindow(latestTelemetry[0]);
  const result = detector.detectMode(window);

  return result.mode as OpMode;
}

private async calculateDataQuality(equipmentId: string, orgId: string): Promise<number> {
  const stats = await this.db.execute(sql`
    SELECT
      COUNT(*) AS n,
      EXTRACT(EPOCH FROM (MAX(measurement_timestamp)-MIN(measurement_timestamp)))/86400 AS span_days,
      AVG(CASE WHEN degradation_metric IS NULL THEN 1 ELSE 0 END) AS missing_pct,
      EXTRACT(EPOCH FROM (NOW()-MAX(measurement_timestamp)))/60 AS staleness_min
    FROM ${componentDegradation}
    WHERE equipment_id = ${equipmentId}
      AND org_id = ${orgId}
      AND measurement_timestamp >= NOW() - INTERVAL '30 days'
  `);

  if (!stats.rows?.length) return 0.5; // Default medium quality

  const row = stats.rows[0];
  return dataQualityScore(
    Number(row.n || 0),
    Number(row.span_days || 0),
    Number(row.missing_pct || 0),
    Number(row.staleness_min || 0)
  );
}

private async getLastRepair(equipmentId: string, orgId: string) {
  const repairs = await this.db.select()
    .from(failureHistory)
    .where(and(
      eq(failureHistory.equipmentId, equipmentId),
      eq(failureHistory.orgId, orgId),
      eq(failureHistory.status, 'resolved')
    ))
    .orderBy(desc(failureHistory.resolvedAt))
    .limit(1);

  return repairs[0] || null;
}

private async getBaseFailureRate(equipmentType: string, orgId: string): Promise<number> {
  const stats = await this.db.execute(sql`
    SELECT
      COALESCE(
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)::float /
        NULLIF(COUNT(*), 0),
        0.05
      ) AS base_rate
    FROM ${failureHistory} fh
    JOIN ${equipment} e ON e.id = fh.equipment_id
    WHERE fh.org_id = ${orgId}
      AND e.type = ${equipmentType}
      AND fh.event_timestamp >= NOW() - INTERVAL '365 days'
  `);

  return Number(stats.rows?.[0]?.base_rate ?? 0.05);
}
```

**Quality Gates:**

- ✅ All existing tests still pass (regression)
- ✅ New integration tests for each enhancement
- ✅ A/B comparison: Old vs new logic produces similar results
- ✅ Feature flags allow disabling any enhancement
- ✅ Graceful degradation when data unavailable

**Testing Strategy:**

```typescript
// server/tests/rul-engine-enhanced.test.ts

describe("RUL Engine Enhancements", () => {
  describe("Mode Awareness", () => {
    it("should reduce RUL for DP mode vs Transit", async () => {
      const dpResult = await engine.calculateRul(equipmentId, orgId); // with DP mode
      const transitResult = await engine.calculateRul(equipmentId, orgId); // with Transit mode
      expect(dpResult.remainingDays).toBeLessThan(transitResult.remainingDays * 0.9);
    });
  });

  describe("Data Quality", () => {
    it("should reduce confidence for sparse data", async () => {
      // Setup: Only 10 data points
      const sparseResult = await engine.calculateRul(equipmentId, orgId);
      expect(sparseResult.confidenceScore).toBeLessThan(0.7);
    });

    it("should reduce confidence for stale data", async () => {
      // Setup: Last reading 24h ago
      const staleResult = await engine.calculateRul(equipmentId, orgId);
      expect(staleResult.confidenceScore).toBeLessThan(0.6);
    });
  });

  describe("Repair Censoring", () => {
    it("should ignore pre-repair degradation data", async () => {
      // Setup: Repair completed 7 days ago
      const resultAfterRepair = await engine.calculateRul(equipmentId, orgId);
      // Should only use post-repair data (7 days worth)
      expect(resultAfterRepair.remainingDays).toBeGreaterThan(30); // More optimistic
    });
  });

  describe("Calibration", () => {
    it("should pull high probability toward base rate", async () => {
      // Setup: ML predicts 0.95, base rate is 0.15
      const result = await engine.calculateRul(equipmentId, orgId);
      expect(result.failureProbability).toBeLessThan(0.9);
      expect(result.failureProbability).toBeGreaterThan(0.7);
    });
  });
});
```

**Architect Review:** REQUIRED (critical logic changes)

**Rollback:**

```bash
# Disable all features
export RUL_MODE_AWARE=false
export RUL_QUALITY_SCORING=false
export RUL_REPAIR_CENSORING=false
export RUL_CALIBRATION=false
# Restart service
npm run dev
```

---

### 📋 Phase 4: Query Performance Optimization (Medium Risk)

**Goal:** Replace N+1 query pattern with aggregates, add indexes

**Current Performance Baseline:**

```bash
# Run before optimization
npx tsx scripts/benchmark-rul.ts
# Expected: ~150ms p95 for single RUL calculation
# Record in docs/audit/_artifacts/phase4_before.json
```

**Code Changes:**

```typescript
// Replace individual component queries with single aggregate

// OLD (N+1 pattern):
const degradationData = await this.db.select()
  .from(componentDegradation)
  .where(...)
  .orderBy(desc(componentDegradation.measurementTimestamp));

// For each component: separate processing (5-10 queries)

// NEW (Single aggregate):
const [degradationData, qualityStats] = await Promise.all([
  this.db.select()
    .from(componentDegradation)
    .where(...)
    .orderBy(desc(componentDegradation.measurementTimestamp)),

  this.db.execute(sql`
    SELECT
      component_type,
      COUNT(*) AS n,
      EXTRACT(EPOCH FROM (MAX(measurement_timestamp)-MIN(measurement_timestamp)))/86400 AS span_days,
      AVG(CASE WHEN degradation_metric IS NULL THEN 1 ELSE 0 END) AS missing_pct,
      EXTRACT(EPOCH FROM (NOW()-MAX(measurement_timestamp)))/60 AS staleness_min,
      -- Linear regression in SQL (optional optimization)
      REGR_SLOPE(degradation_metric, EXTRACT(EPOCH FROM measurement_timestamp)) AS trend_slope,
      REGR_R2(degradation_metric, EXTRACT(EPOCH FROM measurement_timestamp)) AS r_squared
    FROM ${componentDegradation}
    WHERE equipment_id = ${equipmentId}
      AND org_id = ${orgId}
      AND measurement_timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY component_type
  `)
]);
```

**Database Indexes:**

```sql
-- Add composite indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_component_degradation_lookup
  ON component_degradation (org_id, equipment_id, measurement_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_failure_history_repairs
  ON failure_history (org_id, equipment_id, status, resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_latest
  ON equipment_telemetry (org_id, equipment_id, ts DESC);
```

**Performance Target:**

- p95 latency: <200ms (maintain or improve)
- Query count: 10 queries → 3 queries
- Database load: 50% reduction in query time

**Quality Gates:**

- ✅ Performance harness shows improvement or neutral
- ✅ No regression in accuracy (results identical to old logic)
- ✅ Indexes created successfully
- ✅ Production database query plan verified (EXPLAIN ANALYZE)

**Verification:**

```bash
# After optimization
npx tsx scripts/benchmark-rul.ts
# Compare with phase4_before.json
# Generate phase4_after.json with improvement metrics

# Verify query plan
psql -c "EXPLAIN ANALYZE SELECT ... FROM component_degradation WHERE ..."
```

**Architect Review:** REQUIRED (performance critical)

**Rollback:**

- Keep indexes (they only help)
- Revert to previous query pattern in code

---

### 📋 Phase 5: Prometheus Metrics Integration (Low Risk)

**Goal:** Add RUL-specific observability with real-time metrics

**Code Changes:**

```typescript
// server/ml-prometheus-metrics.ts additions

export const rulRemainingDays = new Gauge({
  name: "rul_remaining_days",
  help: "Remaining useful life in days",
  labelNames: ["org_id", "equipment_id", "mode"],
});

export const rulFailureProbability = new Gauge({
  name: "rul_failure_probability",
  help: "Calibrated failure probability (0-1)",
  labelNames: ["org_id", "equipment_id", "mode"],
});

export const rulDataQuality = new Gauge({
  name: "rul_data_quality",
  help: "Data quality score (0-1)",
  labelNames: ["org_id", "equipment_id", "mode"],
});

export const rulConfidence = new Gauge({
  name: "rul_confidence",
  help: "Quality-aware prediction confidence",
  labelNames: ["org_id", "equipment_id", "mode"],
});

export const rulHealthIndex = new Gauge({
  name: "rul_health_index",
  help: "Composite health index (0-100)",
  labelNames: ["org_id", "equipment_id", "mode"],
});

export const rulRiskLevel = new Gauge({
  name: "rul_risk_level",
  help: "Risk level numeric (0=low, 1=medium, 2=high, 3=critical)",
  labelNames: ["org_id", "equipment_id", "mode"],
});

export const rulCalcDuration = new Histogram({
  name: "rul_calc_duration_ms",
  help: "RUL calculation latency in milliseconds",
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2000, 4000],
  labelNames: ["org_id", "equipment_id", "mode"],
});
```

**Integration into RUL Engine:**

```typescript
// server/rul-engine.ts (end of calculateRul)

const start = Date.now();
// ... RUL calculation logic ...
const duration = Date.now() - start;

const labels = {
  org_id: orgId,
  equipment_id: equipmentId,
  mode: opMode,
};

rulCalcDuration.labels(labels.org_id, labels.equipment_id, labels.mode).observe(duration);
rulRemainingDays.labels(labels.org_id, labels.equipment_id, labels.mode).set(remainingDays);
rulFailureProbability
  .labels(labels.org_id, labels.equipment_id, labels.mode)
  .set(failureProbability);
rulConfidence.labels(labels.org_id, labels.equipment_id, labels.mode).set(confidenceScore);
rulDataQuality.labels(labels.org_id, labels.equipment_id, labels.mode).set(q);
rulHealthIndex.labels(labels.org_id, labels.equipment_id, labels.mode).set(healthIndex);

const riskNum = { low: 0, medium: 1, high: 2, critical: 3 }[riskLevel] ?? 0;
rulRiskLevel.labels(labels.org_id, labels.equipment_id, labels.mode).set(riskNum);
```

**Quality Gates:**

- ✅ Metrics endpoint shows new RUL metrics
- ✅ Metrics populate after RUL calculation
- ✅ All label combinations valid
- ✅ No metric naming conflicts

**Verification:**

```bash
# Start server
npm run dev

# Trigger RUL calculation
curl -X POST http://localhost:5000/api/rul/calculate \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-001","orgId":"org-001"}'

# Check metrics endpoint
curl http://localhost:5000/api/metrics | grep rul_

# Save sample to docs/audit/_artifacts/rul_metrics_sample.prom
```

**Rollback:** Comment out metric recording (no side effects)

---

### 📋 Phase 6: Grafana Dashboard Creation (Low Risk)

**Goal:** Create production-ready RUL dashboard with real data

**Dashboard Specification:**

- File: `docs/dashboards/grafana-rul-performance.json`
- 7 panels with 3 variables
- Provisioning config for auto-import

**Variables:**

```json
{
  "templating": {
    "list": [
      {
        "name": "org",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(rul_remaining_days, org_id)"
      },
      {
        "name": "equip",
        "type": "query",
        "query": "label_values(rul_remaining_days{org_id=\"$org\"}, equipment_id)"
      },
      {
        "name": "mode",
        "type": "query",
        "query": "label_values(rul_remaining_days{org_id=\"$org\",equipment_id=\"$equip\"}, mode)"
      }
    ]
  }
}
```

**Panels:**

1. **Remaining Days Stat** - Single value with color thresholds
2. **Failure Probability Time Series** - Line graph with mode overlay
3. **Confidence & Quality** - Dual time series comparison
4. **Health Index vs RUL** - Combined view
5. **Risk Level Gauge** - Current risk with thresholds
6. **Calc Duration p95** - Performance monitoring
7. **Latest Predictions Table** - Top 50 equipment

**Quality Gates:**

- ✅ Dashboard JSON validates (no syntax errors)
- ✅ All queries reference existing metrics
- ✅ Variables populate with real data
- ✅ Screenshot evidence shows populated panels

**Verification:**

```bash
# Validate JSON
cat docs/dashboards/grafana-rul-performance.json | jq . > /dev/null

# Start Grafana (if not running)
# Import dashboard via provisioning or UI
# Trigger RUL calculations to populate data
# Screenshot dashboard

# Save screenshot to docs/audit/_artifacts/rul_dashboard.png
```

**Rollback:** Delete dashboard file (no system impact)

---

### 📋 Phase 7: ML Governance Integration (Medium Risk)

**Goal:** Add audit trail for every RUL calculation

**Code Changes:**

```typescript
// server/rul-engine.ts (end of calculateRul)

// Write provenance crumb to failurePredictions
await this.db.insert(failurePredictions).values({
  id: crypto.randomUUID(),
  orgId,
  equipmentId,
  modelId: mlPredictions[0]?.modelId || null,
  modelType: "hybrid_rul",
  predictionTimestamp: new Date(),
  failureProbability,
  predictedFailureDate: new Date(Date.now() + remainingDays * 86400000),
  confidence: confidenceScore,
  metadata: {
    operatingMode: opMode,
    dataQuality: q,
    baseRate,
    calibrated: true,
    modeMultiplier: modeThresholdMultiplier(opMode),
    repairCensored: !!lastRepair,
    version: "v2.0-enhanced",
  },
});

// Link to ML governance lineage (if available)
if (this.governanceService) {
  await this.governanceService.recordPrediction({
    type: "rul_calculation",
    equipmentId,
    orgId,
    inputs: {
      mlPredictions: mlPredictions.length,
      degradationPoints: degradationData.length,
      operatingMode: opMode,
      dataQuality: q,
    },
    outputs: {
      remainingDays,
      failureProbability,
      riskLevel,
      confidenceScore,
    },
    timestamp: new Date(),
    provenance_hash: createHash("sha256")
      .update(JSON.stringify({ equipmentId, remainingDays, failureProbability, opMode, q }))
      .digest("hex"),
  });
}
```

**Quality Gates:**

- ✅ Every RUL calculation creates audit record
- ✅ Provenance hash verifiable
- ✅ Metadata includes all enhancement flags
- ✅ Lineage chain traceable

**Verification:**

```bash
# Trigger RUL calculation
curl -X POST http://localhost:5000/api/rul/calculate -d '...'

# Verify audit record
psql -c "SELECT * FROM failure_predictions ORDER BY prediction_timestamp DESC LIMIT 1;"

# Check metadata
psql -c "SELECT metadata FROM failure_predictions ORDER BY prediction_timestamp DESC LIMIT 1;"
```

**Architect Review:** REQUIRED (compliance critical)

---

### 📋 Phase 8: End-to-End Testing (High Risk)

**Goal:** Validate complete user workflow with playwright

**Test Scenarios:**

1. **Equipment Health Dashboard → RUL Calculation**
   - Navigate to equipment list
   - Click equipment with critical health
   - Verify RUL displayed
   - Check mode badge shown
   - Verify quality indicator

2. **Mode Impact Verification**
   - Select equipment in DP mode
   - Note RUL value
   - Simulate mode change to Standby
   - Verify RUL increases

3. **Post-Repair Scenario**
   - Equipment with recent repair
   - Check RUL is optimistic
   - Verify "Recent Repair" badge

4. **Low Quality Warning**
   - Equipment with sparse data
   - Verify "Low Data Quality" warning
   - Check confidence score reduced

**Test Plan:**

```typescript
// server/tests/e2e-rul-workflow.test.ts (using run_test tool)

const testPlan = `
1. [New Context] Create browser context
2. [Browser] Navigate to /equipment
3. [Verify] Equipment list loads
4. [Browser] Click equipment with ID eq-001
5. [Verify] RUL card shows remaining days
6. [Verify] Operating mode chip displays (DP/Transit/etc)
7. [Verify] Data quality indicator shows
8. [Browser] Click "View RUL Details" button
9. [Verify] RUL breakdown shows:
   - Component health scores
   - Failure probability
   - Risk level badge
   - Recommendations list
10. [API] POST /api/rul/calculate for eq-001
11. [Verify] Response includes all new fields:
    - operatingMode in metadata
    - dataQuality score
    - calibrated flag
`;
```

**Quality Gates:**

- ✅ All UI elements render correctly
- ✅ Mode badges show accurate states
- ✅ Quality indicators match backend data
- ✅ API responses include enhancement metadata
- ✅ No console errors or warnings

---

### 📋 Phase 9: Production Documentation (Critical)

**Goal:** Comprehensive docs for operators and developers

**Documents to Create/Update:**

1. **replit.md Enhancement Section:**

```markdown
### RUL Engine v2.0 Enhancements (November 2025)

**Mode-Aware Predictions:**

- Operating mode (DP/Transit/Harbor/etc) adjusts RUL thresholds
- DP mode: 15% stricter (earlier warnings for critical ops)
- Standby mode: 20% more lenient (reduces false alarms)

**Data Quality Propagation:**

- 4-factor quality scoring (sample count, time span, missingness, staleness)
- Confidence scores reflect data quality
- "Low Quality" warnings prevent overconfident predictions

**Repair Awareness:**

- Recent successful repairs reset degradation trends
- Post-repair RUL more optimistic (realistic)
- Right-censoring of pre-repair data

**Calibrated Probabilities:**

- Failure probabilities aligned with observed base rates
- Prevents ML overconfidence (0.95 → 0.80 when base rate is 0.15)
- Isotonic-like calibration algorithm

**Performance Optimizations:**

- Query optimization: 10 queries → 3 queries per RUL calc
- 40-60% faster batch operations
- Database indexes added

**Enhanced Observability:**

- 7 new RUL-specific Prometheus metrics
- Dedicated Grafana dashboard (RUL Performance)
- Real-time monitoring of mode, quality, calibration

**ML Governance Integration:**

- Audit trail for every RUL calculation
- Provenance chain with SHA-256 hashing
- Compliance-ready for SOC 2, ISO 27001
```

2. **Operator Runbook:** `docs/runbooks/rul_engine_v2.md`
   - How to interpret quality warnings
   - Mode impact on predictions
   - When to trust low-confidence RULs
   - Dashboard usage guide
   - Troubleshooting common issues

3. **Developer Guide:** `docs/development/rul_enhancements.md`
   - Architecture diagrams
   - Feature flag configuration
   - Performance tuning guide
   - Extending enhancements

4. **Migration Guide:** `docs/migration/rul_v1_to_v2.md`
   - Breaking changes (none)
   - New features opt-in
   - Rollback procedures
   - Data migration (automatic)

**Quality Gates:**

- ✅ All documentation reviewed for accuracy
- ✅ Code examples tested and working
- ✅ Screenshots up-to-date
- ✅ Links functional

---

### 📋 Phase 10: Final Architect Review & Sign-off

**Goal:** Comprehensive review of all phases before production deployment

**Review Checklist:**

1. **Code Quality:**
   - [ ] TypeScript strict mode compliance
   - [ ] ESLint clean (0 warnings)
   - [ ] No `any` types in public APIs
   - [ ] Proper error handling everywhere
   - [ ] Logging appropriate (no PII)

2. **Testing:**
   - [ ] Unit tests: 100% coverage on new code
   - [ ] Integration tests: All enhancement paths covered
   - [ ] E2E tests: User workflows validated
   - [ ] Performance tests: Before/after comparison
   - [ ] Regression tests: Old behavior unchanged

3. **Performance:**
   - [ ] p95 latency ≤200ms (baseline ~150ms)
   - [ ] Query count reduced (10 → 3)
   - [ ] Database indexes optimized
   - [ ] Memory usage stable
   - [ ] No N+1 query patterns

4. **Security:**
   - [ ] No SQL injection vectors
   - [ ] Org-id validation on all queries
   - [ ] Feature flags respect permissions
   - [ ] Audit trail captures all changes
   - [ ] Sensitive data encrypted

5. **Observability:**
   - [ ] Metrics operational and accurate
   - [ ] Dashboard shows real data
   - [ ] Alerts configured (if needed)
   - [ ] Logs structured and queryable
   - [ ] Tracing enabled (if applicable)

6. **Documentation:**
   - [ ] replit.md updated with evidence
   - [ ] Runbooks complete and tested
   - [ ] API docs reflect new fields
   - [ ] Migration guide accurate
   - [ ] Rollback procedures documented

**Architect Deliverables:**

- Formal sign-off document
- Risk assessment summary
- Production readiness certification
- Recommended deployment strategy

---

## Deployment Strategy

### Canary Deployment (Recommended)

**Stage 1: Staging Environment (1 day)**

- Deploy all enhancements with feature flags ON
- Run full test suite
- Monitor metrics for 24 hours
- Validate dashboard accuracy

**Stage 2: Production Canary (10% - 2 days)**

- Enable for 10% of equipment (selected by hash)
- Monitor:
  - RUL calculation latency
  - Data quality distribution
  - Mode detection accuracy
  - Calibration impact
- Compare canary vs baseline predictions
- Rollback trigger: >20% performance regression OR accuracy degradation

**Stage 3: Production Gradual Rollout (50% - 3 days)**

- Expand to 50% of equipment
- Monitor same metrics
- Gather operator feedback
- Fine-tune calibration alpha if needed

**Stage 4: Full Production (100% - Ongoing)**

- Enable for all equipment
- Continue monitoring
- Iterate based on real-world data

### Rollback Plan

**Level 1: Feature Flag Disable (Instant)**

```bash
# Disable specific enhancements
export RUL_MODE_AWARE=false
export RUL_QUALITY_SCORING=false
export RUL_REPAIR_CENSORING=false
export RUL_CALIBRATION=false

# Restart service
pm2 restart arus-api
```

**Level 2: Code Revert (5 minutes)**

```bash
# Revert to previous commit
git revert <enhancement-commit-hash>
git push origin main

# Redeploy
npm run deploy
```

**Level 3: Database Rollback (15 minutes)**

```bash
# Restore from backup (if schema changes needed reverting)
pg_restore -d arus_db backup_pre_phase2.sql
```

---

## Success Metrics

### Quantitative (Measurable in 30 days)

1. **Accuracy Improvement:**
   - Target: 10-15% reduction in false positives
   - Measure: Alert precision (true alerts / total alerts)

2. **Performance:**
   - Target: p95 latency ≤200ms (maintain or improve)
   - Measure: Prometheus `rul_calc_duration_ms` p95

3. **Data Quality:**
   - Target: 95%+ equipment have quality score >0.6
   - Measure: Avg `rul_data_quality` metric

4. **Mode Detection:**
   - Target: 90%+ RUL calculations have valid mode (not Unknown)
   - Measure: % of `rul_remaining_days` with mode != 'UNKNOWN'

5. **Calibration:**
   - Target: Failure probabilities within ±0.10 of observed base rates
   - Measure: Compare predicted vs actual failure rates monthly

### Qualitative (Operator Feedback)

- Reduced alert fatigue (fewer false alarms during standby)
- Increased trust in predictions (calibrated probabilities)
- Better situational awareness (mode-aware thresholds)
- Improved post-repair confidence (repair censoring)

---

## Risk Register

| Risk                                   | Likelihood | Impact | Mitigation                        |
| -------------------------------------- | ---------- | ------ | --------------------------------- |
| Performance regression >20%            | Low        | High   | Performance gates + rollback      |
| Calibration over-adjusts probabilities | Medium     | Medium | Tunable alpha parameter           |
| Mode detection inaccurate              | Low        | Low    | Fallback to Unknown mode          |
| Quality scoring too strict             | Medium     | Low    | Adjustable thresholds             |
| Database migration fails               | Very Low   | High   | Backups + additive schema changes |
| Metrics overload Prometheus            | Low        | Medium | Metric cardinality limits         |
| Dashboard queries timeout              | Low        | Low    | Query optimization + caching      |
| Governance overhead impacts latency    | Low        | Medium | Async audit writes                |

---

## Timeline Summary

| Phase                      | Duration  | Risk   | Review    |
| -------------------------- | --------- | ------ | --------- |
| 1. Foundation Utilities    | 1 hour    | None   | None      |
| 2. Schema Enhancement      | 30 min    | Low    | None      |
| 3. RUL Engine Core         | 2 hours   | Medium | Architect |
| 4. Query Optimization      | 1 hour    | Medium | Architect |
| 5. Prometheus Metrics      | 1 hour    | Low    | None      |
| 6. Grafana Dashboard       | 1 hour    | Low    | None      |
| 7. ML Governance           | 1 hour    | Medium | Architect |
| 8. E2E Testing             | 1.5 hours | High   | None      |
| 9. Documentation           | 1 hour    | None   | None      |
| 10. Final Architect Review | 1 hour    | None   | Architect |

**Total Estimated Time:** 10-12 hours  
**Architect Review Points:** 4 (Phases 3, 4, 7, 10)  
**Total Production Risk:** Low (feature flags + rollback)

---

## Conclusion

This strategy provides a **foolproof, production-grade implementation** with:

- ✅ Zero-risk deployment (feature flags + gradual rollout)
- ✅ Comprehensive testing (unit + integration + e2e)
- ✅ Performance validation (before/after benchmarks)
- ✅ Architect oversight (4 review points)
- ✅ Complete rollback capability (3 levels)
- ✅ Evidence-based verification (metrics + screenshots)

**Recommendation:** Proceed with Phase 1 implementation immediately.
