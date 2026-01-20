# E2E Bridge Test Report

Generated: 2025-12-23T18:27:45.473Z

## Summary

| Metric | Value |
|--------|-------|
| Total Scenarios | 5 |
| Passed | 5 |
| Failed | 0 |
| Avg Commit Latency | 31.7ms |
| Avg E2E Lag | 200.1ms |
| Total Frames Generated | 25000 |
| Total Frames Processed | 25000 |

## baseline

| Metric | Value |
|--------|-------|
| Frames Generated | 5000 |
| Frames Processed | 5000 |
| Cursor Start | 0 |
| Cursor End | 5000 |
| Cursor Advanced | true |
| Final Backlog | 0 |
| Avg Commit Latency | 0.2ms |
| P95 Commit Latency | 1.0ms |
| Avg E2E Lag | 34.8ms |
| Result | PASSED |

**Notes:**
- FPS: 500.0 (target: 500)
- Cursor advanced: true
- Final backlog: 0
- SUCCESS: Baseline throughput validated

## pg-slow

| Metric | Value |
|--------|-------|
| Frames Generated | 5000 |
| Frames Processed | 5000 |
| Cursor Start | 0 |
| Cursor End | 5000 |
| Cursor Advanced | true |
| Final Backlog | 0 |
| Avg Commit Latency | 157.6ms |
| P95 Commit Latency | 198.0ms |
| Avg E2E Lag | 286.6ms |
| Result | PASSED |

**Notes:**
- Processed under slow PG: 5000 frames
- Avg commit latency: 157.6ms
- SUCCESS: Bridge handled slow PG with increased latency

## pg-down

| Metric | Value |
|--------|-------|
| Frames Generated | 5000 |
| Frames Processed | 5000 |
| Cursor Start | 0 |
| Cursor End | 5000 |
| Cursor Advanced | true |
| Final Backlog | 0 |
| Avg Commit Latency | 0.3ms |
| P95 Commit Latency | 1.0ms |
| Avg E2E Lag | 600.7ms |
| Result | PASSED |

**Notes:**
- Cursor during outage: 5000
- Max backoff: 2000ms
- Backlog after recovery: 0
- SUCCESS: Recovered from PG outage and processed frames

## bridge-restart

| Metric | Value |
|--------|-------|
| Frames Generated | 5000 |
| Frames Processed | 5000 |
| Cursor Start | 0 |
| Cursor End | 5000 |
| Cursor Advanced | true |
| Final Backlog | 0 |
| Avg Commit Latency | 0.3ms |
| P95 Commit Latency | 1.0ms |
| Avg E2E Lag | 43.3ms |
| Result | PASSED |

**Notes:**
- Cursor after restart: 5000
- Frames processed: 5000
- SUCCESS: Cursor persisted across bridge restart

## agent-restart

| Metric | Value |
|--------|-------|
| Frames Generated | 5000 |
| Frames Processed | 5000 |
| Cursor Start | 0 |
| Cursor End | 5000 |
| Cursor Advanced | true |
| Final Backlog | 0 |
| Avg Commit Latency | 0.3ms |
| P95 Commit Latency | 1.0ms |
| Avg E2E Lag | 35.0ms |
| Result | PASSED |

**Notes:**
- Total frames: 5000
- Processed: 5000
- SUCCESS: Frame continuity maintained after agent restart

