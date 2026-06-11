# ARUS Backend Performance Changes

## Phase 1: Performance Instrumentation

### Added: Request Timing Middleware (`server/middleware/performance.ts`)

A lightweight performance monitoring middleware for Express:

**Features:**

- Request duration tracking (Prometheus histogram)
- Slow request logging (> 200ms default)
- Per-route timing statistics (P50, P95, P99)
- Route normalization (prevents metric cardinality explosion)

**Configuration:**

```bash
# Enable verbose logging
PERF_DEBUG=true

# Adjust slow request threshold (default: 200ms)
SLOW_REQUEST_THRESHOLD_MS=150
```

**Prometheus Metrics:**

- `arus_http_request_duration_ms` - Request duration histogram
- `arus_slow_requests_total` - Counter of slow requests

**API Endpoint:**

```bash
GET /api/performance/stats
```

Returns:

```json
{
  "slowRoutes": [{ "route": "GET /api/equipment/health", "avgMs": 250, "count": 100 }],
  "allRoutes": {
    "GET /api/dashboard": { "count": 500, "avgMs": 45, "p95Ms": 120 }
  },
  "config": {
    "slowThresholdMs": 200,
    "debugEnabled": false
  }
}
```

**Helper Functions:**

```typescript
import { timeDbQuery, getSlowRoutes, resetPerformanceStats } from "./middleware/performance";

// Time a database query
const result = await timeDbQuery("getEquipmentHealth", () => storage.getEquipmentHealth());

// Get top 10 slow routes
const slowRoutes = getSlowRoutes(10);

// Reset statistics
resetPerformanceStats();
```

---

## Phase 3: Backend Caching & Query Optimization (COMPLETED)

### Performance Results

| Endpoint                      | Before (ms) | After Uncached (ms) | After Cached (ms) | Cache TTL |
| ----------------------------- | ----------- | ------------------- | ----------------- | --------- |
| `/api/dashboard`              | 853         | 886                 | 47                | 60s       |
| `/api/dashboard/stcw-summary` | 911         | 265                 | 60                | 5 min     |
| `/api/dtc/dashboard-stats`    | 484         | 221                 | 52                | 60s       |

**Key improvements:**

- 95% latency reduction for cached dashboard requests
- 77% latency reduction for cached STCW requests
- 76% latency reduction for cached DTC stats
- STCW uncached improved from 911ms to 265ms through parallelization

### Changes Made

#### 1. STCW Dashboard Caching (`server/scheduler/stcw-dashboard.ts`)

Added in-memory caching with 5-minute TTL:

```typescript
const stcwCache = new Map<string, { data: any; timestamp: number }>();
const STCW_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

**Parallelization fix**: Changed from sequential `for (vessel of vessels)` to parallel `Promise.all()`:

```typescript
// Before: Sequential (slow)
for (const vessel of vessels) {
  const crewData = await getCrewRestDataForVessel(...);
}

// After: Parallel (fast)
const vesselDataPromises = vessels.map((vessel) =>
  getCrewRestDataForVessel(orgId, vessel.id, startDate, endDate)
);
const vesselDataResults = await Promise.all(vesselDataPromises);
```

#### 2. DTC Dashboard Stats Caching (`server/dtc-integration-service.ts`)

Added in-memory caching with 1-minute TTL:

```typescript
const dtcStatsCache = new Map<string, { data: any; timestamp: number }>();
const DTC_STATS_CACHE_TTL_MS = 60 * 1000; // 1 minute
```

#### 3. Dashboard Metrics (Already Had Caching)

The `/api/dashboard` endpoint already had:

- 60-second TTL caching in routes.ts
- ETag support for 304 responses
- Parallel data fetching with `Promise.all()`

### Database Indexes (Already Created)

29 production indexes are auto-created at startup:

**Telemetry:**

- `idx_equipment_telemetry_equipment_sensor_ts`
- `idx_equipment_telemetry_ts`
- `idx_equipment_telemetry_org_ts`

**Work Orders:**

- `idx_work_orders_equipment_status`
- `idx_work_orders_org_created`
- `idx_work_orders_org_status`

**Crew/STCW:**

- `idx_crew_assignment_crew_date`
- `idx_crew_assignment_org_date`
- `idx_crew_rest_sheet_crew_month`

### Future Optimizations (Low Priority)

1. **Add pagination to logbook endpoints**
2. **Add SELECT field limiting (avoid SELECT \*)**
3. **Use prepared statements for hot paths**

---

## Integration with Observability Stack

The performance middleware integrates with existing:

- **Prometheus**: Request duration histograms
- **Structured Logging**: Slow request alerts
- **Event Loop Monitoring**: Already tracks lag (1s intervals)

---

## Measurement Baseline (Post-Phase 1)

After deployment, collect via `/api/performance/stats`:

### P95 Response Times

- `/api/dashboard`: \_\_\_ms
- `/api/equipment/health`: \_\_\_ms
- `/api/work-orders`: \_\_\_ms
- `/api/logbook/engine`: \_\_\_ms

### Request Counts (per minute)

- Total API requests: \_\_\_
- Slow requests (> 200ms): \_\_\_
