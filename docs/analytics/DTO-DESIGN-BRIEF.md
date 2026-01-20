# Analytics DTO Design Brief

**Date**: November 6, 2025  
**Phase**: Phase 2 - Task A.2  
**Status**: Design Complete  
**Dependencies**: API Contract Audit (A.1) ✅

---

## 🎯 Objective

Define comprehensive, type-safe DTOs for all analytics endpoints using Zod schemas. Ensure runtime validation, compile-time type safety, and consistent API contracts across frontend and backend.

---

## 📐 Design Principles

### 1. Schema-First Development
- Define Zod schemas first
- Generate TypeScript types from schemas
- Use same schema for validation and typing

### 2. Metadata Consistency
- All responses include `metadata` object
- Metadata contains: `orgId`, `timestamp`, `version`
- List endpoints add: `total`, `page`, `pageSize`

### 3. Runtime + Compile-Time Safety
- Zod validates at runtime (API boundary)
- TypeScript enforces at compile time (developer experience)
- No `any` types allowed

### 4. Backward Compatibility
- New fields are optional
- Deprecated fields marked with comments
- Version field enables future migrations

---

## 📊 DTO Categories

### Category 1: Equipment Analytics DTOs

#### EquipmentHealthDTO
**Endpoint**: `/api/equipment/health`  
**Purpose**: Current health status for equipment

```typescript
export const equipmentHealthDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  vesselId: z.string().uuid().nullable(),
  vesselName: z.string().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']),
  healthScore: z.number().min(0).max(100),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  lastMaintenanceDate: z.coerce.date().nullable(),
  nextMaintenanceDate: z.coerce.date().nullable(),
  alertCount: z.number().int().min(0),
  operatingHours: z.number().min(0),
  telemetryStatus: z.enum(['active', 'stale', 'offline']),
});

export type EquipmentHealthDTO = z.infer<typeof equipmentHealthDtoSchema>;

export const equipmentHealthResponseSchema = z.object({
  results: z.array(equipmentHealthDtoSchema),
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
    total: z.number().int(),
  }),
});

export type EquipmentHealthResponse = z.infer<typeof equipmentHealthResponseSchema>;
```

---

#### RulPredictionDTO
**Endpoint**: `/api/equipment/:id/rul`, `/api/equipment/rul/batch`  
**Purpose**: Remaining Useful Life predictions

```typescript
export const rulPredictionDtoSchema = z.object({
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  remainingDays: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  dataQuality: z.number().min(0).max(1),
  predictionDate: z.coerce.date(),
  methodology: z.enum(['physics-based', 'ml-hybrid', 'statistical', 'degradation-model']),
  contributingFactors: z.array(z.object({
    factor: z.string(),
    weight: z.number().min(0).max(1),
    impact: z.enum(['positive', 'negative', 'neutral']),
  })),
  maintenanceRecommendations: z.array(z.string()).optional(),
});

export type RulPredictionDTO = z.infer<typeof rulPredictionDtoSchema>;

export const rulPredictionResponseSchema = z.object({
  result: rulPredictionDtoSchema,
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
    calculationTime: z.number().optional(), // milliseconds
  }),
});

export const rulBatchResponseSchema = z.object({
  results: z.array(rulPredictionDtoSchema),
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
    requestedCount: z.number().int(),
    successCount: z.number().int(),
    failedCount: z.number().int(),
  }),
});

export type RulPredictionResponse = z.infer<typeof rulPredictionResponseSchema>;
export type RulBatchResponse = z.infer<typeof rulBatchResponseSchema>;
```

---

#### SensorCoverageDTO
**Endpoint**: `/api/equipment/:id/sensor-coverage`  
**Purpose**: Sensor coverage analysis

```typescript
export const sensorCoverageDtoSchema = z.object({
  equipmentId: z.string().uuid(),
  equipmentType: z.string(),
  totalSensorsExpected: z.number().int(),
  sensorsConfigured: z.number().int(),
  sensorsActive: z.number().int(),
  coveragePercentage: z.number().min(0).max(100),
  missingSensors: z.array(z.object({
    sensorType: z.string(),
    importance: z.enum(['critical', 'recommended', 'optional']),
    reason: z.string(),
  })),
  inactiveSensors: z.array(z.object({
    sensorId: z.string().uuid(),
    sensorType: z.string(),
    lastDataReceived: z.coerce.date().nullable(),
  })),
  recommendations: z.array(z.string()),
});

export type SensorCoverageDTO = z.infer<typeof sensorCoverageDtoSchema>;

export const sensorCoverageResponseSchema = z.object({
  result: sensorCoverageDtoSchema,
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
  }),
});

export type SensorCoverageResponse = z.infer<typeof sensorCoverageResponseSchema>;
```

---

### Category 2: ML Model DTOs

#### MlModelDTO
**Endpoints**: `/api/analytics/ml-models`, `/api/analytics/ml-models/:id`  
**Purpose**: ML model configuration and metadata

```typescript
export const mlModelDtoSchema = z.object({
  id: z.string().uuid(),
  modelType: z.enum(['lstm', 'random-forest', 'xgboost', 'ensemble', 'isolation-forest']),
  targetEquipmentType: z.string().nullable(),
  version: z.string(),
  status: z.enum(['active', 'training', 'testing', 'deprecated', 'failed']),
  accuracy: z.number().min(0).max(1).nullable(),
  precision: z.number().min(0).max(1).nullable(),
  recall: z.number().min(0).max(1).nullable(),
  f1Score: z.number().min(0).max(1).nullable(),
  trainingSamples: z.number().int().min(0).nullable(),
  trainingDate: z.coerce.date().nullable(),
  lastUsedDate: z.coerce.date().nullable(),
  hyperparameters: z.record(z.unknown()).optional(),
  featureImportance: z.record(z.number()).optional(),
});

export type MlModelDTO = z.infer<typeof mlModelDtoSchema>;

export const mlModelListResponseSchema = z.object({
  results: z.array(mlModelDtoSchema),
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
    total: z.number().int(),
  }),
});

export const mlModelResponseSchema = z.object({
  result: mlModelDtoSchema,
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
  }),
});

export type MlModelListResponse = z.infer<typeof mlModelListResponseSchema>;
export type MlModelResponse = z.infer<typeof mlModelResponseSchema>;
```

---

#### ModelPerformanceDTO
**Endpoints**: `/api/analytics/model-performance`, `/api/analytics/model-performance/summary`  
**Purpose**: Track model performance over time

```typescript
export const modelPerformanceDtoSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  modelType: z.string(),
  recordedAt: z.coerce.date(),
  accuracy: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1Score: z.number().min(0).max(1),
  falsePositiveRate: z.number().min(0).max(1),
  falseNegativeRate: z.number().min(0).max(1),
  predictionCount: z.number().int().min(0),
  evaluationDataset: z.string().optional(),
});

export type ModelPerformanceDTO = z.infer<typeof modelPerformanceDtoSchema>;

export const modelPerformanceSummaryDtoSchema = z.object({
  modelId: z.string().uuid(),
  modelType: z.string(),
  currentAccuracy: z.number().min(0).max(1),
  averageAccuracy: z.number().min(0).max(1),
  accuracyTrend: z.enum(['improving', 'stable', 'degrading']),
  predictionVolume: z.number().int(),
  lastEvaluated: z.coerce.date(),
  performanceHistory: z.array(z.object({
    timestamp: z.coerce.date(),
    accuracy: z.number(),
  })).optional(),
});

export type ModelPerformanceSummaryDTO = z.infer<typeof modelPerformanceSummaryDtoSchema>;
```

---

### Category 3: Anomaly Detection DTOs

#### AnomalyDetectionDTO
**Endpoints**: `/api/analytics/anomaly-detections`, `/api/analytics/anomaly-detections/:id`  
**Purpose**: Detected anomalies in telemetry data

```typescript
export const anomalyDetectionDtoSchema = z.object({
  id: z.string().uuid(),
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  sensorType: z.string(),
  detectedAt: z.coerce.date(),
  anomalyType: z.enum(['statistical', 'pattern', 'trend', 'seasonal', 'threshold']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  anomalyScore: z.number().min(0).max(1),
  currentValue: z.number(),
  expectedValue: z.number(),
  deviation: z.number(),
  contributingFactors: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  acknowledged: z.boolean(),
  acknowledgedBy: z.string().nullable(),
  acknowledgedAt: z.coerce.date().nullable(),
  explanation: z.string().optional(),
});

export type AnomalyDetectionDTO = z.infer<typeof anomalyDetectionDtoSchema>;

export const anomalyDetectionListResponseSchema = z.object({
  results: z.array(anomalyDetectionDtoSchema),
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
    total: z.number().int(),
    unacknowledgedCount: z.number().int(),
    criticalCount: z.number().int(),
  }),
});

export type AnomalyDetectionListResponse = z.infer<typeof anomalyDetectionListResponseSchema>;
```

---

### Category 4: Failure Prediction DTOs

#### FailurePredictionDTO
**Endpoints**: `/api/analytics/failure-predictions`, `/api/analytics/failure-predictions/:id`  
**Purpose**: Equipment failure predictions

```typescript
export const failurePredictionDtoSchema = z.object({
  id: z.string().uuid(),
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  equipmentType: z.string(),
  predictionDate: z.coerce.date(),
  failureProbability: z.number().min(0).max(1),
  predictedFailureDate: z.coerce.date().nullable(),
  remainingUsefulLife: z.number().int().min(0), // days
  confidenceInterval: z.object({
    lower: z.number(),
    upper: z.number(),
  }),
  failureMode: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  maintenanceRecommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    estimatedCost: z.number().optional(),
    estimatedDuration: z.number().optional(), // hours
  })),
  costImpact: z.object({
    estimatedRepairCost: z.number(),
    estimatedDowntime: z.number(), // hours
    revenueImpact: z.number(),
  }),
  modelUsed: z.string(),
  modelConfidence: z.number().min(0).max(1),
});

export type FailurePredictionDTO = z.infer<typeof failurePredictionDtoSchema>;

export const failurePredictionListResponseSchema = z.object({
  results: z.array(failurePredictionDtoSchema),
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
    total: z.number().int(),
    highRiskCount: z.number().int(),
    criticalRiskCount: z.number().int(),
  }),
});

export type FailurePredictionListResponse = z.infer<typeof failurePredictionListResponseSchema>;
```

---

### Category 5: Real-Time Prediction DTOs

#### RealtimePredictionDTO
**Endpoint**: `/api/ml/realtime-predictions`  
**Purpose**: Current active predictions for dashboards

```typescript
export const realtimePredictionDtoSchema = z.object({
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  predictionType: z.enum(['failure', 'anomaly', 'degradation', 'performance']),
  value: z.number(),
  confidence: z.number().min(0).max(1),
  status: z.enum(['normal', 'warning', 'critical', 'urgent']),
  updatedAt: z.coerce.date(),
  details: z.object({
    metric: z.string(),
    currentValue: z.number(),
    threshold: z.number(),
    trend: z.enum(['improving', 'stable', 'degrading']),
  }),
});

export type RealtimePredictionDTO = z.infer<typeof realtimePredictionDtoSchema>;

export const realtimePredictionListResponseSchema = z.object({
  results: z.array(realtimePredictionDtoSchema),
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
    totalActive: z.number().int(),
    warningCount: z.number().int(),
    criticalCount: z.number().int(),
    urgentCount: z.number().int(),
  }),
});

export type RealtimePredictionListResponse = z.infer<typeof realtimePredictionListResponseSchema>;
```

---

### Category 6: Explainability DTOs

#### PredictionExplainabilityDTO
**Endpoint**: `/api/ml/explainability/predictions/:predictionId`  
**Purpose**: SHAP values and feature contributions

```typescript
export const featureContributionSchema = z.object({
  featureName: z.string(),
  value: z.number(),
  shapValue: z.number(),
  contribution: z.enum(['positive', 'negative', 'neutral']),
  importance: z.number().min(0).max(1),
});

export const predictionExplainabilityDtoSchema = z.object({
  predictionId: z.string().uuid(),
  equipmentId: z.string().uuid(),
  modelId: z.string().uuid(),
  predictionValue: z.number(),
  baseValue: z.number(), // model's baseline prediction
  featureContributions: z.array(featureContributionSchema),
  topPositiveFactors: z.array(z.object({
    feature: z.string(),
    impact: z.number(),
    explanation: z.string(),
  })),
  topNegativeFactors: z.array(z.object({
    feature: z.string(),
    impact: z.number(),
    explanation: z.string(),
  })),
  humanReadableExplanation: z.string(),
  confidence: z.number().min(0).max(1),
});

export type PredictionExplainabilityDTO = z.infer<typeof predictionExplainabilityDtoSchema>;

export const predictionExplainabilityResponseSchema = z.object({
  result: predictionExplainabilityDtoSchema,
  metadata: z.object({
    orgId: z.string().uuid(),
    timestamp: z.coerce.date(),
    computationTime: z.number(), // milliseconds
  }),
});

export type PredictionExplainabilityResponse = z.infer<typeof predictionExplainabilityResponseSchema>;
```

---

### Category 7: Export DTOs

#### DataExportMetadataDTO
**Endpoints**: `/api/analytics/export/*`  
**Purpose**: Metadata for data export operations

```typescript
export const dataExportMetadataDtoSchema = z.object({
  exportId: z.string().uuid(),
  exportType: z.enum(['ml-models', 'telemetry', 'predictions', 'anomalies', 'complete']),
  requestedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  recordCount: z.number().int().min(0),
  fileSizeBytes: z.number().int().min(0).optional(),
  format: z.enum(['json', 'csv', 'parquet']),
  filters: z.record(z.unknown()).optional(),
  downloadUrl: z.string().url().optional(),
  expiresAt: z.coerce.date().optional(),
});

export type DataExportMetadataDTO = z.infer<typeof dataExportMetadataDtoSchema>;
```

---

## 🏗️ Implementation Strategy

### Phase 1: Create DTOs (Week 1)
1. Create `shared/analytics-types.ts`
2. Implement all DTO schemas
3. Export types for frontend/backend use
4. Add JSDoc comments

### Phase 2: Backend Integration (Week 2)
1. Update routes to use DTOs for response validation
2. Add `.parse()` calls on responses
3. Handle validation errors gracefully
4. Add response time to metadata

### Phase 3: Frontend Integration (Week 3-4)
1. Update API client to use typed DTOs
2. Replace `any` types with DTOs
3. Add runtime validation on responses
4. Update components to use new types

### Phase 4: Testing & Documentation (Week 4)
1. Unit tests for DTO validation
2. Integration tests for API contracts
3. Update API documentation
4. Migration guide for breaking changes

---

## 📏 Validation Rules

### Required Fields
- All IDs must be valid UUIDs
- All timestamps must be valid dates
- All enums must match allowed values

### Number Validations
- Percentages: 0-100
- Probabilities: 0-1
- Counts: >= 0
- Scores: 0-1

### String Validations
- UUIDs: Must pass UUID regex
- Enums: Strict matching
- URLs: Must be valid URLs

---

## 🔄 Migration Path

### Backward Compatibility
- New fields added as optional
- Deprecated fields kept with warnings
- Version field enables gradual migration

### Breaking Changes
- Coordinate frontend/backend deploys
- Use feature flags for rollout
- Provide deprecated field warnings 30 days before removal

---

## ✅ Success Criteria

- [ ] All DTOs defined with Zod schemas
- [ ] 100% type coverage on analytics endpoints
- [ ] Runtime validation on all responses
- [ ] Zero `any` types in analytics code
- [ ] Documentation complete with examples
- [ ] Frontend/backend using same types

---

**Next Step**: Implement DTOs in `shared/analytics-types.ts`
