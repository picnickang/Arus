# Performance Baseline Report

**Date:** 2026-01-01
**Purpose:** Document baseline metrics before performance optimizations

---

## Server Boot Timing

| Milestone | Timestamp | Delta from Start |
|-----------|-----------|------------------|
| Script started | 03:15:49.014Z | 0ms |
| DB Connected | 03:15:49.014Z | ~0ms |
| Repositories loaded (22 modules) | 03:15:49.018Z | ~4ms |
| Route registration started | 03:15:49.138Z | ~124ms |
| Domain routers registered (61 modules) | 03:15:49.696Z | ~682ms |
| Server listening | 03:15:49.7xx | ~700ms |
| Database indexes created (29) | 03:15:49.9xx | ~900ms |
| Application initialization complete | 03:15:50.0xx | ~1000ms |
| External circuit breakers ready | 03:16:07.xxx | ~18s (deferred) |

**Total boot time to "Server listening":** ~700ms
**Total boot time to "fully initialized":** ~1000ms
**Index creation time (29 indexes):** ~200ms on every boot

---

## Redis Connection Issues

| Issue | Count per Boot | Latency Impact |
|-------|----------------|----------------|
| ECONNREFUSED errors | 4-5 | ~35ms each before fallback |
| Total Redis latency overhead | - | ~140-175ms |

**Affected modules:**
- RateLimiter
- Inventory Cache
- Analytics Cache
- (Multiple independent connection attempts)

---

## Event Loop Lag

| Metric | Value | Threshold |
|--------|-------|-----------|
| Peak event loop lag during boot | 196ms | 100ms |
| Status | EXCEEDS | - |

---

## Frontend Bundle Sizes (Production Build)

### Critical Chunks (>100KB)

| Chunk | Size | Gzip |
|-------|------|------|
| index-BBWMf9Gd.js (main) | 723.26 kB | 196.58 kB |
| jspdf.plugin.autotable | 444.28 kB | 142.87 kB |
| generateCategoricalChart (recharts) | 367.62 kB | 101.35 kB |
| xlsx | 284.34 kB | 94.56 kB |
| system-administration | 255.17 kB | 69.60 kB |
| html2canvas | 201.42 kB | 47.70 kB |
| work-orders | 175.71 kB | 44.17 kB |
| index.es | 150.61 kB | 51.35 kB |
| schedule-planner | 122.82 kB | 33.87 kB |

### Vite Build Warnings
- Main bundle exceeds 500 kB limit
- No manual chunks configured
- No vendor splitting

---

## Vite Dev Server

| Metric | Value | Target |
|--------|-------|--------|
| Build time (production) | 28.31s | <30s |
| /@vite/client (cold) | ~1020ms | <300ms |
| /@vite/client (warm) | Not measured | <100ms |

---

## API Response Times (Sample)

| Endpoint | Response Time |
|----------|---------------|
| GET /api/permissions/me | 3-8ms |
| First request after boot | 8ms |

---

## Database

| Metric | Value |
|--------|-------|
| Indexes created on boot | 29 |
| db_schema_version table | Exists (empty) |
| Largest table | equipment_telemetry (6.7 MB) |

---

## Summary of Issues

1. **Redis:** 4-5 ECONNREFUSED per boot, ~140-175ms latency overhead
2. **Indexes:** 29 created on every boot (~200ms), should be migration-based
3. **Event loop lag:** 196ms peak (threshold 100ms)
4. **Main bundle:** 723 kB (needs chunking)
5. **No vendor splitting:** react, recharts, radix all in main bundle
6. **Heavy chunks:** jspdf, xlsx, html2canvas loaded eagerly

---

## Target Improvements

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Redis latency overhead | 140-175ms | 0ms | Skip entirely |
| Index creation time | 200ms | 0ms | Run once via migration |
| Event loop lag | 196ms | <100ms | 50%+ reduction |
| Main bundle size | 723 kB | <300 kB | 60% reduction |
| /@vite/client | 1020ms | <300ms | 70% reduction |
