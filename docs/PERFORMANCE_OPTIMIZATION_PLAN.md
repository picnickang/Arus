# ARUS Performance Optimization Plan

**Created**: October 2025  
**Status**: Planning Phase  
**Owner**: Engineering Team

## Executive Summary

This plan outlines a comprehensive 3-phase performance optimization program for the ARUS marine monitoring system, targeting telemetry ingestion, real-time dashboards, and ML workloads across 17 optimization categories.

**Target Improvements:**
- 20% latency reduction in Phase 1 (Month 1)
- 40% latency reduction in Phase 2 (Months 2-3)
- 50-60% overall performance improvement by Phase 3 (Months 4-6)

---

## 1. Goals & Metrics (Define SLAs)

### Performance Targets

| Metric | Current (Baseline) | Target | Critical Threshold |
|--------|-------------------|--------|-------------------|
| **Telemetry Ingest (p95)** | TBD | <150ms | >250ms |
| **Dashboard API (p95)** | TBD | <400ms | >600ms |
| **ML Inference (p95)** | TBD | <2s | >5s |
| **Crew Schedule Jobs** | TBD | <15s | >30s |
| **WebSocket Drop Rate** | TBD | <0.5% | >2% |
| **Background Job Success** | TBD | >99% | <95% |
| **Database CPU** | TBD | <70% | >85% |
| **Queue Latency (p95)** | <1s | <500ms | >2s |
| **Cache Hit Rate** | TBD | >85% | <70% |
| **Service Worker Offline** | TBD | >95% | <90% |

### Business Impact Metrics
- **Dashboard Load Time**: <2s for first contentful paint
- **Telemetry Processing Throughput**: 25 vessels × 919 readings/min (sustained)
- **Concurrent Users**: Support 200+ simultaneous dashboard sessions
- **AI Report Generation**: <5s for standard reports
- **System Uptime**: 99.9% availability

---

## 2. Profile & Benchmark (Baseline Establishment)

### Week 1: Data Collection Setup

**Database Profiling:**
```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Monitor slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Application Profiling:**
- Node.js heap snapshots (weekly)
- Prometheus histogram buckets for all critical endpoints
- Chrome DevTools Performance recordings (dashboard flows)
- WebSocket message timing metrics
- Background job queue depth tracking

**Load Testing Scripts:**
```bash
# k6 telemetry burst test
k6 run --vus 25 --duration 5m tests/load/telemetry-burst.js

# Dashboard concurrency test
k6 run --vus 200 --duration 10m tests/load/dashboard-users.js

# ML inference stress test
k6 run --vus 10 --duration 3m tests/load/ml-predictions.js
```

### Tools & Infrastructure
- **Profiling**: 0x, clinic.js (flamegraphs)
- **Load Testing**: k6, Locust
- **APM**: Prometheus + Grafana dashboards
- **Database**: pg_stat_statements, TimescaleDB chunk monitoring

---

## 3. Identify Bottlenecks (Pareto 80/20 Analysis)

### Top 20% Critical Endpoints (by traffic × latency)

**Tier 1 - Highest Impact:**
1. `POST /api/telemetry` (high volume, time-series writes)
2. `GET /api/dashboard` (high concurrency, complex aggregations)
3. `GET /api/equipment/health` (expensive calculations, joins)
4. `GET /api/telemetry/latest` (frequent polling)
5. `POST /api/ml/predict` (CPU-intensive ML inference)

**Tier 2 - Moderate Impact:**
6. `GET /api/dtc/dashboard-stats` (complex DTC processing)
7. `POST /api/crew/schedule/optimize` (NP-hard scheduling problem)
8. `POST /api/reports/llm/generate` (LLM API latency)
9. WebSocket broadcast operations (backpressure)
10. Background job processors (queue depth)

### Expected Bottleneck Categories

**Database (40% of latency):**
- Full table scans on `equipment_telemetry` (919 records)
- Missing composite indexes on hot query patterns
- Timescale chunk misalignment
- Connection pool exhaustion (max connections hit)

**CPU-Intensive Operations (30%):**
- ML model predictions (LSTM + Random Forest)
- Vibration FFT analysis
- Crew scheduling optimization (combinatorial)
- LLM context building

**Network I/O (20%):**
- OpenAI API calls (200-800ms external latency)
- Large JSON payloads (dashboard metrics)
- WebSocket message serialization

**Memory/GC (10%):**
- Large query result sets held in memory
- Job history cache unbounded growth
- ML model tensor retention

---

## 4. Optimize Algorithms & Data Structures

### Telemetry Pipeline Enhancements

**Current:**
```typescript
// Individual inserts - slow
for (const reading of readings) {
  await db.insert(equipmentTelemetry).values(reading);
}
```

**Optimized:**
```typescript
// Vectorized batch insert with COPY protocol
await db.execute(sql`
  COPY equipment_telemetry (org_id, equipment_id, sensor_type, value, unit, ts)
  FROM stdin WITH (FORMAT csv)
`);
// Expected: 10-20x throughput improvement
```

### Dashboard Aggregation Strategy

**Current:**
```sql
-- Real-time aggregation on every request
SELECT AVG(value), MAX(value), equipment_id
FROM equipment_telemetry
WHERE ts > NOW() - INTERVAL '5 minutes'
GROUP BY equipment_id;
```

**Optimized:**
```sql
-- Use TimescaleDB continuous aggregate (pre-computed)
CREATE MATERIALIZED VIEW telemetry_5m_rollup
WITH (timescaledb.continuous) AS
SELECT time_bucket('5 minutes', ts) AS bucket,
       equipment_id, sensor_type,
       avg(value) AS avg_value,
       max(value) AS max_value,
       count(*) AS sample_count
FROM equipment_telemetry
GROUP BY bucket, equipment_id, sensor_type;

-- Auto-refresh policy
SELECT add_continuous_aggregate_policy('telemetry_5m_rollup',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');
```
**Expected Impact**: 70-80% faster dashboard queries

### Health Score Computation

**Current:** Recalculate on every request (O(n) per equipment)

**Optimized:** Incremental materialized view updated on telemetry insert
```sql
CREATE MATERIALIZED VIEW equipment_health_scores AS
SELECT 
  equipment_id,
  CASE 
    WHEN pdm_score > 80 THEN 'critical'
    WHEN pdm_score > 60 THEN 'warning'
    ELSE 'healthy'
  END as health_status,
  last_reading_ts,
  avg_health_score
FROM ... JOIN ... WHERE ...;

-- Refresh on schedule or trigger
REFRESH MATERIALIZED VIEW CONCURRENTLY equipment_health_scores;
```

### Crew Scheduler Optimization

**Current:** Cold start OR-Tools solver on every run

**Optimized:**
- Warm start from previous solution
- Incremental constraint propagation
- Time limit enforcement (max 15s)
- Heuristic shortcuts for common patterns

**Expected Impact**: 40-60% faster scheduling

### ML Feature Set Pruning

**Current:** 50+ features for Random Forest prediction

**Optimized:**
- Feature importance analysis → keep top 20 features
- Correlation pruning (r > 0.9)
- Cached feature vectors per equipment

**Expected Impact**: 30-40% faster inference

---

## 5. Improve I/O and Database Efficiency

### TimescaleDB Optimizations

**Compression Policy:**
```sql
-- Compress data older than 7 days
ALTER TABLE equipment_telemetry SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'equipment_id, sensor_type',
  timescaledb.compress_orderby = 'ts DESC'
);

SELECT add_compression_policy('equipment_telemetry', INTERVAL '7 days');
```
**Expected Impact**: 80-90% storage reduction, 2-4x query speedup on old data

**Adaptive Chunk Sizing:**
```sql
-- Optimize chunk interval based on data volume
SELECT set_chunk_time_interval('equipment_telemetry', INTERVAL '1 day');
-- Adjust based on actual ingestion rate
```

**Index Coverage Analysis:**
```sql
-- Identify missing indexes (from db-indexes.ts)
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public' 
  AND tablename IN ('equipment_telemetry', 'work_orders', 'alerts')
ORDER BY abs(correlation) DESC;
```

**Critical Indexes to Add:**
```sql
-- Composite indexes for hot query patterns
CREATE INDEX CONCURRENTLY idx_telemetry_equipment_ts_sensor 
  ON equipment_telemetry (equipment_id, ts DESC, sensor_type);

CREATE INDEX CONCURRENTLY idx_work_orders_status_vessel 
  ON work_orders (status, vessel_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_alerts_equipment_unacked 
  ON alert_notifications (equipment_id, acknowledged, created_at DESC) 
  WHERE acknowledged = false;
```

**Bulk DTC Ingestion:**
```typescript
// Use COPY protocol for diagnostic trouble codes
const csvData = dtcRecords.map(r => 
  `${r.spn},${r.fmi},${r.occurrence_count},${r.timestamp}`
).join('\n');

await db.execute(sql`
  COPY j1939_dtc_events (spn, fmi, occurrence_count, ts)
  FROM stdin WITH (FORMAT csv)
`, csvData);
```

**Logical Replication for ML Training:**
```sql
-- Extract telemetry for ML without impacting production
CREATE PUBLICATION ml_training_feed FOR TABLE equipment_telemetry;
-- Subscriber reads from replica slot
```

**Partition Pruning:**
```sql
-- Enable automatic partition pruning for queries with time filters
SET enable_partition_pruning = ON;
```

---

## 6. Add or Tune Caching Layers

### TanStack Query Cache Tuning

**Current Configuration:**
```typescript
export const CACHE_TIMES = {
  REALTIME: 30 * 1000,    // 30 seconds
  MODERATE: 5 * 60 * 1000, // 5 minutes
  STABLE: 30 * 60 * 1000,  // 30 minutes
};
```

**Optimized Configuration:**
```typescript
export const CACHE_TIMES = {
  REALTIME: 60 * 1000,     // 60s (dashboard widgets)
  MODERATE: 5 * 60 * 1000, // 5min (work orders)
  STABLE: 60 * 60 * 1000,  // 60min (vessel list, equipment registry)
  EXTENDED: 24 * 60 * 60 * 1000, // 24h (static data, settings)
};
```

**Strategy by Endpoint:**
| Endpoint | Cache TTL | Rationale |
|----------|-----------|-----------|
| `/api/dashboard` | 60s | Balance freshness vs load |
| `/api/equipment/health` | 60s | Pre-aggregated data acceptable |
| `/api/vessels` | 60min | Rarely changes |
| `/api/telemetry/latest` | 30s | True real-time needed |
| `/api/reports/llm/*` | 24h | Expensive to regenerate |

### Redis Result Cache (NEW)

**Implementation:**
```typescript
// Health summary cache
const cacheKey = `health:${orgId}:${vesselId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await storage.getEquipmentHealth(orgId, vesselId);
await redis.setex(cacheKey, 60, JSON.stringify(result)); // 60s TTL
return result;
```

**High-Value Cache Targets:**
- Dashboard metrics summary (60s TTL)
- Equipment health aggregates (60s TTL)
- DTC dashboard stats (120s TTL)
- Fleet overview (300s TTL)

**Expected Impact**: 50-70% reduction in database queries

### PostgreSQL Query Plan Cache

```sql
-- Enable prepared statement caching
SET plan_cache_mode = 'force_generic_plan';

-- For hot queries, use explicit PREPARE
PREPARE get_equipment_health AS
SELECT equipment_id, health_score, last_reading
FROM equipment_health_scores
WHERE org_id = $1 AND vessel_id = $2;
```

### AI Report Summary Cache

**Object Storage Strategy:**
```typescript
// Cache LLM reports in Replit Object Storage
const reportKey = `reports/${reportType}/${orgId}/${hash}.json`;
const ttl = 24 * 60 * 60; // 24 hours

// Check cache first
const cached = await objectStorage.get(reportKey);
if (cached && !isExpired(cached.timestamp, ttl)) {
  return cached.report;
}

// Generate and cache
const report = await llmService.generateReport(...);
await objectStorage.put(reportKey, { report, timestamp: Date.now() });
```

**Expected Impact**: 90% cache hit rate on recurring reports

### Service Worker Cache Tuning

**Current:**
```javascript
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
```

**Optimized by Tier:**
```javascript
const CACHE_POLICIES = {
  static: { maxAge: 7 * 24 * 60 * 60 * 1000 },  // 7 days
  api_stable: { maxAge: 60 * 60 * 1000 },       // 1 hour
  api_realtime: { maxAge: 30 * 1000 },          // 30 seconds
  api_critical: { maxAge: 0 }                   // No cache
};
```

---

## 7. Optimize Concurrency & Parallelism

### Background Job Queue Scaling

**Current:**
```typescript
const jobQueue = new BackgroundJobQueue({
  maxConcurrentJobs: 3,
  maxHistorySize: 1000
});
```

**Optimized:**
```typescript
const jobQueue = new BackgroundJobQueue({
  maxConcurrentJobs: 6,  // Increased from 3
  maxHistorySize: 500,   // Reduce memory footprint
  workStealingEnabled: true // NEW: Balance load across workers
});
```

### Telemetry Ingestion Worker Pool

**Architecture:**
```
Client → Load Balancer → [Worker 1, Worker 2, Worker 3, Worker 4] → DB Pool
```

**Implementation:**
```typescript
import { Worker } from 'worker_threads';

const workerPool = new WorkerPool({
  workerScript: './telemetry-worker.js',
  poolSize: 4, // Match CPU cores
  maxQueueSize: 10000
});

// Route telemetry to worker pool
app.post('/api/telemetry', async (req, res) => {
  await workerPool.execute({ type: 'ingest', data: req.body });
  res.status(202).json({ queued: true });
});
```

### WebSocket Broadcast Optimization

**Current:** Individual message send per client

**Optimized:** Shared buffer with batch broadcast
```typescript
class TelemetryWebSocketServer {
  private broadcastBuffer: Map<string, any[]> = new Map();
  
  broadcastBatched(channel: string, data: any) {
    if (!this.broadcastBuffer.has(channel)) {
      this.broadcastBuffer.set(channel, []);
    }
    this.broadcastBuffer.get(channel)!.push(data);
  }
  
  // Flush every 100ms
  startBatchFlush() {
    setInterval(() => {
      for (const [channel, messages] of this.broadcastBuffer) {
        const payload = JSON.stringify({ type: 'batch', messages });
        this.broadcast(channel, payload);
      }
      this.broadcastBuffer.clear();
    }, 100);
  }
}
```

### ML Inference Worker Pool

**Current:** Sequential prediction on main thread

**Optimized:**
```typescript
const mlWorkerPool = new WorkerPool({
  workerScript: './ml-inference-worker.js',
  poolSize: Math.max(2, os.cpus().length - 1) // Leave 1 core for main
});

// Parallel predictions for multiple equipment
const predictions = await Promise.all(
  equipmentIds.map(id => 
    mlWorkerPool.execute({ equipmentId: id, features })
  )
);
```

### Database Connection Pooling

**PgBouncer Configuration:**
```ini
[databases]
arus = host=localhost port=5432 dbname=arus

[pgbouncer]
pool_mode = transaction
max_client_conn = 200
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
```

**Expected Impact**: Support 200 concurrent connections with 25 DB connections

---

## 8. Reduce Memory Footprint

### Node.js Heap Profiling Strategy

**Tools:**
```bash
# Generate heap snapshot
node --inspect server/index.ts
# Chrome DevTools → Memory → Take Heap Snapshot

# Profile with clinic.js
clinic heapprof -- node server/index.ts
```

**Target Areas:**
1. Job history cache (unbounded growth)
2. Large query result sets
3. ML model tensor retention
4. WebSocket message buffers

### Background Job History Limit

**Current:**
```typescript
private jobHistory: JobResult[] = [];
private maxHistorySize = 1000;
```

**Optimized:**
```typescript
private jobHistory: JobResult[] = [];
private maxHistorySize = 100; // Reduced 10x
private historyRetentionMs = 1 * 60 * 60 * 1000; // 1 hour

// Periodic cleanup
setInterval(() => {
  const cutoff = Date.now() - this.historyRetentionMs;
  this.jobHistory = this.jobHistory.filter(
    j => j.completedAt.getTime() > cutoff
  );
}, 5 * 60 * 1000); // Every 5 minutes
```

### Streaming Large Exports

**Current:**
```typescript
// Load entire dataset into memory
const allData = await storage.getAllTelemetry(orgId);
res.json(allData); // Huge memory spike
```

**Optimized:**
```typescript
// Stream data in chunks
res.setHeader('Content-Type', 'application/json');
res.write('[');

let first = true;
for await (const chunk of storage.streamTelemetry(orgId, { batchSize: 1000 })) {
  if (!first) res.write(',');
  res.write(JSON.stringify(chunk));
  first = false;
}
res.write(']');
res.end();
```

### ML Model Tensor Cleanup

**Optimized:**
```typescript
class MLAnalyticsService {
  async predict(equipmentId: string, features: number[]) {
    const model = await this.loadModel('lstm-failure');
    try {
      const prediction = await model.predict(features);
      return prediction;
    } finally {
      // Critical: Release GPU/CPU tensors
      model.dispose();
    }
  }
}
```

### React Query Cache Size Limit

**Configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 5 * 60 * 1000,
      staleTime: 30 * 1000,
    },
  },
  // NEW: Limit cache size
  queryCache: new QueryCache({
    onSuccess: (data, query) => {
      // Evict old queries when cache grows too large
      if (queryClient.getQueryCache().getAll().length > 100) {
        queryClient.getQueryCache().clear();
      }
    }
  })
});
```

### WebSocket Payload Compression

**Implementation:**
```typescript
import zlib from 'zlib';

// Compress large payloads before sending
if (payload.length > 1024) {
  const compressed = zlib.gzipSync(JSON.stringify(payload));
  ws.send(compressed, { binary: true });
} else {
  ws.send(JSON.stringify(payload));
}
```

---

## 9. Refactor Architecture & Boundaries

### Domain Module Extraction (from REFACTORING_PLAN.md)

**Current Monoliths:**
- `server/routes.ts` (13,731 lines → 422 endpoints)
- `server/storage.ts` (14,024 lines → 648 methods)

**Target Architecture:**
```
server/
├── routes/
│   ├── telemetry-routes.ts      (ingestion, latest, replay)
│   ├── dashboard-routes.ts      (metrics, health, fleet)
│   ├── analytics-routes.ts      (47 ML/analytics endpoints)
│   ├── crew-routes.ts           (28 crew management endpoints)
│   ├── equipment-routes.ts      (19 equipment CRUD endpoints)
│   └── work-order-routes.ts     (16 work order endpoints)
├── storage/
│   ├── domains/
│   │   ├── telemetry-repository.ts
│   │   ├── maintenance-repository.ts
│   │   ├── crew-repository.ts
│   │   ├── analytics-repository.ts
│   │   └── admin-repository.ts
│   └── index.ts (IStorage facade)
└── services/
    ├── telemetry-ingestion-service.ts
    ├── ml-prediction-service.ts
    └── scheduler-service.ts
```

**Migration Strategy:**
1. Extract analytics routes first (47 endpoints, most isolated)
2. Extract crew routes (28 endpoints)
3. Continue with remaining domains
4. Apply facade pattern to storage.ts for backward compatibility

**Estimated Effort**: 28-44 hours (see REFACTORING_PLAN.md)

### Microservice Candidate: Telemetry Ingestion

**Justification:**
- High volume, isolated workload
- Different scaling requirements
- Can fail independently without affecting dashboard

**Architecture:**
```
[Edge Devices] → [Ingestion Service] → [Message Queue] → [Storage Worker]
                       ↓
                 [Telemetry DB]
```

### API Gateway Throttling

**Per-Domain Rate Limits:**
```typescript
const domainLimits = {
  telemetry: { windowMs: 60000, max: 1000 },  // High throughput
  dashboard: { windowMs: 60000, max: 300 },   // Moderate
  analytics: { windowMs: 60000, max: 60 },    // Low (expensive)
  admin: { windowMs: 60000, max: 30 }         // Very restrictive
};
```

### Contract Testing for Storage Adapters

**Implementation:**
```typescript
// storage/contracts/ITelemetryRepository.test.ts
describe('ITelemetryRepository Contract', () => {
  let repo: ITelemetryRepository;
  
  beforeEach(() => {
    repo = new DatabaseTelemetryRepository(db);
  });
  
  it('should ingest batch of telemetry within 100ms', async () => {
    const readings = generateTestReadings(100);
    const start = Date.now();
    await repo.ingestBatch(readings);
    expect(Date.now() - start).toBeLessThan(100);
  });
});
```

---

## 10. Clean Code & Dependencies

### Unused SDK Removal

**Analysis:**
```bash
# Find unused dependencies
npx depcheck

# Analyze bundle size
npx vite-bundle-visualizer
```

**Candidates for Removal:**
- Unused AWS SDK modules
- Duplicate utility libraries
- Legacy charting libraries (if replaced)

### Frontend Bundle Optimization

**Current Bundle Analysis:**
```bash
npm run build
# Analyze dist/assets for modules > 1 MB
```

**Tree-Shaking Improvements:**
```typescript
// Before: Import entire library
import _ from 'lodash';

// After: Import specific functions
import { debounce, throttle } from 'lodash-es';
```

**Expected Impact**: 20-30% bundle size reduction

### Package Version Locking

**Critical Stability:**
```json
{
  "dependencies": {
    "prom-client": "15.1.0",     // Lock exact version
    "@neondatabase/serverless": "0.9.0",
    "drizzle-orm": "0.30.0",
    "@tensorflow/tfjs-node": "4.17.0"
  }
}
```

### Refactor Duplicated Utility Functions

**Current:** Health score calculation duplicated 5× across files

**Consolidated:**
```typescript
// server/utils/health-calculations.ts
export function calculateEquipmentHealth(
  pdmScore: number,
  telemetryAge: number,
  dtcSeverity: number
): number {
  // Centralized algorithm
  const baseHealth = 100 - pdmScore;
  const ageDeduction = Math.min(telemetryAge / 300, 20);
  const dtcDeduction = dtcSeverity * 10;
  return Math.max(0, baseHealth - ageDeduction - dtcDeduction);
}
```

---

## 11. Test Performance & Regressions

### k6 Load Test Suite

**Structure:**
```
tests/load/
├── telemetry-burst.js       (Ingest 25 vessels × 919 readings/min)
├── dashboard-concurrency.js (200 concurrent users)
├── ml-inference-stress.js   (10 parallel predictions)
├── crew-scheduler.js        (Optimization job completion)
└── websocket-load.js        (Real-time message throughput)
```

**Example Test:**
```javascript
// tests/load/telemetry-burst.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 25 },  // Ramp up
    { duration: '3m', target: 25 },  // Sustain
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration{endpoint:telemetry}': ['p(95)<150'], // SLA
    'http_req_failed': ['rate<0.01'], // <1% error rate
  },
};

export default function () {
  const payload = JSON.stringify({
    orgId: 'default-org-id',
    equipmentId: `equip-${__VU}`,
    sensorType: 'temperature',
    value: Math.random() * 100,
    unit: 'C',
    ts: new Date().toISOString()
  });
  
  const res = http.post('http://localhost:5000/api/telemetry', payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'telemetry' },
  });
  
  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 150ms': (r) => r.timings.duration < 150,
  });
}
```

### GitHub Actions Performance Gate

**Workflow:**
```yaml
# .github/workflows/perf-test.yml
name: Performance Regression Check

on:
  pull_request:
    branches: [main]

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Database
        run: |
          docker-compose up -d postgres
          npm run db:push
      
      - name: Run k6 Tests
        run: |
          k6 run --out json=perf-results.json tests/load/telemetry-burst.js
      
      - name: Compare with Baseline
        run: |
          node scripts/compare-perf-results.js \
            --baseline monitoring/perf-baseline.json \
            --current perf-results.json \
            --threshold 10  # Fail if >10% regression
```

### Baseline Storage

**Structure:**
```
monitoring/
├── perf-baselines/
│   ├── 2025-10-telemetry-burst.json
│   ├── 2025-10-dashboard-load.json
│   └── 2025-10-ml-inference.json
└── perf-reports/
    └── weekly-summary.md
```

---

## 12. Optimize Deployment & Infrastructure

### TimescaleDB Compression Worker

**Enable Compression:**
```sql
-- Already defined in db-utils.ts, ensure enabled
SELECT add_compression_policy('equipment_telemetry', INTERVAL '7 days');

-- Monitor compression status
SELECT * FROM timescaledb_information.compression_settings;
```

### Read Replica for Analytics

**Setup:**
```sql
-- Primary DB: Enable logical replication
ALTER SYSTEM SET wal_level = 'logical';
SELECT pg_reload_conf();

-- Replica: Subscribe to analytics tables
CREATE SUBSCRIPTION analytics_replica
CONNECTION 'host=primary-db port=5432 dbname=arus'
PUBLICATION analytics_feed;
```

**Routing Strategy:**
```typescript
// Route expensive analytics queries to replica
const analyticsDb = drizzle(process.env.ANALYTICS_DATABASE_URL);

app.get('/api/analytics/*', async (req, res) => {
  const data = await analyticsDb.select()... // Use replica
  res.json(data);
});
```

### Node.js Cluster Mode (PM2)

**Configuration:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'arus-api',
    script: 'server/index.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    max_memory_restart: '1G',
    autorestart: true
  }]
};
```

**Launch:**
```bash
pm2 start ecosystem.config.js
pm2 monit  # Real-time monitoring
```

### Kubernetes HPA (Horizontal Pod Autoscaling)

**Configuration:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: arus-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: arus-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
  - type: Pods
    pods:
      metric:
        name: http_request_duration_seconds
      target:
        type: AverageValue
        averageValue: "0.4"  # 400ms target
```

### CDN Edge Caching

**Cloudflare Workers Configuration:**
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Cache static assets at edge
  if (url.pathname.startsWith('/assets/')) {
    const cache = caches.default;
    let response = await cache.match(request);
    
    if (!response) {
      response = await fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=86400'); // 24h
      response = new Response(response.body, { ...response, headers });
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  }
  
  return fetch(request);
}
```

### Container Resource Limits

**Docker Compose:**
```yaml
services:
  api:
    image: arus-api:latest
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

---

## 13. Add Observability (Metrics, Logs, Tracing)

### RED Metrics per Critical Endpoint

**Implementation:**
```typescript
// server/middleware/red-metrics.ts
import { Histogram, Counter } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status_code']
});

const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total HTTP errors',
  labelNames: ['method', 'path', 'error_type']
});

export function redMetricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      path: req.route?.path || req.path,
      status_code: res.statusCode
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    
    if (res.statusCode >= 500) {
      httpRequestErrors.inc({ ...labels, error_type: 'server_error' });
    }
  });
  
  next();
}
```

**Critical Endpoints to Instrument:**
- `/api/telemetry` (ingest)
- `/api/dashboard`
- `/api/equipment/health`
- `/api/ml/predict`
- `/api/crew/schedule/optimize`

### WebSocket Latency Histogram

**Implementation:**
```typescript
const wsMessageLatency = new Histogram({
  name: 'websocket_message_latency_seconds',
  help: 'WebSocket message round-trip latency',
  labelNames: ['channel', 'message_type'],
  buckets: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]
});

// Client-side: Send timestamp
ws.send(JSON.stringify({ 
  type: 'ping', 
  timestamp: Date.now() 
}));

// Server-side: Measure latency
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'pong') {
    const latency = (Date.now() - msg.timestamp) / 1000;
    wsMessageLatency.observe({ 
      channel: msg.channel, 
      message_type: 'pong' 
    }, latency);
  }
});
```

### Background Queue Depth Gauge

**Implementation:**
```typescript
const queueDepthGauge = new Gauge({
  name: 'background_queue_depth',
  help: 'Number of jobs waiting in queue',
  labelNames: ['job_type', 'priority']
});

// Update every 5 seconds
setInterval(() => {
  for (const [jobType, jobs] of jobQueue.getQueuedJobs()) {
    queueDepthGauge.set({ 
      job_type: jobType, 
      priority: 'high' 
    }, jobs.filter(j => j.priority === 'high').length);
    
    queueDepthGauge.set({ 
      job_type: jobType, 
      priority: 'medium' 
    }, jobs.filter(j => j.priority === 'medium').length);
  }
}, 5000);
```

### OpenTelemetry Distributed Tracing

**Setup:**
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: 'http://localhost:14268/api/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();
```

**Trace Critical Paths:**
```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('arus-telemetry');

app.post('/api/telemetry', async (req, res) => {
  const span = tracer.startSpan('telemetry.ingest');
  
  try {
    const validated = await validateTelemetry(req.body);
    span.addEvent('validation.complete');
    
    await storage.ingestTelemetry(validated);
    span.addEvent('storage.complete');
    
    await broadcastUpdate('telemetry', validated);
    span.addEvent('broadcast.complete');
    
    res.status(201).json({ success: true });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
});
```

### ML Inference Metrics

**Implementation:**
```typescript
const mlInferenceLatency = new Histogram({
  name: 'ml_inference_latency_seconds',
  help: 'ML model inference latency',
  labelNames: ['model_type', 'equipment_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const mlCacheHitRate = new Counter({
  name: 'ml_cache_hits_total',
  help: 'ML prediction cache hits',
  labelNames: ['model_type']
});

// In ML service
async predict(equipmentId: string, features: number[]) {
  const cacheKey = `${equipmentId}:${hash(features)}`;
  const cached = this.cache.get(cacheKey);
  
  if (cached) {
    mlCacheHitRate.inc({ model_type: 'lstm' });
    return cached;
  }
  
  const start = Date.now();
  const result = await this.model.predict(features);
  const duration = (Date.now() - start) / 1000;
  
  mlInferenceLatency.observe({ 
    model_type: 'lstm', 
    equipment_type: 'engine' 
  }, duration);
  
  this.cache.set(cacheKey, result, 300); // 5min TTL
  return result;
}
```

---

## 14. Stress & Load Test for Scalability

### Quarterly Soak Test (24-Hour)

**Scenario:**
```javascript
// tests/load/soak-test.js
export const options = {
  stages: [
    { duration: '30m', target: 100 },  // Warm up
    { duration: '23h', target: 100 },  // Sustain for 23 hours
    { duration: '30m', target: 0 },    // Cool down
  ],
  thresholds: {
    'http_req_duration{endpoint:dashboard}': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
    'websocket_messages_total': ['count>10000000'],
  },
};

export default function () {
  // Mixed workload
  if (Math.random() < 0.7) {
    // 70% dashboard requests
    http.get('http://localhost:5000/api/dashboard');
  } else if (Math.random() < 0.9) {
    // 20% telemetry ingestion
    http.post('http://localhost:5000/api/telemetry', telemetryPayload);
  } else {
    // 10% analytics queries
    http.get('http://localhost:5000/api/analytics/health-trends');
  }
  
  sleep(1); // 1 RPS per VU
}
```

### Burst Test (5× Normal Load)

**Scenario:**
```javascript
// tests/load/burst-test.js
export const options = {
  scenarios: {
    telemetry_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 500,
      stages: [
        { duration: '1m', target: 100 },   // Normal
        { duration: '30s', target: 500 },  // 5× Burst
        { duration: '2m', target: 500 },   // Sustain
        { duration: '1m', target: 100 },   // Return to normal
      ],
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<200'],  // Degradation acceptable
    'http_req_failed': ['rate<0.05'],    // Up to 5% errors OK
  },
};
```

### Chaos Engineering Drills

**Database Failover:**
```bash
# Simulate primary DB failure
docker-compose stop postgres-primary

# Monitor:
# - Circuit breaker activation
# - Automatic failover to replica
# - Recovery time (target: <30s)
# - Data loss (target: 0 committed transactions)
```

**WebSocket Backpressure:**
```javascript
// Inject slow client
ws.on('message', (data) => {
  // Artificially delay processing
  setTimeout(() => {
    processMessage(data);
  }, 5000); // 5s delay
});

// Monitor:
// - Server-side buffering
// - Memory usage
// - Client disconnection
// - Message loss rate
```

**Network Partition:**
```bash
# Simulate 50% packet loss
tc qdisc add dev eth0 root netem loss 50%

# Monitor:
# - Retry behavior
# - Timeout handling
# - Circuit breaker triggering
# - User experience degradation
```

---

## 15. Add Reliability Patterns (Retries, Circuit Breakers)

### Enhanced Retry Logic

**Current Implementation:**
```typescript
// error-handling.ts already has basic retry
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T>
```

**Optimized with Jittered Exponential Backoff:**
```typescript
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterFactor?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 5000,
    jitterFactor = 0.3,
    onRetry
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        break; // No more retries
      }
      
      // Exponential backoff with jitter
      const exponentialDelay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs
      );
      const jitter = exponentialDelay * jitterFactor * (Math.random() - 0.5);
      const delay = exponentialDelay + jitter;
      
      onRetry?.(attempt, lastError);
      
      // Emit Prometheus metric
      retryAttemptCounter.inc({ 
        operation: operation.name, 
        attempt 
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

### Circuit Breaker State Exposure

**Current:** Internal state only

**Enhanced:**
```typescript
// GET /api/health/circuit-breakers
app.get('/api/health/circuit-breakers', (req, res) => {
  const states = circuitBreaker.getAllStates();
  res.json({
    services: Object.entries(states).map(([name, state]) => ({
      name,
      state: state.state,
      failures: state.failures,
      lastFailure: state.lastFailureTime,
      successCount: state.successCount
    }))
  });
});

// Prometheus metric
const circuitBreakerStateGauge = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['service'],
});

// Update every 10 seconds
setInterval(() => {
  for (const [service, state] of Object.entries(circuitBreaker.getAllStates())) {
    const stateValue = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 }[state.state];
    circuitBreakerStateGauge.set({ service }, stateValue);
  }
}, 10000);
```

### Dead Letter Queue for Failed Jobs

**Implementation:**
```typescript
class BackgroundJobQueue {
  private deadLetterQueue: Map<string, JobData> = new Map();
  
  private async processJob(job: JobData): Promise<void> {
    try {
      await this.executeJob(job);
    } catch (error) {
      job.attempts++;
      
      if (job.attempts >= job.maxAttempts) {
        // Move to dead letter queue
        this.deadLetterQueue.set(job.id, {
          ...job,
          error: error.message,
          failedAt: new Date()
        });
        
        // Alert on critical job failures
        if (job.priority === 'critical') {
          await sendAlert({
            type: 'job_failure',
            jobId: job.id,
            jobType: job.type,
            error: error.message
          });
        }
        
        // Emit metric
        jobFailureCounter.inc({ 
          job_type: job.type, 
          priority: job.priority 
        });
      } else {
        // Retry with backoff
        await this.retryJob(job);
      }
    }
  }
  
  // Admin endpoint to inspect/retry failed jobs
  getDeadLetterQueue(): JobData[] {
    return Array.from(this.deadLetterQueue.values());
  }
  
  async retryDeadLetter(jobId: string): Promise<void> {
    const job = this.deadLetterQueue.get(jobId);
    if (job) {
      job.attempts = 0; // Reset
      this.deadLetterQueue.delete(jobId);
      await this.addJob(job.type, job.payload);
    }
  }
}
```

### Idempotent Keys for Telemetry Batches

**Implementation:**
```typescript
// Prevent duplicate telemetry insertion
app.post('/api/telemetry/batch', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  
  if (!idempotencyKey) {
    return res.status(400).json({ 
      error: 'Idempotency-Key header required' 
    });
  }
  
  // Check if already processed
  const cached = await redis.get(`idempotency:${idempotencyKey}`);
  if (cached) {
    idempotencyHitCounter.inc({ endpoint: '/api/telemetry/batch' });
    return res.status(200).json(JSON.parse(cached));
  }
  
  // Process batch
  const result = await storage.ingestTelemetryBatch(req.body);
  
  // Cache result for 24 hours
  await redis.setex(
    `idempotency:${idempotencyKey}`, 
    86400, 
    JSON.stringify(result)
  );
  
  res.status(201).json(result);
});
```

---

## 16. Document Changes & Performance Gains

### OPTIMIZATION_SUMMARY.md Template

```markdown
# Performance Optimization Summary

## Phase 1: Quick Wins (Month 1)

### Changes Implemented
1. **Telemetry Batch Ingestion**
   - Before: Individual inserts (~50ms each)
   - After: COPY protocol batch insert (~5ms per 100 records)
   - **Improvement**: 10× throughput increase

2. **Dashboard Cache Tuning**
   - Before: 30s TTL on all queries
   - After: Tiered caching (60s stable, 30s realtime)
   - **Improvement**: 35% reduction in database queries

3. **Background Queue Concurrency**
   - Before: 3 concurrent jobs
   - After: 6 concurrent jobs with work stealing
   - **Improvement**: 2× job throughput

### Metrics Comparison

| Metric | Baseline | Phase 1 | Improvement |
|--------|----------|---------|-------------|
| Telemetry Ingest (p95) | 120ms | 45ms | **62% faster** |
| Dashboard API (p95) | 850ms | 520ms | **39% faster** |
| Queue Latency (p95) | 2.3s | 0.9s | **61% faster** |
| Cache Hit Rate | 68% | 82% | **+14pp** |

### Architecture Diagrams
[Include before/after diagrams of telemetry pipeline]

### Rollback Playbook
If performance degrades:
1. Revert batch size to 100 (from 1000)
2. Restore cache TTL to 30s across all endpoints
3. Scale down queue concurrency to 3
4. Monitor for 15 minutes

## Phase 2: Database Optimization (Months 2-3)
[TBD]

## Phase 3: Architecture Refactoring (Months 4-6)
[TBD]
```

### Decision Log

**Format:**
```markdown
## Decision: Implement TimescaleDB Compression

**Date**: 2025-11-15  
**Status**: Approved  
**Context**: Telemetry table growing at 10 GB/month, query performance degrading  
**Decision**: Enable TimescaleDB compression with 7-day lag policy  
**Consequences**:
- **Positive**: 85% storage reduction, 3× faster queries on old data
- **Negative**: 7-day lag before compression, slight CPU overhead
**Alternatives Considered**: Table partitioning (rejected: more complex)  
**Rollback Plan**: Disable compression policy, data remains accessible
```

---

## 17. Set Up Continuous Performance Monitoring

### Monthly Performance Review Cadence

**Agenda Template:**
1. Review SLA metrics vs targets
2. Analyze p95/p99 latency trends
3. Identify new bottlenecks
4. Prioritize next optimizations
5. Review capacity planning

**Stakeholders:**
- Engineering Lead
- Product Manager
- DevOps Engineer
- On-call Rotation

### Grafana Executive Dashboard

**Panels:**
1. **SLA Compliance** (Red/Green status)
   - Telemetry Ingest p95 <150ms
   - Dashboard API p95 <400ms
   - ML Inference p95 <2s
   
2. **Request Rate & Latency**
   - Stacked area chart: Requests/sec by endpoint
   - Heatmap: Latency distribution over time
   
3. **Resource Utilization**
   - Database CPU (target <70%)
   - Node.js memory usage
   - Connection pool utilization
   
4. **Business Metrics**
   - Active devices
   - Telemetry volume (readings/min)
   - Work orders processed/day
   
5. **Error Rates**
   - HTTP 5xx errors/min
   - Circuit breaker open events
   - Background job failures

**Alert Thresholds:**
```yaml
# Prometheus alerts
groups:
  - name: performance_sla
    rules:
      - alert: TelemetryIngestSlow
        expr: histogram_quantile(0.95, http_request_duration_seconds{path="/api/telemetry"}) > 0.2
        for: 5m
        annotations:
          summary: "Telemetry ingest p95 > 200ms"
          
      - alert: QueueDepthHigh
        expr: background_queue_depth > 20
        for: 10m
        annotations:
          summary: "Background queue depth > 20 jobs"
          
      - alert: MLInferenceFailures
        expr: rate(ml_inference_errors_total[5m]) > 0.02
        for: 5m
        annotations:
          summary: "ML inference failure rate > 2%"
```

### Anomaly Detection on Prometheus Data

**Implementation:**
```python
# scripts/anomaly-detection.py
import pandas as pd
from prophet import Prophet
from prometheus_api_client import PrometheusConnect

prom = PrometheusConnect(url='http://localhost:9090')

# Fetch last 30 days of telemetry ingest latency
metric_data = prom.custom_query_range(
    query='histogram_quantile(0.95, http_request_duration_seconds{path="/api/telemetry"})',
    start_time='30d',
    end_time='now',
    step='1h'
)

# Convert to DataFrame
df = pd.DataFrame(metric_data)
df.columns = ['ds', 'y']

# Train Prophet model
model = Prophet(interval_width=0.95)
model.fit(df)

# Forecast next 7 days
future = model.make_future_dataframe(periods=7*24, freq='H')
forecast = model.predict(future)

# Detect anomalies (values outside 95% confidence interval)
anomalies = df[
    (df['y'] < forecast['yhat_lower']) | 
    (df['y'] > forecast['yhat_upper'])
]

# Alert if anomalies detected
if len(anomalies) > 0:
    send_alert(f"Performance anomaly detected: {len(anomalies)} data points outside normal range")
```

**Schedule:** Run daily at 02:00 UTC

---

## Implementation Timeline

### Phase 1: Quick Wins (Month 1) - Target: 20% Improvement

**Week 1:**
- [ ] Establish performance baselines (profiling + k6 tests)
- [ ] Set up Prometheus + Grafana dashboards
- [ ] Document current SLA metrics

**Week 2:**
- [ ] Implement telemetry batch ingestion (COPY protocol)
- [ ] Tune TanStack Query cache TTLs
- [ ] Increase background queue concurrency to 6

**Week 3:**
- [ ] Add Redis cache for dashboard metrics
- [ ] Optimize equipment health calculation (materialized view)
- [ ] Deploy read replica for analytics queries

**Week 4:**
- [ ] Re-run performance tests
- [ ] Compare metrics vs baseline
- [ ] Document Phase 1 results

**Expected Outcomes:**
- Telemetry ingest: 120ms → 45ms (62% faster)
- Dashboard API: 850ms → 520ms (39% faster)
- Cache hit rate: 68% → 82% (+14pp)

### Phase 2: Database Optimization (Months 2-3) - Target: 40% Improvement

**Month 2:**
- [ ] Enable TimescaleDB compression (7-day policy)
- [ ] Create continuous aggregates (5min rollups)
- [ ] Add missing composite indexes
- [ ] Implement partition pruning

**Month 3:**
- [ ] Deploy PgBouncer connection pooling
- [ ] Optimize slow queries (pg_stat_statements analysis)
- [ ] Implement streaming exports
- [ ] Add query plan caching

**Expected Outcomes:**
- Dashboard API: 520ms → 340ms (60% faster vs baseline)
- Database CPU: 80% → 55% (31% reduction)
- Storage: 100 GB → 20 GB (80% compression)

### Phase 3: Architecture Refactoring (Months 4-6) - Target: 50-60% Improvement

**Month 4:**
- [ ] Extract analytics routes (47 endpoints)
- [ ] Extract crew routes (28 endpoints)
- [ ] Implement domain repositories

**Month 5:**
- [ ] Decouple telemetry ingestion microservice
- [ ] Deploy ML worker pool
- [ ] Implement API gateway throttling

**Month 6:**
- [ ] Complete god file refactoring
- [ ] Deploy Node.js cluster mode (PM2)
- [ ] Set up Kubernetes HPA

**Expected Outcomes:**
- Telemetry ingest: 45ms → 25ms (79% faster vs baseline)
- ML inference: 2.5s → 1.2s (52% faster)
- System can scale to 500 concurrent users

---

## Success Criteria

### Phase 1 (Month 1)
- ✅ Telemetry ingest p95 <100ms
- ✅ Dashboard API p95 <600ms
- ✅ Cache hit rate >80%
- ✅ Background job queue latency <1s

### Phase 2 (Months 2-3)
- ✅ Telemetry ingest p95 <75ms
- ✅ Dashboard API p95 <400ms (SLA target)
- ✅ Database CPU <70% (SLA target)
- ✅ Storage compression >80%

### Phase 3 (Months 4-6)
- ✅ Telemetry ingest p95 <50ms
- ✅ All critical endpoints meet SLA targets
- ✅ System supports 500 concurrent users
- ✅ 99.9% uptime

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Database migration breaks production** | Critical | Low | Test on staging, use `--force` carefully, maintain backups |
| **Cache invalidation bugs** | High | Medium | Comprehensive tests, gradual rollout, monitor cache hit rate |
| **God file refactoring introduces regressions** | High | Medium | Contract tests, incremental extraction, parallel run |
| **TimescaleDB compression causes data loss** | Critical | Very Low | Compression is non-destructive, test on replica first |
| **Increased concurrency exhausts resources** | Medium | Medium | Monitor CPU/memory, implement graceful degradation |

---

## Appendix

### Related Documents
- `REFACTORING_PLAN.md` - God files refactoring strategy
- `replit.md` - System architecture overview
- `server/db-indexes.ts` - Database index definitions
- `server/observability.ts` - Metrics implementation

### Tools & Dependencies
- **Load Testing**: k6, Locust
- **Profiling**: 0x, clinic.js, Chrome DevTools
- **Monitoring**: Prometheus, Grafana
- **APM**: OpenTelemetry (optional)
- **Caching**: Redis (to be added)
- **Database**: PostgreSQL, TimescaleDB

### Contact
- **Performance Lead**: TBD
- **DevOps Contact**: TBD
- **On-call Rotation**: See PagerDuty schedule
