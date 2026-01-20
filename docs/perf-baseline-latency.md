# ARUS Performance Baseline Analysis

## Phase 0: Architecture & Latency Analysis

**Date**: December 2024  
**Version**: 1.0

---

## Project Structure Overview

### Electron (Desktop Shell)
- **Entry**: `electron/main.ts`
- **Auto-Updater**: `electron/auto-updater.ts`  
- **Preload**: `electron/preload.ts`
- **Features**: Dynamic port allocation, ELECTRON_RUN_AS_NODE for production, process tree cleanup, single-instance lock, auto-updates via GitHub Releases

### Backend
- **Entry**: `server/index.ts`
- **Routes**: `server/routes.ts` (24,700+ lines - very large)
- **Storage**: `server/storage.ts` (Drizzle ORM)
- **Database**: PostgreSQL (cloud) + SQLite (desktop/vessel)
- **Key Services**:
  - `server/telemetry-batch-writer.ts` - High-throughput telemetry batching
  - `server/mqtt-ingestion-service.ts` - MQTT message ingestion
  - `server/websocket.ts` - Real-time WebSocket server with throttling
  - `server/background-jobs.ts` - Async job processing (6 concurrent)
  - `server/vessel-simulator.ts` - Telemetry simulation

### Frontend
- **Entry**: `client/src/main.tsx`
- **Router**: Wouter
- **Data Fetching**: TanStack React Query v5
- **UI**: React 18 + Tailwind CSS + shadcn/ui
- **Pages**: 70+ page components in `client/src/pages/`

---

## Data Flow Analysis

### 1. Telemetry Stream → Backend → Frontend

```
MQTT/Simulator → MqttIngestionService → TelemetryBatchWriter → PostgreSQL/SQLite
                                              ↓
                              TelemetryThrottler (250ms batches)
                                              ↓
                              WebSocketServer → Frontend Clients
```

**Key Characteristics**:
- **Batch Interval**: 500ms default (configurable via `TELEMETRY_BATCH_INTERVAL_MS`)
- **Buffer Size**: 10,000 readings max before ring buffer eviction
- **WebSocket Throttle**: 250ms batches to prevent frontend flooding
- **Stream Windows**: 1m, 5m, 15m, 1h, 6h, 1d aggregations

### 2. Dashboard/Health Data Loading

```
Frontend Component → React Query → /api/equipment/health → Storage → DB
                                   (refetchInterval: 30s)
```

**Polling Pattern Analysis**:
| Page/Component | refetchInterval | staleTime | Notes |
|----------------|-----------------|-----------|-------|
| Dashboard (REALTIME) | 30s | 30s | Equipment health, metrics, telemetry |
| Dashboard (MODERATE) | 5min | 5min | Devices, work orders |
| Dashboard (STABLE) | 60min | 60min | Vessels, equipment registry |
| Fleet Page | 5s-60s | varies | Mixed intervals |
| Bridge View | 5s-60s | varies | High-frequency polling |
| Devices | 10s | - | Very frequent |
| Vessel Management | 30s | - | 4 parallel queries |
| Crew Scheduler | 30s-60s | - | 7 parallel queries! |
| Work Orders | 30s | - | - |

### 3. Logbook Loading

```
Frontend → /api/logbook/* → Storage → DB
```

**Known Patterns**:
- Engine/Deck logbooks fetch entire lists
- No visible pagination on frontend
- Large date ranges can return hundreds of entries

---

## Suspected Lag Sources (High → Low Priority)

### 🔴 Critical Impact

1. **React Query Over-Polling**
   - **Evidence**: 30s refetchInterval on 20+ endpoints per page
   - **Impact**: Constant network requests, CPU usage, potential race conditions
   - **Affected**: Dashboard, Fleet, Bridge View, Crew Scheduler (7 parallel polling queries!)
   - **Recommendation**: Reduce polling frequency, leverage WebSocket for real-time data

2. **Large React Trees Re-rendering**
   - **Evidence**: 70+ pages, minimal `React.memo` usage (only ~19 files use memoization)
   - **Impact**: Full component tree updates on any state change
   - **Affected**: Dashboard components, tables, charts
   - **Recommendation**: Add memoization, split components

3. **ResponsiveTable Without Virtualization**
   - **Evidence**: `ResponsiveTable.tsx` maps all rows without virtualization
   - **Impact**: DOM thrashing on large lists (100+ rows)
   - **Affected**: Vessel Management, Maintenance Schedules, Device lists
   - **Recommendation**: Use existing `VirtualizedWorkOrderTable` pattern elsewhere

### 🟠 Medium Impact

4. **Multiple Redundant API Calls**
   - **Evidence**: Same endpoints called by multiple components
   - **Example**: `/api/equipment` called by dashboard, vessel-management, equipment page
   - **Impact**: Duplicate network requests, wasted bandwidth
   - **Recommendation**: Centralize queries, increase staleTime

5. **Heavy Dashboard Initial Load**
   - **Evidence**: Dashboard fetches 9+ queries on mount
   - **Impact**: Slow initial render, waterfall requests
   - **Recommendation**: Batch or prefetch, progressive loading

6. **Telemetry Updates Re-rendering Entire Pages**
   - **Evidence**: WebSocket broadcasts go to entire subscribed components
   - **Impact**: Chart redraws, table updates on every telemetry batch
   - **Recommendation**: Localized state, throttled UI updates

### 🟡 Lower Impact (But Worth Fixing)

7. **5-Second Polling on Fleet/Bridge**
   - **Evidence**: `refetchInterval: 5_000` in fleet.tsx and bridge-view.tsx
   - **Impact**: Very high request rate on navigation-heavy views
   - **Recommendation**: Use WebSocket instead, or increase to 15-30s

8. **Large Routes File**
   - **Evidence**: `server/routes.ts` is 24,700+ lines
   - **Impact**: Slow imports, harder debugging
   - **Recommendation**: Split into domain-specific route modules

---

## Existing Optimizations (Already Implemented)

### ✅ Good Patterns Found

1. **WebSocket Telemetry Throttling** (`websocket.ts`)
   - `TelemetryThrottler` batches updates every 250ms
   - Prevents flooding frontend with high-frequency data

2. **Batch Telemetry Writer** (`telemetry-batch-writer.ts`)
   - Configurable 500ms batch interval
   - Ring buffer with eviction (10K max)
   - Prometheus metrics for observability

3. **Virtualized Tables** (Partial)
   - `VirtualizedWorkOrderTable.tsx` uses `@tanstack/react-virtual`
   - `VirtualizedInventoryTable.tsx` exists
   - Pattern established but not widely adopted

4. **CACHE_TIMES Constants** (`queryClient.ts`)
   - Well-defined cache tiers: REALTIME (30s), MODERATE (5min), STABLE (60min), EXPENSIVE (24hr)
   - Default staleTime: 5min

5. **Background Job Queue** (`background-jobs.ts`)
   - 6 concurrent jobs, priority-based processing
   - Prevents blocking main thread

6. **Database Indexes** (`db-indexes.ts`)
   - 29 production indexes created at startup
   - Covers telemetry, work orders, crew, alerts

---

## Performance Metrics to Track

### Frontend Metrics
- [ ] Component render counts per page
- [ ] Mount time for heavy components
- [ ] React Query refetch frequency per query
- [ ] WebSocket message handling latency

### Backend Metrics
- [ ] API response times (P50, P95, P99)
- [ ] DB query execution times
- [ ] Telemetry ingestion throughput
- [ ] Job queue processing times

### Electron Metrics
- [ ] App startup time
- [ ] Window creation latency
- [ ] Memory usage over time

---

## Next Steps (Phase 1)

1. Add frontend performance logger utility
2. Add backend request timing middleware
3. Add Electron startup profiling
4. Measure actual request/render times for baseline

---

## File Reference

| File | Purpose | Size/Complexity |
|------|---------|-----------------|
| `server/routes.ts` | All API routes | 24,700+ lines (needs splitting) |
| `server/websocket.ts` | WebSocket + throttler | Well-optimized |
| `server/telemetry-batch-writer.ts` | Telemetry batching | Well-optimized |
| `client/src/lib/queryClient.ts` | React Query config | Good cache config |
| `client/src/pages/dashboard-improved.tsx` | Main dashboard | 899 lines, 9+ queries |
| `client/src/pages/work-orders.tsx` | Work orders list | Has virtualization |
| `client/src/components/shared/ResponsiveTable.tsx` | Generic table | Needs virtualization |
| `electron/main.ts` | Electron main process | Well-structured |
