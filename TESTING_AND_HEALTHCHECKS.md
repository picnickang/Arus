# ARUS Testing & Health Checks Documentation

## Overview

This document provides comprehensive documentation for the ARUS testing infrastructure, health monitoring systems, and diagnostic capabilities.

## Test Suites

### 1. Engine Room Logbook Tests
**File:** `server/tests/engine-room-logbook.test.ts`
**Category:** Logbook

Tests the engine room logbook auto-fill functionality:
- Auto-fill from telemetry data
- Hourly entry generation
- Generator log entries
- Anomaly detection and thresholds
- Operational mode patterns (sea passage, maneuvering, port)

**Key Assertions:**
- Telemetry sensor mappings match DEFAULT_TELEMETRY_MAPPING
- Anomaly thresholds align with ENGINE_ANOMALY_THRESHOLDS
- Generator electrical parameters within maritime standards
- 24-hour data consistency

### 2. Deck Logbook Tests
**File:** `server/tests/deck-logbook.test.ts`
**Category:** Logbook

Tests deck logbook functionality:
- Weather data generation (wind, sea state, visibility)
- Position/voyage tracking with GPS coordinates
- Fuel consumption logging
- Multi-source data coordination

**Key Assertions:**
- Wind speed in realistic range (0-50 knots)
- Douglas sea state scale values (0-9)
- Barometric pressure in marine range (980-1040 hPa)
- GPS coordinate interpolation accuracy

### 3. STCW Compliance Tests
**File:** `server/tests/stcw-compliance.test.ts`
**Category:** Compliance

Tests STCW Hours of Rest compliance:
- Daily rest requirements (minimum 10 hours in 24)
- 7-day rolling rest requirements (minimum 77 hours)
- Rest period splitting rules (one 6-hour block required)
- Violation severity classification
- Fatigue risk assessment
- Emergency exception handling

**Key Thresholds:**
- `STCW_MIN_REST_24 = 10` hours
- `STCW_MIN_REST_7D = 77` hours
- Maximum 2 rest periods per day
- Minimum one 6-hour continuous rest block

### 4. Work Orders & Inventory Tests
**File:** `server/tests/work-orders-inventory.test.ts`
**Category:** Operations

Tests work order lifecycle and inventory management:
- Work order CRUD operations
- Status transitions (open → in_progress → completed)
- Task checklist management
- Parts consumption tracking
- Inventory stock management
- Work order templates
- Multi-tenant isolation

**Valid Status Transitions:**
```
open → in_progress, cancelled
in_progress → on_hold, completed, cancelled
on_hold → in_progress, cancelled
completed → (none)
cancelled → (none)
```

### 5. Alerts Engine Tests
**File:** `server/tests/alerts-engine.test.ts`
**Category:** Alerts

Tests the alerts and notification system:
- Alert configuration management
- Threshold-based triggering (above, below, equals, deviation)
- Alert lifecycle (trigger → acknowledge)
- Cooldown and deduplication
- Email notification formatting
- WebSocket broadcast channels
- Multi-tenant isolation

**Alert Conditions:**
- `above`: value > threshold
- `below`: value < threshold
- `equals`: value ≈ threshold (±0.001)
- `deviation`: |value - threshold| / threshold > 10%

### 6. Database Integrity Tests
**File:** `server/tests/database-integrity.test.ts`
**Category:** Database

Tests database schema and data integrity:
- Schema validation
- Foreign key enforcement
- Multi-tenant data isolation
- Dual database sync
- Transaction safety
- Data type validation
- Index optimization
- Backup/recovery metadata

### 7. Performance & Stress Tests
**File:** `server/tests/performance-stress.test.ts`
**Category:** Performance

Tests system performance under load:
- Telemetry ingestion throughput (target: 1000 msg/sec)
- API response time SLAs
- Database query performance
- Concurrent request handling
- Memory usage patterns
- Load testing scenarios

**Performance SLAs:**
| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| GET /api/equipment | 50ms | 200ms | 500ms |
| GET /api/telemetry/latest | 30ms | 100ms | 250ms |
| POST /api/work-orders | 100ms | 300ms | 700ms |
| GET /api/alerts | 40ms | 150ms | 400ms |

## Test Helpers

### Logbook Test Simulator
**File:** `server/tests/helpers/logbook-test-simulator.ts`

Extends the vessel simulator with logbook-specific telemetry patterns:

```typescript
// Generate main engine telemetry
const result = generateMainEngineTelemetry({
  equipmentId: 'equip-1',
  vesselId: 'vessel-1',
  orgId: 'org-1',
  startTime: new Date(),
  durationHours: 24,
  operationalMode: 'sea_passage',
  injectAnomalies: [{
    field: 'meExhaustTempPort',
    startHour: 10,
    type: 'high',
    severity: 0.3,
  }],
});

// Generate full day dataset
const fullDay = generateFullDayLogbookTelemetry({
  equipmentId: 'equip-1',
  vesselId: 'vessel-1',
  orgId: 'org-1',
  startTime: new Date(),
  generators: [
    { generatorNumber: 1, isRunning: true, loadPercent: 70 },
    { generatorNumber: 2, isRunning: true, loadPercent: 60 },
  ],
  includeWeather: true,
  includePosition: true,
  includeFuel: true,
});
```

**Available Functions:**
- `generateMainEngineTelemetry()` - Main engine sensor data
- `generateGeneratorTelemetry()` - Generator electrical/thermal data
- `generateWeatherTelemetry()` - Weather conditions
- `generatePositionTelemetry()` - GPS position and speed
- `generateFuelTelemetry()` - Fuel consumption data
- `generateFullDayLogbookTelemetry()` - Complete 24-hour dataset

## Health Check Endpoints

### Primary Health Check
**Endpoint:** `GET /api/diagnostics/health`

Returns comprehensive system health status:
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": { "status": "pass", "responseTimeMs": 15 },
    "telemetry": { "status": "pass", "details": { "bufferUtilization": 25 } },
    "memory": { "status": "pass", "details": { "utilizationPercent": 45 } },
    "services": [{ "name": "telemetry-batch-writer", "status": "running" }]
  }
}
```

### Liveness Probe
**Endpoint:** `GET /api/diagnostics/health/liveness`

Simple alive check for container orchestration:
```json
{ "status": "alive", "timestamp": "2024-01-15T10:00:00.000Z" }
```

### Readiness Probe
**Endpoint:** `GET /api/diagnostics/health/readiness`

Checks if application is ready to receive traffic:
```json
{ "status": "ready", "timestamp": "2024-01-15T10:00:00.000Z" }
```

### System Metrics
**Endpoint:** `GET /api/diagnostics/metrics`

Returns runtime metrics:
```json
{
  "memory": {
    "heapUsedMB": 256,
    "heapTotalMB": 512,
    "externalMB": 32,
    "utilizationPercent": 50
  },
  "uptime": 7200,
  "nodeVersion": "v20.10.0"
}
```

### Telemetry Statistics
**Endpoint:** `GET /api/diagnostics/telemetry/stats`

Returns batch writer performance:
```json
{
  "batchWriter": {
    "totalQueued": 50000,
    "totalWritten": 49900,
    "totalEvicted": 100,
    "currentBufferSize": 150
  },
  "health": {
    "bufferUtilization": 1.5,
    "evictionRate": 0.2,
    "writeSuccessRate": 99.8
  }
}
```

## CI/CD Pipeline

### Pipeline Jobs

1. **lint** - TypeScript type checking and ESLint
2. **test** - Unit and integration tests
3. **performance-gate** - Performance testing with thresholds
4. **test-logbook** - Engine room and deck logbook tests
5. **test-compliance** - STCW and work order tests
6. **test-alerts** - Alerts engine tests
7. **test-database** - Database integrity tests
8. **test-stress** - Performance stress tests
9. **security** - npm audit and secret scanning
10. **ci-summary** - Aggregated results summary

### Performance Thresholds

| Scenario | Threshold |
|----------|-----------|
| Dashboard | 1600ms |
| Equipment List | 1200ms |
| Equipment Health | 1500ms |
| Work Orders | 1200ms |
| Telemetry Latest | 1500ms |
| DTC Dashboard Stats | 1500ms |

## Diagnostics Dashboard

**Location:** `client/src/pages/DiagnosticsDashboard.tsx`

In-app diagnostics interface with:
- Real-time health status
- Memory and performance metrics
- Telemetry ingestion statistics
- Test suite catalog
- System configuration view

### Dashboard Tabs

1. **Health** - Overall system health, database, telemetry, memory checks
2. **Performance** - Memory usage, uptime, runtime details
3. **Telemetry** - Batch writer statistics, buffer utilization
4. **Tests** - Available test suites and categories
5. **Config** - System configuration and feature flags

## Running Tests

### All Tests
```bash
npx jest --passWithNoTests
```

### Specific Suite
```bash
npx jest server/tests/engine-room-logbook.test.ts
npx jest server/tests/stcw-compliance.test.ts
```

### With Coverage
```bash
npx jest --coverage
```

### Performance Tests Only
```bash
npx jest server/tests/performance-stress.test.ts
```

## Telemetry Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEMETRY_BATCH_INTERVAL_MS` | 500 | Flush interval |
| `TELEMETRY_MAX_BUFFER_SIZE` | 10000 | Max readings in buffer |
| `TELEMETRY_EVICTION_PERCENT` | 0.1 | Eviction percentage |
| `TELEMETRY_MAX_RETRIES` | 3 | Max flush retries |

## Troubleshooting

### High Memory Usage
1. Check `/api/diagnostics/metrics` for heap utilization
2. Review telemetry buffer size in `/api/diagnostics/telemetry/stats`
3. Consider reducing `TELEMETRY_MAX_BUFFER_SIZE`

### Telemetry Evictions
1. Monitor eviction rate in diagnostics dashboard
2. Increase `TELEMETRY_BATCH_INTERVAL_MS` for batch efficiency
3. Increase `TELEMETRY_MAX_BUFFER_SIZE` if memory allows

### Database Connection Issues
1. Check readiness endpoint: `/api/diagnostics/health/readiness`
2. Review database check in `/api/diagnostics/health`
3. Verify `DATABASE_URL` environment variable

### CI Pipeline Failures
1. Check specific test job logs in GitHub Actions
2. Review performance thresholds if performance-gate fails
3. Run failing tests locally with verbose output
