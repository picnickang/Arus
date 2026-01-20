# Ingestion Load Test Report

Generated: 2025-12-23T15:08:34.860Z

## Summary

| Metric | Value |
|--------|-------|
| Total Scenarios | 5 |
| Passed | 5 |
| Failed | 0 |

## Scenario Results

### baseline

| Metric | Value |
|--------|-------|
| Target FPS | 1000 |
| Actual FPS | 1002.0 |
| Sustained FPS | 0.0 |
| Frames Generated | 5100 |
| Cursor Advanced | false |
| Peak Backlog | 0 |
| Final Backlog | 5100 |
| Result | PASSED |

**Notes:**
- Achieved 1002.0 FPS (target: 1000)
- Frames generated: 5100

### pg-slow

| Metric | Value |
|--------|-------|
| Target FPS | 1000 |
| Actual FPS | 1002.1 |
| Sustained FPS | 0.0 |
| Frames Generated | 5100 |
| Cursor Advanced | false |
| Peak Backlog | 0 |
| Final Backlog | 5100 |
| Result | PASSED |

**Notes:**
- Frame generation: 1002.1 FPS
- Frames queued: 5100
- Final cursor: 0
- Without bridge: Frames queued for later processing

### pg-down

| Metric | Value |
|--------|-------|
| Target FPS | 1000 |
| Actual FPS | 1001.1 |
| Sustained FPS | 0.0 |
| Frames Generated | 5100 |
| Cursor Advanced | false |
| Peak Backlog | 0 |
| Final Backlog | 5100 |
| Result | PASSED |

**Notes:**
- Frame generation: 1001.1 FPS
- Cursor position: 0
- Backlog accumulated: 5100 frames
- Cursor frozen at 0, backlog accumulated as expected

### bridge-restart

| Metric | Value |
|--------|-------|
| Target FPS | 1000 |
| Actual FPS | 1002.3 |
| Sustained FPS | 0.0 |
| Frames Generated | 5100 |
| Cursor Advanced | false |
| Peak Backlog | 0 |
| Final Backlog | 5100 |
| Result | PASSED |

**Notes:**
- Frame generation: 1002.3 FPS
- Cursor position: 0
- Test: Cursor persists across bridge restart
- Without bridge: Frames queued for processing

### agent-restart

| Metric | Value |
|--------|-------|
| Target FPS | 1000 |
| Actual FPS | 1002.9 |
| Sustained FPS | 0.0 |
| Frames Generated | 5100 |
| Cursor Advanced | false |
| Peak Backlog | 0 |
| Final Backlog | 5100 |
| Result | PASSED |

**Notes:**
- Frame generation: 1002.9 FPS
- Frames generated: 5100
- Test: raw_frames continuity after agent restart
