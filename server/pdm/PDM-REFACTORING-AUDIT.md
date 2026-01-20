# PdM Module Refactoring Audit

## Executive Summary

This document inventories the legacy and new PdM (Predictive Maintenance) components in ARUS Marine, maps their relationships, and provides migration/cleanup recommendations.

---

## 1. NEW REFACTORED PdM MODULE (Hexagonal Architecture)

### Location: `server/pdm/`

| Component | Path | Purpose |
|-----------|------|---------|
| **Domain Types** | `domain/types.ts` | RiskQueueItem, FleetHealthKpis, TelemetryCoverage, ModelHealth, MaintenancePipeline |
| **Repository Port** | `ports/pdm-repository.port.ts` | Interface defining data access contract |
| **PostgreSQL Adapter** | `adapters/pdm-postgres.repository.ts` | Concrete implementation using Drizzle ORM |
| **Get Dashboard Use Case** | `application/get-dashboard.use-case.ts` | Aggregates all dashboard data |
| **Get Risk Queue Use Case** | `application/get-risk-queue.use-case.ts` | Filtered risk queue retrieval |
| **Get Asset Detail Use Case** | `application/get-asset-detail.use-case.ts` | Single asset deep-dive |
| **Acknowledge Risk Use Case** | `application/acknowledge-risk.use-case.ts` | Mark risks acknowledged |
| **Create Work Order Use Case** | `application/create-work-order.use-case.ts` | Create WO from risk |
| **Routes** | `routes.ts` | REST API endpoints at `/api/pdm/*` |
| **Module Entry** | `index.ts` | Exports all use cases and wires dependencies |

### Frontend Components (NEW)

| Component | Path | Purpose |
|-----------|------|---------|
| **PdM Dashboard Page** | `client/src/pages/pdm-dashboard.tsx` | Main dashboard with KPIs, Risk Queue, Charts |
| **PdM Types** | `client/src/features/pdm/types.ts` | TypeScript interfaces for API responses |
| **PdM Hooks** | `client/src/features/pdm/hooks/use-pdm-dashboard.ts` | TanStack Query hooks |
| **Feature Index** | `client/src/features/pdm/index.ts` | Feature barrel export |

### Unit Tests

| Test File | Path | Coverage |
|-----------|------|----------|
| **Dashboard Tests** | `server/tests/pdm/get-dashboard.test.ts` | 15 tests covering use cases, KPIs, risk queue |

---

## 2. LEGACY PdM COMPONENTS

### Legacy Backend Services

| Component | Path | Status | Recommendation |
|-----------|------|--------|----------------|
| `pdm-services/` | `server/pdm-services/` | **ACTIVE** | **KEEP** - Contains low-level analysis logic |
| `pdm-services/alerts.ts` | Alert generation | ACTIVE | KEEP - Used by scheduler |
| `pdm-services/analysis.ts` | Vibration/FFT analysis | ACTIVE | KEEP - Core ML input |
| `pdm-services/baseline.ts` | Baseline calculations | ACTIVE | KEEP - Training pipelines |
| `pdm-services/service.ts` | Main service class | ACTIVE | KEEP - Orchestrates predictions |

### Legacy ML/Analytics Routes

| Component | Path | Status | Recommendation |
|-----------|------|--------|----------------|
| `routes/analytics/predictions.ts` | `/api/analytics/predictions/*` | **OVERLAP** | **DEPRECATE** - New module covers this |
| `routes/analytics/health-metrics.ts` | `/api/analytics/health/*` | PARTIAL | KEEP some endpoints |
| `routes/analytics.ts` | Main analytics router | ACTIVE | KEEP - Other non-PdM analytics |
| `domains/ml-analytics/routes/prediction-routes.ts` | ML prediction routes | OVERLAP | REVIEW for consolidation |

### Legacy ML Training/Prediction

| Component | Path | Status | Recommendation |
|-----------|------|--------|----------------|
| `ml-analytics/` | `server/ml-analytics/` | **ACTIVE** | **KEEP** - Core ML operations |
| `ml-analytics/failure-prediction.ts` | Failure prediction logic | ACTIVE | KEEP - Powers new module |
| `ml-ensemble/predict.ts` | Ensemble predictions | ACTIVE | KEEP - ML core |
| `ml-lstm-model/prediction.ts` | LSTM model | ACTIVE | KEEP - ML core |
| `rul-engine/rul-engine.ts` | RUL calculations | ACTIVE | KEEP - Core engine |
| `weibull-rul/analyzer.ts` | Weibull analysis | ACTIVE | KEEP - ML core |

### Legacy Frontend Pages

| Component | Path | Status | Recommendation |
|-----------|------|--------|----------------|
| `pages/pdm-pack.tsx` | PdM Pack page | **OVERLAP** | **DEPRECATE** - Replaced by pdm-dashboard |
| `pages/pdm-equipment-detail.tsx` | Equipment detail | OVERLAP | REVIEW - May merge with new module |
| `pages/ai-health-dashboard.tsx` | AI health view | SEPARATE | KEEP - Different focus |
| `pages/ml-training.tsx` | ML training page | SEPARATE | KEEP - Training UI |
| `components/dashboard/FleetRisksCard.tsx` | Fleet risks widget | OVERLAP | DEPRECATE - New dashboard has this |
| `components/fleet/EquipmentHealthCard.tsx` | Health card | OVERLAP | REVIEW - May consolidate |

### Legacy Frontend Hooks/Utils

| Component | Path | Status | Recommendation |
|-----------|------|--------|----------------|
| `features/maintenance/hooks/usePdmPackData.ts` | PdM pack data | OVERLAP | DEPRECATE - use new hooks |
| `features/analytics/hooks/usePdmEquipmentDetailData.ts` | Equipment detail | REVIEW | May merge |
| `features/maintenance/lib/pdmUtils.ts` | PdM utilities | REVIEW | May keep for shared utils |

---

## 3. DATABASE TABLES

| Table | Schema File | Used By | Status |
|-------|-------------|---------|--------|
| `failure_predictions` | `ml-analytics-core.ts` | Both legacy and new | **KEEP** |
| `equipment` | `equipment.ts` | Both | KEEP |
| `vessels` | `vessels.ts` | Both | KEEP |
| `equipment_heartbeat` | `telemetry-core.ts` | New module | KEEP |
| `work_orders` | `work-orders.ts` | Both | KEEP |
| `cost_models` | `costs.ts` | New module | KEEP |
| `cost_savings` | `costs.ts` | New module | KEEP |
| `ml_models` | `ml-analytics-core.ts` | ML training | KEEP |

---

## 4. SCHEDULED JOBS

| Job | Location | Status | Recommendation |
|-----|----------|--------|----------------|
| Predictive maintenance scheduler | `insights-scheduler.ts` | ACTIVE | KEEP |
| ML retraining scheduler | `insights-scheduler.ts` | ACTIVE | KEEP |
| Failure prediction cron | `bootstrap/schedulers.ts` | ACTIVE | KEEP |

---

## 5. OVERLAP/REPLACEMENT MAPPING

| Legacy Component | New Replacement | Action |
|------------------|-----------------|--------|
| `GET /api/analytics/predictions/fleet-health` | `GET /api/pdm/dashboard` | DEPRECATE legacy |
| `GET /api/analytics/predictions/risk-queue` | `GET /api/pdm/risk-queue` | DEPRECATE legacy |
| `pdm-pack.tsx` page | `pdm-dashboard.tsx` | DEPRECATE legacy page |
| `usePdmPackData.ts` hook | `use-pdm-dashboard.ts` | DEPRECATE legacy hook |
| `FleetRisksCard.tsx` | Built into pdm-dashboard | DEPRECATE if unused elsewhere |

---

## 6. DEPENDENCY CHECK

### Files importing legacy pdm-pack:
- `client/src/App.tsx` - routes to pdm-pack page
- `client/src/config/navigationConfig.ts` - navigation entry

### Files importing legacy analytics predictions:
- Various analytics components (need individual review)

---

## 7. MIGRATION STRATEGY

### Phase 1: Feature Flags (RECOMMENDED)
Add feature flags to toggle between old and new:

```typescript
// shared/config/feature-flags.ts
export const FEATURE_FLAGS = {
  ENABLE_NEW_PDM_DASHBOARD: true,  // Use new pdm-dashboard.tsx
  ENABLE_NEW_PDM_API: true,        // Use /api/pdm/* endpoints
};
```

### Phase 2: Parallel Operation
- Both old and new run simultaneously
- New dashboard becomes default
- Legacy remains accessible for rollback

### Phase 3: Deprecation
- Add console warnings to legacy endpoints
- Remove legacy navigation entries
- Keep legacy code but mark as deprecated

### Phase 4: Cleanup (Future)
- Remove deprecated legacy code after validation period
- Clean up unused database columns if any

---

## 8. SAFE DELETION LIST

### SAFE TO DELETE (No dependencies):
- None identified yet - all have some usage

### DEPRECATE FIRST (Mark deprecated, remove later):
1. `client/src/pages/pdm-pack.tsx`
2. `client/src/features/maintenance/hooks/usePdmPackData.ts`
3. Routes: `GET /api/analytics/predictions/fleet-health`
4. Routes: `GET /api/analytics/predictions/risk-queue`

### KEEP (Active dependencies):
1. All `server/pdm-services/*` - Core ML logic
2. All `server/ml-*` directories - ML pipelines
3. All `server/rul-engine/*` - RUL calculations
4. Database tables - All used by new module

---

## 9. RECOMMENDATIONS

1. **DO NOT DELETE** any backend ML services yet - the new PdM module queries the same `failure_predictions` table that legacy services populate

2. **DEPRECATE** frontend pages/hooks that duplicate new dashboard functionality

3. **ADD FEATURE FLAGS** to allow gradual rollout and easy rollback

4. **UPDATE NAVIGATION** to point to new dashboard as primary, keep old as "Legacy" option

5. **MONITOR USAGE** before any deletion - add analytics to track which endpoints are called

---

*Last Updated: 2026-01-07*
*Author: ARUS Development Team*
