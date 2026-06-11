# Phase 2: Analytics & Data Integrity Module Hardening

**Status**: 📋 Planned  
**Estimated Effort**: High (3-4 sprints)  
**Dependencies**: Phase 1 Complete ✅

---

## 🎯 Phase 2 Objectives

Harden analytics APIs and data integrity pipelines with typed contracts, org-scoped caching, schema-driven validation, and reconciliation dashboards. This phase builds on Phase 1's security improvements and extends them to analytics and data quality modules.

### Success Criteria

- ✅ Analytics APIs consolidated behind typed DTOs
- ✅ API contracts aligned with documentation
- ✅ Org-scoped caching for analytics endpoints
- ✅ Schema-driven data quality validation
- ✅ Reconciliation jobs running on schedule
- ✅ Data integrity dashboards operational
- ✅ Frontend harmonized with new DTOs

---

## 📦 Part A: Analytics Module Technical Debt

### Problem Statement

Analytics services (`server/ml-analytics-service.ts`, `server/equipment-analytics-service.ts`) return inconsistent response shapes, lack typed DTOs, and need org-scoped caching for performance at scale.

### Tasks

#### A.1: Analytics API Contract Audit

**Files**: `server/routes.ts`, `docs/audit/api_contract_matrix.md`

**Objectives**:

- Audit all analytics endpoints for contract consistency
- Document current request/response shapes
- Identify inconsistencies and breaking changes needed
- Create migration plan for contract updates

**Deliverables**:

- `docs/analytics/API-CONTRACT-AUDIT.md` - Contract analysis
- `docs/analytics/DTO-DESIGN-BRIEF.md` - Typed DTO specifications

---

#### A.2: Typed DTOs for Analytics

**Files**: `shared/analytics-types.ts` (new), `server/ml-analytics-service.ts`, `server/equipment-analytics-service.ts`

**Objectives**:

- Create typed DTOs for all analytics responses
- Use Zod schemas for validation
- Generate TypeScript types from schemas
- Ensure type safety across frontend/backend

**Example DTO Pattern**:

```typescript
// shared/analytics-types.ts
import { z } from "zod";

export const equipmentHealthResponseSchema = z.object({
  equipmentId: z.string().uuid(),
  healthScore: z.number().min(0).max(100),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  predictions: z.array(
    z.object({
      type: z.string(),
      probability: z.number(),
      timestamp: z.string().datetime(),
    })
  ),
  metadata: z.object({
    orgId: z.string(),
    calculatedAt: z.string().datetime(),
    dataQuality: z.number().min(0).max(1),
  }),
});

export type EquipmentHealthResponse = z.infer<typeof equipmentHealthResponseSchema>;
```

**Deliverables**:

- `shared/analytics-types.ts` - All analytics DTOs
- Updated services with typed responses
- Zod validation on all analytics endpoints

---

#### A.3: Org-Scoped Caching for Analytics

**Files**: `server/middleware/cache-middleware.ts`, `server/analytics/*.ts`

**Objectives**:

- Add Redis caching to heavy analytics endpoints
- Cache keys include orgId for multi-tenant isolation
- 5-minute TTL for real-time data, 30-minute for historical
- Automatic invalidation on data updates

**Cache Strategy**:

```typescript
// Cache keys pattern
analytics:equipment-health:{equipmentId}:{orgId}
analytics:fleet-summary:{orgId}
analytics:predictions:{equipmentId}:{orgId}

// TTL strategy
- Real-time health: 5 minutes
- Historical trends: 30 minutes
- Prediction results: 15 minutes
```

**Deliverables**:

- Analytics endpoints with caching middleware
- Cache invalidation on telemetry updates
- Prometheus metrics for cache performance

---

#### A.4: Analytics Route Contract Alignment

**Files**: `server/routes.ts`, analytics services

**Objectives**:

- Align all analytics routes with documented contracts
- Standardize response formats across endpoints
- Add proper error handling and status codes
- Update `/docs/audit/api_contract_matrix.md`

**Deliverables**:

- Consistent API contracts across all analytics endpoints
- Updated API documentation
- Migration guide for breaking changes (if any)

---

## 📦 Part B: Data Integrity Module Technical Debt

### Problem Statement

Data ingestion validators need schema-driven quality checks, reconciliation jobs to detect data drift, and dashboards to surface integrity issues.

### Tasks

#### B.1: Schema-Driven Data Quality Validation

**Files**: `server/ml-data-preprocessing.ts`, `server/utils/orgIdValidation.ts`, `shared/telemetry-schema.ts` (new)

**Objectives**:

- Define telemetry schemas with Zod for all sensor types
- Extend ingestion validators with schema validation
- Add data quality scoring (completeness, accuracy, timeliness)
- Log quality issues to dead-letter queue

**Validation Matrix**:

```typescript
// Validation layers
1. Schema validation (Zod)
2. Range validation (sensor-specific thresholds)
3. Temporal validation (timestamp ordering)
4. Cross-field validation (dependencies)
5. Statistical outlier detection
```

**Deliverables**:

- `shared/telemetry-schema.ts` - Comprehensive telemetry schemas
- Enhanced `ml-data-preprocessing.ts` with schema validation
- Data quality scoring system (0.0 - 1.0)
- Quality metrics in Prometheus

---

#### B.2: Data Reconciliation Jobs

**Files**: `server/background-jobs.ts`, `server/services/reconciliation-service.ts` (new)

**Objectives**:

- Create reconciliation service to detect data drift
- Scheduled jobs to compare expected vs actual data
- Alert on missing telemetry, duplicate records, stale data
- Automatic correction for known issues

**Reconciliation Checks**:

```typescript
1. Missing Telemetry Detection
   - Expected frequency: 5-minute intervals
   - Alert if >15 minutes gap for critical sensors

2. Duplicate Record Detection
   - Check for identical timestamps
   - Deduplicate using HMAC verification

3. Data Staleness
   - Flag equipment with >24hr data gap
   - Track data freshness by sensor type

4. Cross-System Consistency
   - Verify equipment registry matches telemetry sources
   - Validate org boundaries (no cross-org data)
```

**Deliverables**:

- `server/services/reconciliation-service.ts` - Core service
- Background job scheduled every 6 hours
- Reconciliation results stored in database
- Webhook alerts for critical issues

---

#### B.3: Data Integrity Dashboards

**Files**: `client/src/pages/data-integrity.tsx` (new), `client/src/components/analytics/*.tsx`

**Objectives**:

- Create Data Integrity dashboard page
- Show data quality scores by equipment/sensor
- Display reconciliation results and issues
- Interactive charts for data completeness over time

**Dashboard Components**:

```typescript
1. Quality Score Overview
   - Overall system quality (0-100)
   - Quality by equipment type
   - Trend over 30 days

2. Reconciliation Alerts
   - Missing telemetry alerts
   - Duplicate record count
   - Stale data warnings

3. Data Completeness Chart
   - Timeline visualization
   - Expected vs actual data points
   - Gaps highlighted in red

4. Issue Resolution Tracker
   - Open issues count
   - Auto-resolved count
   - Manual intervention needed
```

**Deliverables**:

- `/data-integrity` page with comprehensive dashboard
- Real-time quality monitoring components
- Integration with reconciliation service
- Export functionality for audit reports

---

## 📦 Part C: Frontend Harmonization

### Tasks

#### C.1: TanStack Query Standardization

**Files**: `client/src/components/analytics/*.tsx`, `client/src/pages/*.tsx`

**Objectives**:

- Audit all analytics components for query patterns
- Normalize query keys to array format (like Phase 1)
- Add proper cache invalidation
- Ensure consistent error handling

**Pattern to Apply**:

```typescript
// Before (inconsistent)
useQuery({ queryKey: `/api/analytics/health/${id}` });

// After (normalized)
useQuery({ queryKey: ["/api/analytics/health", id, orgId] });
```

**Deliverables**:

- All analytics queries using array-format keys
- Consistent cache invalidation across analytics
- No more stale data issues

---

#### C.2: Data-TestID Coverage

**Files**: `client/src/components/analytics/*.tsx`, `client/src/pages/data-integrity.tsx`

**Objectives**:

- Add `data-testid` attributes to all interactive elements
- Follow naming convention: `{action}-{target}-{context}`
- Enable comprehensive E2E testing in Phase 3

**Coverage Areas**:

- Analytics dashboard buttons, filters, charts
- Data integrity dashboard components
- Equipment health displays
- Prediction result cards

**Deliverables**:

- 100% coverage of interactive elements
- Consistent naming pattern across app
- Test ID documentation for QA team

---

#### C.3: Wire New DTO Typings

**Files**: `client/src/lib/api.ts`, analytics components

**Objectives**:

- Update frontend API calls to use new DTOs
- Type-safe request/response handling
- Remove `any` types from analytics code
- Add compile-time validation

**Pattern**:

```typescript
// client/src/lib/api.ts
import { EquipmentHealthResponse } from "@shared/analytics-types";

export async function getEquipmentHealth(
  equipmentId: string,
  orgId: string
): Promise<EquipmentHealthResponse> {
  const response = await apiRequest("GET", `/api/analytics/health/${equipmentId}`, {
    headers: { "x-org-id": orgId },
  });

  return equipmentHealthResponseSchema.parse(response);
}
```

**Deliverables**:

- Fully typed analytics API calls
- Runtime validation with Zod
- Zero `any` types in analytics code
- Improved developer experience

---

## 🔗 Dependencies & Order

### Recommended Execution Order:

**Week 1-2: Analytics Foundation**

1. A.1: Analytics API Contract Audit (understand current state)
2. A.2: Typed DTOs for Analytics (define contracts)
3. B.1: Schema-Driven Data Quality Validation (parallel work)

**Week 3-4: Backend Implementation** 4. A.3: Org-Scoped Caching for Analytics 5. A.4: Analytics Route Contract Alignment 6. B.2: Data Reconciliation Jobs (depends on B.1)

**Week 5-6: Frontend & Dashboards** 7. C.1: TanStack Query Standardization 8. C.2: Data-TestID Coverage 9. B.3: Data Integrity Dashboards (depends on B.2)

**Week 7-8: Integration & Polish** 10. C.3: Wire New DTO Typings (depends on A.2) 11. End-to-end testing of all Phase 2 features 12. Documentation updates and architect review

---

## 📊 Success Metrics

### Performance

- Analytics API response time: <100ms (cached), <500ms (uncached)
- Cache hit rate: >80% for analytics endpoints
- Data quality score: >95% across fleet

### Quality

- Zero `any` types in analytics code
- 100% DTO coverage for analytics APIs
- All analytics queries use normalized cache keys

### Reliability

- Reconciliation jobs running on schedule (0% missed runs)
- <1% false positive rate on data quality alerts
- Data integrity dashboard uptime >99.9%

---

## 🚨 Risk Assessment

### High Risk

- **Breaking API Changes**: Analytics contract alignment may require frontend updates
  - **Mitigation**: Versioned APIs with deprecation notices

### Medium Risk

- **Performance Impact**: Schema validation adds processing overhead
  - **Mitigation**: Optimize hot paths, use caching aggressively

### Low Risk

- **Frontend Migration**: DTO typing is additive, not breaking
  - **Mitigation**: Gradual rollout, component-by-component

---

## 📚 Deliverables Summary

### Documentation

- `docs/analytics/API-CONTRACT-AUDIT.md`
- `docs/analytics/DTO-DESIGN-BRIEF.md`
- `docs/analytics/CACHING-STRATEGY.md`
- `docs/data-integrity/VALIDATION-MATRIX.md`
- `docs/data-integrity/RECONCILIATION-GUIDE.md`

### Code

- `shared/analytics-types.ts` - Typed DTOs
- `shared/telemetry-schema.ts` - Telemetry validation schemas
- `server/services/reconciliation-service.ts` - Reconciliation engine
- `client/src/pages/data-integrity.tsx` - Dashboard page
- Updated analytics services with caching and typing

### Tests

- Unit tests for DTO validation
- Integration tests for reconciliation jobs
- API contract tests for analytics endpoints

---

**Phase 2 Status**: Ready to begin after Phase 1 completion ✅

**Next Step**: Start with Analytics API Contract Audit (A.1) and Schema-Driven Validation (B.1) in parallel.
