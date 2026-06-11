# PdM Scheduling Algorithm Documentation

## Overview

The Predictive Maintenance (PdM) scheduling system uses a greedy scheduling algorithm with dynamic buffer computation to optimize maintenance task scheduling across the fleet. The system balances equipment reliability requirements with operational constraints.

## Core Concepts

### Remaining Useful Life (RUL) Confidence Intervals

Each maintenance task is driven by ML-predicted RUL with confidence intervals:

- **P10 (Low)**: Conservative estimate - 10th percentile (earliest likely failure)
- **P50 (Median)**: Most likely failure time
- **P90 (High)**: Optimistic estimate - 90th percentile (latest likely failure)

### Scheduling Window

The scheduling window defines when maintenance can be performed:

```
|--prep--|---------valid window---------|--buffer--|
         ^                              ^
    earliestStart                  latestFinish
```

- **Earliest Start**: `today + prepDays`
- **Preferred Date**: `today + P50` (clamped within valid window)
- **Latest Finish**: `today + P90 - bufferDays`

## Buffer Days Computation

Buffer days provide safety margin based on uncertainty factors:

```typescript
bufferDays = BASE(1) + confidenceFactor + telemetryFactor + severityFactor;
```

### Factors

| Factor         | Condition | Additional Days |
| -------------- | --------- | --------------- |
| **Confidence** | null      | +1              |
|                | < 50%     | +2              |
|                | < 80%     | +1              |
|                | >= 80%    | +0              |
| **Telemetry**  | online    | +0              |
|                | delayed   | +1              |
|                | offline   | +1              |
| **Severity**   | critical  | +1              |
|                | other     | +0              |

**Maximum cap**: 5 days

### Invariants

1. Decreasing confidence never reduces buffer days
2. Telemetry degradation always adds buffer
3. Critical severity always adds buffer
4. Buffer is capped at 5 days maximum

## Blocking Reasons

Tasks can be blocked from scheduling for several reasons:

| Block Reason          | Condition                                                     |
| --------------------- | ------------------------------------------------------------- |
| `low_confidence`      | ML confidence < 50%                                           |
| `capacity_exceeded`   | Daily vessel capacity full                                    |
| `lead_time`           | Prep time exceeds RUL window (`earliestStart > latestFinish`) |
| `scheduling_conflict` | Cannot fit in any available slot                              |
| `telemetry_stale`     | Equipment telemetry offline/delayed                           |

## Capacity Model

The system uses hours-based capacity per vessel per day:

- **Default**: 8 hours per vessel per day (`MAX_VESSEL_HOURS_PER_DAY`)
- **Per-task downtime**: Estimated from equipment type (default 4 hours)
- Tasks are scheduled until vessel's daily hour budget is exhausted
- With 4-hour tasks and 8-hour daily limit, maximum 2 tasks per vessel per day

## Greedy Scheduler Algorithm

1. **Sort tasks by priority**:
   - When auto-populate enabled: severity order (critical > high > medium > low)
   - Otherwise: by preferred date (earliest first)

2. **For each task**:
   - Compute scheduling window with buffer
   - Check for lead time blocking
   - Find first available date with capacity
   - Assign or block

3. **Output**:
   - Scheduled tasks with assigned dates
   - Blocked tasks with reasons
   - Schedule KPIs

## Configuration Knobs

### API Parameters

```typescript
interface GetScheduleInput {
  orgId: string;
  vesselIds?: string[]; // Filter by vessels
  equipmentTypes?: string[]; // Filter by equipment type
  startDate?: Date; // Schedule range start
  endDate?: Date; // Schedule range end
  maxTasksPerVesselPerDay?: number; // Capacity limit (1-5)
  autoPopulate?: boolean; // Enable priority-based sorting
}
```

### URL Parameters (UI)

| Parameter      | Type     | Default | Description                     |
| -------------- | -------- | ------- | ------------------------------- |
| `vessels`      | string[] | all     | Vessel filter                   |
| `equipment`    | string[] | all     | Equipment type filter           |
| `maxTasks`     | number   | 3       | Max concurrent tasks per vessel |
| `autoPopulate` | boolean  | true    | Priority-based scheduling       |

## KPI Metrics

The scheduler computes operational KPIs:

- **Total Tasks**: All maintenance alerts
- **Scheduled**: Successfully assigned to dates
- **Blocked**: Cannot be scheduled (with breakdown by reason)
- **Critical Blocked**: High-priority tasks that couldn't be scheduled
- **Estimated Downtime Hours**: Total maintenance time
- **Estimated Cost**: Downtime cost (hours x rate)

## Examples

### Example 1: Normal Scheduling

```
Alert: Main Engine bearing wear
RUL: P10=7, P50=14, P90=21 days
Confidence: 85%
Telemetry: online
Severity: high

Buffer: 1 (base) + 0 (conf >= 80) + 0 (online) + 0 (not critical) = 1 day
Earliest Start: today + 1
Latest Finish: today + 21 - 1 = today + 20
Preferred: today + 14
```

### Example 2: Low Confidence Blocking

```
Alert: Pump anomaly
Confidence: 42%

Action: Blocked (low_confidence)
Reason: ML confidence below 50% threshold
```

### Example 3: Lead Time Blocking

```
Alert: Generator maintenance
RUL: P10=2, P50=5, P90=8 days
Prep Time: 10 days

Earliest Start: today + 10
Latest Finish: today + 8 - buffer
Result: Blocked (lead_time) - prep time exceeds failure window
```
