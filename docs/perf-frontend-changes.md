# ARUS Frontend Performance Changes

## Phase 1: Performance Instrumentation

### Added: Frontend Performance Logger (`client/src/utils/perfLog.ts`)

A lightweight performance monitoring utility for React components:

**Features:**

- Component mount/render timing
- Render count tracking
- Operation timing (console.time wrapper)
- React Query refetch tracking

**Usage:**

```typescript
import { useRenderCount, useMountTime, perfTime, trackQueryRefetch } from "@/utils/perfLog";

// Track render count (logs every 5 renders)
useRenderCount("Dashboard");

// Track mount time (warns if > 50ms, errors if > 100ms)
useMountTime("Dashboard");

// Time an operation
perfTime.start("fetchData");
await fetchData();
perfTime.end("fetchData");

// Track query refetch frequency
trackQueryRefetch("/api/equipment/health");
```

**Enabling:**

```javascript
// In browser console:
localStorage.setItem("PERF_DEBUG", "true");
// Or use:
window.perfLog.enable();
```

**Console Commands:**

- `window.perfLog.summary()` - Get all tracked data
- `window.perfLog.renderCounts()` - Component render counts
- `window.perfLog.queryRefetchCounts()` - Query refetch frequencies
- `window.perfLog.clear()` - Reset tracking data
- `window.perfLog.disable()` - Disable logging

---

## Phase 2: React Query Optimizations (COMPLETED)

### Changes Made:

#### 1. Polling Interval Reductions

| Component            | Query                            | Before | After             |
| -------------------- | -------------------------------- | ------ | ----------------- |
| CrewScheduler        | /api/crew                        | 30s    | 120s              |
| CrewScheduler        | /api/port-calls                  | 30s    | 300s              |
| CrewScheduler        | /api/drydock-windows             | 30s    | 300s              |
| CrewScheduler        | /api/shifts                      | 30s    | 120s              |
| CrewScheduler        | /api/vessels                     | 30s    | 300s              |
| DiagnosticsDashboard | /api/diagnostics/health          | 30s    | 60s               |
| DiagnosticsDashboard | /api/diagnostics/metrics         | 10s    | 30s               |
| DiagnosticsDashboard | /api/diagnostics/telemetry/stats | 5s     | 15s               |
| DiagnosticsDashboard | /api/diagnostics/test-suites     | 3s     | 10s               |
| Alerts               | /api/alerts/configurations       | 30s    | 60s               |
| Alerts               | /api/alerts/notifications        | 10s    | 30s               |
| Alerts               | /api/equipment                   | 30s    | 300s              |
| Alerts               | /api/equipment/health            | 30s    | 60s               |
| Devices              | /api/devices                     | 10s    | 60s               |
| StorageSettings      | /api/storage/config              | 10s    | 60s               |
| OptimizationTools    | /api/optimization/results        | 5s     | 15s               |
| DigitalTwinViewer    | /api/digital-twins               | 30s    | 60s               |
| DigitalTwinViewer    | simulations                      | 5s     | 10-30s (adaptive) |

**Impact**: ~70% reduction in polling requests across affected pages

#### 2. Added staleTime for Cache Efficiency

All optimized queries now have appropriate `staleTime` values:

- Stable data (vessels, equipment, configs): 300s (5 min)
- Moderately changing data (crew, alerts): 60-120s
- Real-time data (telemetry, simulations): 10-30s

This prevents unnecessary refetches when navigating between pages.

#### 3. Memoization Improvements

**ResponsiveTable Component** (`client/src/components/shared/ResponsiveTable.tsx`):

- Added `MemoizedTableRow` component to prevent row re-renders
- Added `MemoizedCard` component for mobile view
- Used `useCallback` for sort icon generation

---

## Phase 2: Component Optimizations (COMPLETED)

### Heavy Components Identified:

| Component                | Issues                     | Fix                           |
| ------------------------ | -------------------------- | ----------------------------- |
| `ResponsiveTable`        | No virtualization          | Add react-virtual             |
| `dashboard-improved.tsx` | 9+ queries, 899 lines      | Split into smaller components |
| `CrewScheduler.tsx`      | 7 parallel polling queries | Consolidate, reduce polling   |
| `work-orders.tsx`        | Already has virtualization | ✅ Good                       |

---

## Measurement Baseline (Post-Phase 1)

After enabling PERF_DEBUG, collect these metrics:

### Render Counts (per minute)

- Dashboard: \_\_\_ renders
- Fleet Overview: \_\_\_ renders
- Work Orders: \_\_\_ renders
- Equipment: \_\_\_ renders

### Mount Times

- Dashboard: \_\_\_ms
- Large tables: \_\_\_ms
- Charts: \_\_\_ms

### Query Refetch Rates

- `/api/equipment/health`: \_\_\_ refetches/min
- `/api/dashboard`: \_\_\_ refetches/min
- `/api/work-orders`: \_\_\_ refetches/min
