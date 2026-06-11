# Performance Benchmarks

**Generated:** 2025-11-04T17:37:49.602Z
**Base URL:** http://localhost:5000
**QPS Limit:** 20

## Summary

- **Total Scenarios:** 6
- **Passed:** 6
- **Failed:** 0
- **Overall p95:** 865ms
- **Overall Avg:** 113ms

## Results

| Scenario            | p50   | p95       | p99   | Avg   | Throughput  | Status           |
| ------------------- | ----- | --------- | ----- | ----- | ----------- | ---------------- |
| Dashboard           | 20ms  | **27ms**  | 34ms  | 21ms  | 22.6 req/s  | ✅ PASS (1600ms) |
| Equipment List      | 48ms  | **97ms**  | 325ms | 56ms  | 23.19 req/s | ✅ PASS (1200ms) |
| Equipment Health    | 86ms  | **101ms** | 101ms | 85ms  | 0.4 req/s   | ✅ PASS (1500ms) |
| Work Orders         | 95ms  | **202ms** | 259ms | 110ms | 23.16 req/s | ✅ PASS (1200ms) |
| Telemetry Latest    | 156ms | **271ms** | 323ms | 161ms | 22.97 req/s | ✅ PASS (1500ms) |
| DTC Dashboard Stats | 744ms | **865ms** | 885ms | 757ms | 5.18 req/s  | ✅ PASS (1500ms) |

## Performance Gates

Each scenario has a specific p95 latency threshold:

- **Dashboard:** ≤ 1600ms
- **Equipment List:** ≤ 1200ms
- **Equipment Health:** ≤ 1500ms
- **Work Orders:** ≤ 1200ms
- **Telemetry Latest:** ≤ 1500ms
- **DTC Dashboard Stats:** ≤ 1500ms
