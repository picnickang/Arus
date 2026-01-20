# Telemetry Performance Architecture

> Audit conducted: 2024-11-28
> Target: 10+ Hz ingestion per vessel, <100ms dashboard latency

## 1. Telemetry Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Edge Devices   │────▶│  MQTT Ingestion  │────▶│   PostgreSQL    │
│  (MQTT/HTTP)    │     │    Service       │     │   TimescaleDB   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Stream Buffer   │
                        │ (per equipment)  │
                        └──────────────────┘
                               │
                               ▼ every 30s
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Aggregation     │────▶│  WebSocket      │
                        │  (1m/5m/15m/1h)  │     │  Broadcast      │
                        └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                 ┌─────────────────┐
                                                 │  React Charts   │
                                                 │  (throttled)    │
                                                 └─────────────────┘
```

## 2. Entry Points

| Entry Point | Location | Rate Limit | Batching |
|-------------|----------|------------|----------|
| MQTT Messages | `server/mqtt-ingestion-service.ts` | 10k/min (testing) | Buffer: 10k/equipment |
| HTTP Telemetry | `server/routes.ts` `/api/telemetry` | 600/min (prod) | Per-request |
| Bulk Import | `server/routes.ts` `/api/telemetry/bulk-import` | 10/min | CSV/JSON batch |
| Vessel Simulator | `server/vessel-simulator.ts` | N/A (internal) | Configurable rate |

## 3. Existing Rate Limiting (server/config/rate-limits.ts)

```typescript
// DO NOT ADD PARALLEL RATE LIMITERS - USE THESE
TELEMETRY: { windowMs: 60_000, max: 10000 }      // Testing mode
BULK_IMPORT: { windowMs: 60_000, max: 10 }
GENERAL_API: { windowMs: 60_000, max: 300 }
WRITE_OPERATIONS: { windowMs: 60_000, max: 5000 } // Testing mode
ML_TRAINING: { windowMs: 3600_000, max: 100 }
```

## 4. Existing Buffering & Backpressure

### MQTT Ingestion Service (server/mqtt-ingestion-service.ts)
- **MAX_BUFFER_SIZE**: 10,000 points per equipment/sensor pair
- **Eviction**: Removes 10% oldest when buffer full
- **Stream Processing**: Aggregates every 30 seconds
- **Retry**: Exponential backoff (100ms → 2s, 3 attempts)
- **Dead Letter**: Failed messages logged for recovery

### WebSocket Server (server/websocket.ts)
- Subscription-based broadcasting
- Channel isolation (alerts, dashboard, telemetry)
- Connection metrics tracked
- **Broadcast Throttling**: 100ms batch window to prevent frontend overload

## 5. Existing Observability (server/observability/telemetry-metrics.ts)

| Metric | Type | Purpose |
|--------|------|---------|
| `arus_telemetry_messages_processed_total` | Counter | Throughput |
| `arus_telemetry_processing_duration_ms` | Histogram | Latency |
| `arus_telemetry_buffer_depth` | Gauge | Backpressure |
| `arus_telemetry_buffer_evictions_total` | Counter | Overflow |
| `arus_telemetry_data_quality_score` | Histogram | Quality |
| `arus_telemetry_dead_letter_messages_total` | Counter | Failures |
| `arus_event_loop_lag_ms` | Histogram | Server overload detection |
| `arus_event_loop_lag_current_ms` | Gauge | Current event loop lag |

### Event Loop Monitoring (server/observability.ts)
- **Purpose**: Detects CPU saturation and blocking operations
- **Method**: Measures delay between scheduled and actual setImmediate execution
- **Threshold**: Warns when lag exceeds 100ms
- **Interval**: Samples every 1 second
- **Lifecycle**: Starts on app ready, stops on graceful shutdown

## 6. Database Optimization

### Indexes (server/db-indexes.ts)
```sql
-- Critical telemetry indexes (created on startup)
idx_equipment_telemetry_equipment_sensor_ts (equipment_id, sensor_type, ts DESC)
idx_equipment_telemetry_ts (ts DESC)
idx_equipment_telemetry_org_ts (org_id, ts DESC)
```

### Multi-Tenant Isolation
- All queries scoped by `org_id` via middleware
- `TENANT_ISOLATION_SUCCESS` logged for audit

## 7. Frontend Performance

### Existing Patterns
- `useDebounce` hook for search/filter inputs (300ms default)
- `useMemo` in chart components for data transformations
- TanStack Query with 30s refetch interval for telemetry

### Sliding Window Hook (client/src/hooks/useTelemetrySlidingWindow.ts)
- **`useTelemetrySlidingWindow`**: Fixed-size buffer for chart data
  - `maxPoints`: Maximum data points (default: 100)
  - `maxAgeMs`: Maximum age before pruning (default: 5 min)
  - Auto-prunes stale data every 10 seconds
  - Prevents unbounded memory growth in dashboards
  
- **`useThrottledTelemetry`**: Adds render throttling
  - Queues incoming points instead of immediate state updates
  - Flushes at configurable interval (default: 250ms)
  - Reduces React re-renders during high-frequency streams

### Chart Components (client/src/components/charts/)
- `MultiSensorChart`: Merges time series with useMemo
- `ChartWrapper`: Error boundary for chart failures

## 8. Performance Limits & Expectations

| Scenario | Expected Rate | Memory | CPU |
|----------|---------------|--------|-----|
| Normal operation | 2 msg/sec/sensor | <500MB | <30% |
| High load | 10 msg/sec/sensor | <1GB | <60% |
| Stress test | 50+ msg/sec | >1GB | >80% |

## 9. Load Testing with Vessel Simulator

```bash
# Start server with simulator enabled
npm run dev

# Simulator auto-starts for all equipment
# Configure via /api/simulator/config endpoint

# View metrics
curl localhost:5000/metrics | grep arus_telemetry
```

### Simulator Features (server/vessel-simulator.ts)
- 11 vessel type presets (tug, PSV, tanker, etc.)
- Physics-aware: torque curves, thermal dynamics, sea state
- Fault injection for ML training data

## 10. Performance Checklist

Before deploying high-frequency telemetry:

- [ ] Verify rate limits match production needs
- [ ] Check buffer eviction metrics (`arus_telemetry_buffer_evictions_total`)
- [ ] Monitor event loop lag (if enabled)
- [ ] Confirm database indexes exist
- [ ] Test WebSocket broadcast under load
- [ ] Validate frontend chart memory usage

## 11. Troubleshooting

### High Buffer Evictions
- Cause: Ingestion rate > processing rate
- Fix: Increase `MAX_BUFFER_SIZE` or reduce ingestion frequency

### Slow Dashboard Queries
- Cause: Missing indexes or large time ranges
- Fix: Add indexes, use aggregated views, limit time range

### WebSocket Disconnections
- Cause: Message backlog or network issues
- Fix: Enable throttled broadcast, check reconnection logic

### Frontend Lag
- Cause: Too many chart re-renders
- Fix: Use throttled updates, limit data points per chart

## 12. Key Files

| Purpose | File |
|---------|------|
| MQTT Ingestion | `server/mqtt-ingestion-service.ts` |
| Rate Limits | `server/config/rate-limits.ts` |
| WebSocket | `server/websocket.ts` |
| Telemetry Metrics | `server/observability/telemetry-metrics.ts` |
| Event Loop Monitoring | `server/observability.ts` |
| DB Indexes | `server/db-indexes.ts` |
| Vessel Simulator | `server/vessel-simulator.ts` |
| Frontend WebSocket | `client/src/hooks/useWebSocket.ts` |
| Sliding Window Hook | `client/src/hooks/useTelemetrySlidingWindow.ts` |
| Charts | `client/src/components/charts/` |
