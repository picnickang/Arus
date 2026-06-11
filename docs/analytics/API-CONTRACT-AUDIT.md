# Analytics API Contract Audit

**Date**: November 6, 2025  
**Phase**: Phase 2 - Task A.1  
**Status**: Initial Audit Complete

---

## 🎯 Audit Objective

Document all analytics endpoints, their current request/response shapes, identify inconsistencies, and plan for DTO standardization.

---

## 📊 Analytics Endpoints Inventory

### Category 1: ML Models & Training

#### `/api/analytics/ml-models`

- **Method**: GET
- **Purpose**: List all ML models
- **Auth**: requireOrgId middleware
- **Response Shape**: Array of mlModels
- **Current Issues**: No typed DTO, response shape not documented
- **Priority**: HIGH

#### `/api/analytics/ml-models/:id`

- **Method**: GET
- **Purpose**: Get specific ML model details
- **Response**: Single mlModel object
- **Issues**: No typed response

#### `/api/analytics/ml-models`

- **Method**: POST
- **Purpose**: Create new ML model
- **Request**: Uses `insertMlModelSchema` validation
- **Issues**: ✅ Zod validated (good pattern)

#### `/api/analytics/ml-models/:id`

- **Method**: DELETE
- **Purpose**: Delete ML model
- **Rate Limit**: Critical operation
- **Issues**: None (simple delete)

---

### Category 2: Model Performance & Monitoring

#### `/api/analytics/model-performance`

- **Method**: GET
- **Purpose**: Get model performance metrics
- **Response Shape**: Unknown (needs documentation)
- **Priority**: HIGH

#### `/api/analytics/model-performance/summary`

- **Method**: GET
- **Purpose**: Get aggregated performance summary
- **Response Shape**: Unknown
- **Priority**: HIGH

#### `/api/analytics/model-performance`

- **Method**: POST
- **Purpose**: Record model performance metric
- **Request**: Uses `insertModelPerformanceSchema` (assumed)
- **Issues**: Need to verify request schema

#### `/api/analytics/model-performance/by-equipment-type`

- **Method**: GET
- **Purpose**: Performance metrics grouped by equipment type
- **Response Shape**: Unknown (likely grouped array)
- **Priority**: MEDIUM

---

### Category 3: Feature Analysis

#### `/api/analytics/feature-importance/trends`

- **Method**: GET
- **Purpose**: Track how feature importance changes over time
- **Response Shape**: Time-series data (undocumented)
- **Use Case**: ML explainability dashboards
- **Priority**: MEDIUM

---

### Category 4: Model Quality & Drift

#### `/api/analytics/model-drift`

- **Method**: GET
- **Purpose**: Detect model drift over time
- **Response Shape**: Drift metrics (needs DTO)
- **Use Case**: Alert when model accuracy degrades
- **Priority**: HIGH

#### `/api/analytics/retraining-queue`

- **Method**: GET
- **Purpose**: Models queued for retraining
- **Response Shape**: Array of models needing retraining
- **Priority**: MEDIUM

#### `/api/analytics/model-improvements`

- **Method**: GET
- **Purpose**: Track model improvement history
- **Response Shape**: Historical improvement metrics
- **Priority**: LOW

---

### Category 5: Prediction Feedback Loop

#### `/api/analytics/prediction-feedback`

- **Method**: GET
- **Purpose**: Get prediction feedback from users
- **Response Shape**: Array of feedback records
- **Priority**: MEDIUM

#### `/api/analytics/prediction-feedback`

- **Method**: POST
- **Purpose**: Submit prediction feedback
- **Request**: Uses `insertPredictionFeedbackSchema` (assumed)
- **Issues**: ✅ Zod validated

#### `/api/analytics/prediction-feedback/summary`

- **Method**: GET
- **Purpose**: Aggregated feedback summary
- **Response Shape**: Summary statistics
- **Priority**: LOW

#### `/api/analytics/correction-patterns`

- **Method**: GET
- **Purpose**: Identify common correction patterns
- **Response Shape**: Pattern analysis results
- **Use Case**: Improve model training
- **Priority**: LOW

---

### Category 6: ML Explainability

#### `/api/ml/explainability/predictions/:predictionId`

- **Method**: GET
- **Purpose**: SHAP values and feature contributions for specific prediction
- **Response Shape**: Explainability data structure
- **Use Case**: Show users why model made a prediction
- **Priority**: HIGH

#### `/api/ml/explainability/feature-importances`

- **Method**: GET
- **Purpose**: Global feature importance across all predictions
- **Response Shape**: Feature importance rankings
- **Priority**: MEDIUM

---

### Category 7: Real-Time Predictions

#### `/api/ml/realtime-predictions`

- **Method**: GET
- **Purpose**: Get current real-time predictions
- **Response Shape**: Array of active predictions
- **Use Case**: Live dashboard updates
- **Priority**: HIGH
- **Caching Candidate**: ✅ YES (5-minute TTL)

---

### Category 8: Cost Tracking

#### `/api/analytics/llm-costs`

- **Method**: GET
- **Purpose**: Track LLM API usage costs
- **Response Shape**: Cost records array
- **Priority**: LOW

#### `/api/analytics/llm-costs/summary`

- **Method**: GET
- **Purpose**: Aggregated cost summary
- **Response Shape**: Summary with totals
- **Priority**: LOW

#### `/api/analytics/llm-costs/trends`

- **Method**: GET
- **Purpose**: Cost trends over time
- **Response Shape**: Time-series cost data
- **Priority**: LOW

#### `/api/analytics/llm-costs`

- **Method**: POST
- **Purpose**: Record LLM cost
- **Request**: Cost record schema
- **Issues**: ✅ Zod validated

---

### Category 9: Data Export

#### `/api/analytics/export/ml-pdm-complete`

- **Method**: GET
- **Purpose**: Export complete ML and PdM dataset
- **Response**: Large dataset (CSV or JSON)
- **Issues**: No pagination, could be very large
- **Priority**: MEDIUM

#### `/api/analytics/export/ml-models`

- **Method**: GET
- **Purpose**: Export ML model configurations
- **Response**: Model export format
- **Priority**: LOW

#### `/api/analytics/export/telemetry`

- **Method**: GET
- **Purpose**: Export telemetry data
- **Response**: Telemetry dataset
- **Issues**: Needs date range filtering
- **Priority**: MEDIUM

#### `/api/analytics/export/predictions`

- **Method**: GET
- **Purpose**: Export prediction history
- **Response**: Predictions dataset
- **Priority**: LOW

---

### Category 10: Anomaly Detection

#### `/api/analytics/anomaly-detections`

- **Method**: GET
- **Purpose**: List all anomaly detections
- **Response Shape**: Array of anomaly records
- **Priority**: HIGH
- **Caching Candidate**: ✅ YES (5-minute TTL)

#### `/api/analytics/anomaly-detections/:id`

- **Method**: GET
- **Purpose**: Get specific anomaly details
- **Response**: Single anomaly object
- **Priority**: MEDIUM

#### `/api/analytics/anomaly-detections`

- **Method**: POST
- **Purpose**: Record new anomaly detection
- **Request**: Uses `insertAnomalyDetectionSchema`
- **Issues**: ✅ Zod validated

#### `/api/analytics/anomaly-detections/:id/acknowledge`

- **Method**: PATCH
- **Purpose**: Mark anomaly as acknowledged
- **Request**: Acknowledgment data
- **Priority**: LOW

---

### Category 11: Failure Predictions

#### `/api/analytics/failure-predictions`

- **Method**: GET
- **Purpose**: List all failure predictions
- **Response Shape**: Array of prediction records
- **Priority**: HIGH
- **Caching Candidate**: ✅ YES (15-minute TTL)

#### `/api/analytics/failure-predictions/:id`

- **Method**: GET
- **Purpose**: Get specific failure prediction
- **Response**: Single prediction object with RUL, probability, etc.
- **Priority**: HIGH

#### `/api/analytics/failure-predictions`

- **Method**: POST
- **Purpose**: Create new failure prediction
- **Request**: Uses `insertFailurePredictionSchema`
- **Issues**: ✅ Zod validated

---

### Category 12: Threshold Optimization

#### `/api/analytics/threshold-optimizations`

- **Method**: GET
- **Purpose**: List threshold optimization results
- **Response Shape**: Array of optimization records
- **Priority**: MEDIUM
- **Caching Candidate**: ✅ YES (30-minute TTL)

#### `/api/analytics/threshold-optimizations/:id`

- **Method**: GET
- **Purpose**: Get specific optimization result
- **Response**: Single optimization object
- **Priority**: LOW

#### `/api/analytics/threshold-optimizations`

- **Method**: POST
- **Purpose**: Record threshold optimization
- **Request**: Uses `insertThresholdOptimizationSchema`
- **Issues**: ✅ Zod validated

---

### Category 13: Equipment Analytics

#### `/api/equipment/health`

- **Method**: GET
- **Purpose**: Get health scores for all equipment
- **Response Shape**: Array of equipment health objects
- **Current Shape**:
  ```typescript
  [
    {
      id: string,
      name: string,
      type: string,
      condition: string,
      healthScore: number,
      riskLevel: string,
      lastMaintenanceDate: Date | null,
      nextMaintenanceDate: Date | null,
      alertCount: number,
      operatingHours: number,
      vesselId: string | null,
    },
  ];
  ```
- **Issues**: Response shape not typed, needs DTO
- **Priority**: CRITICAL
- **Caching Candidate**: ✅ YES (5-minute TTL)

#### `/api/equipment/:id/rul`

- **Method**: GET
- **Purpose**: Get Remaining Useful Life prediction for equipment
- **Response Shape**: RUL prediction object
- **Current Shape**:
  ```typescript
  {
    equipmentId: string,
    remainingDays: number,
    confidence: number,
    riskLevel: string,
    dataQuality: number,
    predictionDate: Date,
    methodology: string
  }
  ```
- **Priority**: CRITICAL
- **Caching Candidate**: ✅ YES (15-minute TTL)

#### `/api/equipment/rul/batch`

- **Method**: POST
- **Purpose**: Get RUL for multiple equipment in one request
- **Request**: Array of equipment IDs
- **Response**: Array of RUL predictions
- **Priority**: HIGH
- **Caching Candidate**: ✅ YES (15-minute TTL)

#### `/api/equipment/:id/degradation`

- **Method**: POST
- **Purpose**: Record equipment degradation event
- **Request**: Degradation data
- **Priority**: MEDIUM

#### `/api/equipment/:id/sensor-coverage`

- **Method**: GET
- **Purpose**: Analyze sensor coverage for equipment
- **Response Shape**: Coverage analysis object
- **Current Shape**:
  ```typescript
  {
    equipmentId: string,
    configuredSensors: number,
    activeSensors: number,
    missingSensors: string[],
    coveragePercentage: number,
    recommendations: string[]
  }
  ```
- **Priority**: MEDIUM

#### `/api/equipment/:id/load-distribution`

- **Method**: GET
- **Purpose**: Equipment load distribution analysis
- **Response Shape**: Load distribution metrics
- **Priority**: LOW

---

## 🔍 Issues Identified

### High Priority Issues

1. **No Typed Response DTOs**
   - Most GET endpoints return raw database objects
   - Frontend has no type safety for analytics responses
   - Breaking changes go undetected until runtime

2. **Inconsistent Response Shapes**
   - Some endpoints return arrays directly
   - Others wrap in `{ results: [], metadata: {} }`
   - No standard pagination format

3. **No Caching Strategy**
   - Heavy analytics queries run on every request
   - No Redis caching for expensive computations
   - Dashboard performance degrades with data growth

4. **Missing Documentation**
   - Many response shapes are undocumented
   - Frontend developers guess at response structures
   - API contracts exist only in code

5. **No Org Scoping on Some Endpoints**
   - Need to verify all endpoints enforce orgId filtering
   - Some may have cross-org data leak vulnerabilities

### Medium Priority Issues

1. **Export Endpoints Lack Pagination**
   - `/api/analytics/export/*` endpoints could return massive datasets
   - No streaming or chunking mechanism
   - Risk of memory issues with large exports

2. **Mixed Validation Patterns**
   - POST endpoints use Zod (✅ good)
   - GET endpoints have no query parameter validation
   - Some use req.query directly without validation

3. **No Rate Limiting Differentiation**
   - All analytics reads use `generalApiRateLimit`
   - Heavy queries (exports, real-time predictions) should have stricter limits

### Low Priority Issues

1. **No API Versioning**
   - Breaking changes require coordinated frontend/backend deploys
   - No deprecation path for old clients

2. **Inconsistent Error Responses**
   - Some endpoints return `{ error: string }`
   - Others return `{ message: string, code: string }`
   - Need standardized error DTO

---

## 📋 Recommendations

### Immediate Actions (Week 1-2)

1. **Create Analytics DTO Type Library**
   - File: `shared/analytics-types.ts`
   - Define Zod schemas for all response shapes
   - Generate TypeScript types from schemas
   - Export both schemas and types

2. **Prioritize Critical Endpoints**
   - Start with `/api/equipment/health` (most used)
   - Then `/api/equipment/:id/rul` (critical for PdM)
   - Then `/api/analytics/anomaly-detections` (real-time alerts)
   - Then `/api/ml/realtime-predictions` (dashboard)

3. **Add Redis Caching**
   - Equipment health (5-minute TTL)
   - RUL predictions (15-minute TTL)
   - Anomaly detections (5-minute TTL)
   - Failure predictions (15-minute TTL)
   - Threshold optimizations (30-minute TTL)

### Phase 2 Actions (Week 3-4)

4. **Standardize Response Wrapper**
   - All list endpoints return: `{ results: T[], metadata: { total, page, pageSize, orgId } }`
   - All single endpoints return: `{ result: T, metadata: { orgId, timestamp } }`
   - All mutations return: `{ result: T, metadata: { created, updated } }`

5. **Add Query Parameter Validation**
   - Use Zod to validate GET endpoint query params
   - Standard params: `orgId`, `page`, `pageSize`, `sortBy`, `sortOrder`
   - Filter params specific to each endpoint

6. **Implement Pagination**
   - Add to all list endpoints
   - Use cursor-based pagination for large datasets
   - Include `hasMore` and `nextCursor` in metadata

### Future Enhancements (Week 5+)

7. **API Versioning Strategy**
   - Add `/api/v1/analytics/*` routes
   - Keep legacy routes for backward compatibility
   - Deprecation notices in headers

8. **OpenAPI/Swagger Spec**
   - Generate from Zod schemas
   - Auto-update documentation
   - Interactive API explorer

9. **GraphQL Layer (Optional)**
   - For complex analytics queries
   - Reduce over-fetching
   - Client-side query optimization

---

## 🎯 Success Metrics

### Type Safety

- [ ] 100% of analytics endpoints have typed DTOs
- [ ] Zero `any` types in analytics code
- [ ] Compile-time validation on all API calls

### Performance

- [ ] Equipment health endpoint <100ms (p95)
- [ ] RUL prediction endpoint <200ms (p95)
- [ ] Cache hit rate >80% for analytics

### Documentation

- [ ] All endpoints documented with examples
- [ ] Request/response schemas published
- [ ] Frontend integration guide complete

---

## 📝 Next Steps

1. ✅ **Complete this audit** (DONE)
2. ⏭️ **Create DTO Design Brief** (Task A.2)
3. **Implement DTOs for critical endpoints**
4. **Add caching middleware**
5. **Update frontend to use typed DTOs**

---

**Audit Completed By**: Replit Agent  
**Review Status**: Ready for architect review  
**Next Task**: Phase2-A.2 - Create DTO Design Brief
