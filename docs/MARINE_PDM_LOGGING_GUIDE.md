# Marine Predictive Maintenance Structured Logging Guide

## Overview

The Marine PdM Logger provides structured, queryable logging specifically designed for marine equipment monitoring, telemetry ingestion, failure prediction, and analytics services. All logs are output in JSON format with marine-specific context fields.

## Installation

```typescript
import {
  logTelemetryIngestion,
  logAnalytics,
  logFailurePrediction,
  logEquipmentMonitoring,
  logInventory,
  logPerformanceMetric,
  withPerformanceLogging,
  logMLMetrics,
  createMarinePdMContext,
  type MarinePdMContext,
} from "@/server/utils/marine-pdm-logger";
```

## Core Logging Functions

### 1. Telemetry Ingestion Logging

Use for logging equipment telemetry data ingestion events:

```typescript
// Log successful telemetry batch ingestion
logTelemetryIngestion("info", "Telemetry batch ingested successfully", {
  orgId: "org-123",
  equipmentId: "main-engine-1",
  equipmentType: "main_engine",
  sensorType: "temperature",
  dataPointCount: 25,
  alertLevel: "normal",
  processingTimeMs: 45,
});

// Log critical threshold breach
logTelemetryIngestion("error", "Critical temperature threshold exceeded", {
  orgId: "org-123",
  equipmentId: "main-engine-1",
  sensorType: "temperature",
  alertLevel: "critical",
  dataPointCount: 1,
});

// Log validation errors
logTelemetryIngestion("warn", "Invalid telemetry data rejected", {
  orgId: "org-123",
  equipmentId: "aux-engine-2",
  dataPointCount: 5,
});
```

**Output Example:**

```json
{
  "timestamp": "2025-11-25T10:30:45.123Z",
  "level": "INFO",
  "message": "Telemetry batch ingested successfully",
  "service": "telemetry-ingestion",
  "orgId": "org-123",
  "equipmentId": "main-engine-1",
  "equipmentType": "main_engine",
  "sensorType": "temperature",
  "dataPointCount": 25,
  "alertLevel": "normal",
  "processingTimeMs": 45
}
```

### 2. Analytics Logging

Use for logging analytics queries, aggregations, and computations:

```typescript
// Log fleet aggregation query
logAnalytics("info", "Fleet telemetry aggregated", {
  orgId: "org-123",
  operation: "fleet-aggregation",
  dataPointCount: 1500,
  processingTimeMs: 125,
  cacheHit: false,
});

// Log cache hit
logAnalytics("info", "Vessel statistics retrieved from cache", {
  orgId: "org-123",
  vesselId: "vessel-456",
  operation: "vessel-stats",
  processingTimeMs: 5,
  cacheHit: true,
});

// Log slow query warning
logAnalytics("warn", "Slow analytics query detected", {
  orgId: "org-123",
  operation: "time-series-aggregation",
  processingTimeMs: 8500,
  dataPointCount: 50000,
});
```

### 3. Failure Prediction Logging

Use for logging ML model predictions and accuracy metrics:

```typescript
// Log prediction generation
logFailurePrediction("info", "Failure prediction generated", {
  orgId: "org-123",
  equipmentId: "main-engine-1",
  modelId: "lstm-hybrid-v2",
  predictionAccuracy: 0.87,
  healthScore: 72.5,
  processingTimeMs: 120,
});

// Log low-confidence prediction warning
logFailurePrediction("warn", "Low confidence prediction", {
  orgId: "org-123",
  equipmentId: "bow-thruster-1",
  modelId: "xgboost-v1",
  predictionAccuracy: 0.62,
  healthScore: 45.0,
});

// Log prediction error
logFailurePrediction("error", "Prediction model execution failed", {
  orgId: "org-123",
  equipmentId: "stern-thruster-2",
  modelId: "lstm-hybrid-v2",
});
```

### 4. Equipment Monitoring Logging

Use for logging equipment health scores and status changes:

```typescript
// Log health score update
logEquipmentMonitoring("info", "Equipment health score updated", {
  orgId: "org-123",
  equipmentId: "main-engine-1",
  equipmentType: "main_engine",
  healthScore: 85.2,
  alertLevel: "normal",
  processingTimeMs: 45,
});

// Log degraded equipment warning
logEquipmentMonitoring("warn", "Equipment health degraded", {
  orgId: "org-123",
  equipmentId: "aux-engine-2",
  healthScore: 55.0,
  alertLevel: "warning",
});
```

### 5. Inventory Management Logging

Use for logging spare parts, stock levels, and reorder events:

```typescript
// Log stock level change
logInventory("info", "Stock level updated", {
  orgId: "org-123",
  operation: "stock-adjustment",
  dataPointCount: 1,
});

// Log low stock warning
logInventory("warn", "Low stock level detected", {
  orgId: "org-123",
  operation: "stock-check",
  alertLevel: "warning",
});
```

## Performance Logging

### Manual Performance Metrics

```typescript
// Log operation duration
logPerformanceMetric("telemetry-ingestion", "batch-insert", 150, {
  orgId: "org-123",
  dataPointCount: 100,
});

// Slow operations (>5000ms) are automatically logged as WARN
logPerformanceMetric("analytics", "complex-aggregation", 6500, {
  orgId: "org-123",
  dataPointCount: 50000,
});
```

### Automatic Performance Wrapper

```typescript
// Wrap async operations for automatic duration logging
const result = await withPerformanceLogging(
  "analytics",
  "fleet-aggregation",
  async () => {
    // Your async operation here
    const data = await db.query.equipmentTelemetry.findMany({
      where: eq(equipmentTelemetry.orgId, orgId),
    });
    return data;
  },
  { orgId: "org-123", dataPointCount: 1500 }
);
// Success: Logs INFO with duration

// Failures are logged as ERROR with error details
await withPerformanceLogging("failure-prediction", "generate-prediction", async () => {
  throw new Error("Model execution failed");
});
// Logs ERROR: "generate-prediction_FAILED" with duration and error stack
```

**Error Log Example:**

```json
{
  "timestamp": "2025-11-25T10:45:30.123Z",
  "level": "ERROR",
  "message": "generate-prediction failed after 120ms",
  "service": "failure-prediction",
  "operation": "generate-prediction_FAILED",
  "processingTimeMs": 120,
  "error": {
    "message": "Model execution failed",
    "name": "Error",
    "stack": "Error: Model execution failed\n    at ..."
  }
}
```

## ML Model Metrics

```typescript
// Log training metrics
logMLMetrics(
  "lstm-hybrid-v2",
  "training",
  {
    accuracy: 0.92,
    precision: 0.89,
    recall: 0.94,
    f1Score: 0.91,
    trainingTimeMs: 45000,
  },
  {
    orgId: "org-123",
    batchSize: 256,
  }
);

// Log prediction metrics
logMLMetrics(
  "xgboost-v1",
  "prediction",
  {
    accuracy: 0.88,
    predictionTimeMs: 12,
  },
  {
    orgId: "org-123",
    equipmentId: "main-engine-1",
  }
);
```

## Express Request Context

```typescript
import { createMarinePdMContext } from "@/server/utils/marine-pdm-logger";

// In Express route handler
app.post("/api/telemetry", async (req, res) => {
  const context = createMarinePdMContext(req, {
    equipmentId: req.body.equipmentId,
    sensorType: req.body.sensorType,
  });

  logTelemetryIngestion("info", "Processing telemetry request", context);

  // Your handler logic...
});
```

## Context Fields Reference

### Core Fields (automatically included)

- `timestamp`: ISO 8601 timestamp
- `level`: INFO, WARN, or ERROR
- `message`: Human-readable log message
- `service`: Service name (auto-populated)

### Marine PdM Context Fields

- `correlationId`: Request correlation ID
- `orgId`: Organization identifier
- `userId`: User identifier (if applicable)
- `equipmentId`: Equipment identifier
- `vesselId`: Vessel identifier
- `equipmentType`: Type of equipment (e.g., "main_engine", "bow_thruster")
- `sensorType`: Sensor type (e.g., "temperature", "pressure", "rpm")
- `dataPointCount`: Number of data points processed
- `processingTimeMs`: Operation duration in milliseconds
- `modelId`: ML model identifier
- `predictionAccuracy`: Model prediction accuracy (0-1)
- `healthScore`: Equipment health score (0-100)
- `alertLevel`: "normal", "warning", or "critical"
- `cacheHit`: Boolean indicating cache hit/miss
- `batchSize`: Batch size for operations
- `operation`: Operation name (e.g., "fleet-aggregation", "batch-insert")

## Query Examples (Log Analysis)

### Find all critical alerts

```bash
grep '"alertLevel":"critical"' application.log | jq .
```

### Find slow operations (>5000ms)

```bash
grep '"processingTimeMs"' application.log | jq 'select(.processingTimeMs > 5000)'
```

### Find telemetry errors by equipment

```bash
grep '"service":"telemetry-ingestion"' application.log | \
  jq 'select(.level == "ERROR") | {equipmentId, message}'
```

### Analyze ML model performance

```bash
grep '"modelId":"lstm-hybrid-v2"' application.log | \
  jq '{accuracy: .predictionAccuracy, timeMs: .processingTimeMs}'
```

### Track cache hit rates

```bash
grep '"cacheHit"' application.log | \
  jq -s 'group_by(.operation) | map({operation: .[0].operation, hits: map(select(.cacheHit == true)) | length, total: length})'
```

## Best Practices

1. **Always include orgId** for multi-tenant filtering
2. **Log performance metrics** for operations >100ms
3. **Use appropriate log levels**:
   - `info`: Normal operations, successful completions
   - `warn`: Degraded performance, validation issues, low confidence predictions
   - `error`: Failures, exceptions, critical issues
4. **Include correlation IDs** for request tracing
5. **Log data quality issues** separately for monitoring
6. **Track equipment-specific metrics** with equipmentId and equipmentType
7. **Measure durations** for all analytics and ML operations

## Integration Example

```typescript
// Complete telemetry ingestion workflow with logging
import {
  logTelemetryIngestion,
  withPerformanceLogging,
  createMarinePdMContext,
} from "@/server/utils/marine-pdm-logger";

app.post("/api/telemetry/batch", async (req, res) => {
  const context = createMarinePdMContext(req, {
    equipmentId: req.body.equipmentId,
    dataPointCount: req.body.readings?.length || 0,
  });

  try {
    // Log incoming request
    logTelemetryIngestion("info", "Telemetry batch received", context);

    // Process with automatic performance logging
    const result = await withPerformanceLogging(
      "telemetry-ingestion",
      "batch-insert",
      async () => {
        // Validate data
        const validatedData = validateTelemetryBatch(req.body);

        // Insert to database
        return await db.insert(equipmentTelemetry).values(validatedData);
      },
      context
    );

    // Log success
    logTelemetryIngestion("info", "Telemetry batch processed successfully", {
      ...context,
      dataPointCount: result.length,
    });

    res.json({ success: true, count: result.length });
  } catch (error) {
    // Log error
    logTelemetryIngestion("error", "Telemetry batch processing failed", context);
    res.status(500).json({ error: "Processing failed" });
  }
});
```

## Log Aggregation

For production deployments, integrate with:

- **CloudWatch Logs** (AWS)
- **Cloud Logging** (GCP)
- **Elasticsearch/Kibana** (ELK Stack)
- **Grafana Loki** (Kubernetes)
- **Datadog** (SaaS monitoring)

All logs are JSON-formatted for easy parsing and indexing.
