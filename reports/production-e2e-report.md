# Production E2E Bridge Test Report

Generated: 2025-12-23T19:10:34.764Z

## Summary

| Metric | Value |
|--------|-------|
| Total Scenarios | 1 |
| Passed | 1 |
| Failed | 0 |
| Total Frames | 800 |
| Avg Commit Latency | 41.0ms |
| Avg E2E Lag | 1175.1ms |

## pg-down

| Metric | Value |
|--------|-------|
| Frames Generated | 800 |
| Cursor Start | 0 |
| Cursor End | 800 |
| Cursor Advanced | true |
| Final Backlog | 0 |
| Drain Completed | true |
| PG Rows Inserted | 800 |
| Bridge Frames Processed | 910 |
| Avg Commit Latency | 41.0ms |
| Avg E2E Lag | 1175.1ms |
| Max Backoff | 2000ms |
| Result | PASSED |

**Notes:**
- PG down: Real fault injection - cursor should freeze, backoff should increase
- FPS: 100.0 (target: 100)
- Cursor: 0 -> 800
- Backlog: 0
- PG Rows: 800
- Drain: COMPLETE
- INFO: PG down scenario completed

