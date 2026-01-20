# PdM Testing Guide

This document describes how to test the Predictive Maintenance (PdM) schedule system end-to-end.

## Test Overview

The PdM test suite validates:

1. **Scheduling Engine** - RUL window computation, greedy placement, blocking rules
2. **Risk Queue** - Alert fetching, severity mapping, confidence handling
3. **Schedule Endpoint** - API responses, filters, KPI computation
4. **CSV Export** - Current filter matching, column completeness

## Running Tests

### All PdM Tests

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPattern=pdm
```

### Individual Test Suites

```bash
# Schedule use case unit tests
node --experimental-vm-modules node_modules/jest/bin/jest.js server/tests/pdm/get-schedule.test.ts

# Dashboard use case tests  
node --experimental-vm-modules node_modules/jest/bin/jest.js server/tests/pdm/get-dashboard.test.ts

# All PdM tests with coverage
node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage --testPathPattern=pdm
```

## Test Data Seeding

### Seed PdM Test Cases

The seed script creates 5 canonical test cases:

1. **Case A: Schedulable High Risk** - RUL P10=7/P50=10/P90=14, confidence=75%, should schedule
2. **Case B: Scheduling Conflict** - P10=6/P90=3 (inverted, causes earliestStart > latestFinish)
3. **Case C1: Capacity Test First** - RUL P10=7/P50=10/P90=14, schedules first on vessel
4. **Case C2: Capacity Blocked** - Same RUL as C1, blocked (same vessel/preferred date)
5. **Case D: Insufficient Confidence** - failureProbability=0.75 -> confidence=25%, blocked

```bash
npx tsx server/scripts/test/seedPdMCases.ts
```

### Prerequisites

Before running the seed script:
1. Ensure at least one vessel exists in the database
2. Ensure equipment is associated with that vessel (for capacity tests)

### Clear Existing Predictions

```bash
# Using SQL:
psql $DATABASE_URL -c "DELETE FROM failure_predictions;"
```

## Test Scenarios

### Scenario A: Schedulable High Risk

- **Input**: Alert with RUL P10=7, P50=10, P90=14, confidence=75%
- **Expected**: Task scheduled with status='scheduled'
- **Verify**: Appears in scheduledTasks array, grid shows task chip

### Scenario B: Scheduling Conflict

- **Input**: Alert with RUL P10=6, P50=5, P90=3, confidence=90%
- **Expected**: Task blocked with blockReason='scheduling_conflict'
- **Details**: With P10=6 and P90=3: earliestStart=max(1,6-2)=4, latestFinish=max(1,3-2)=1
- **Calculation**: 4 > 1 triggers scheduling_conflict
- **Verify**: Appears in blockedTasks array with reason 'scheduling_conflict'

### Scenario C: Capacity Conflict

- **Input**: Two alerts same vessel, identical RUL windows (P10=7, P50=10, P90=14)
- **Expected**: First task scheduled, second blocked with blockReason='capacity'
- **Details**: Vessel can only have 1 task per preferred date
- **Verify**: scheduledTasks=1, blockedTasks=1

### Scenario D: Insufficient Confidence

- **Input**: Alert with failureProbability=0.75 (confidence = (1-0.75)*100 = 25%)
- **Expected**: Task blocked with blockReason='insufficient_confidence'
- **Details**: Confidence 25% is below the 50% threshold
- **Verify**: blockedTasks array contains task with reason 'insufficient_confidence'

## API Endpoints

### GET /api/pdm/schedule

Returns schedule grid, KPIs, and blocked tasks.

**Query Parameters:**
- `vesselIds` - Comma-separated vessel IDs
- `equipmentTypes` - Comma-separated equipment types
- `startDate` - ISO date (YYYY-MM-DD)
- `endDate` - ISO date (YYYY-MM-DD)

**Response:**
```json
{
  "kpis": {
    "tasksScheduledThisWeek": 3,
    "unassignedHighRiskCount": 1,
    "expectedDowntimeForecastHours": 12,
    "expectedDowntimeForecastCost": 3900
  },
  "scheduledTasks": [...],
  "blockedTasks": [...],
  "vessels": [...],
  "dateRange": { "start": "2026-01-06", "end": "2026-01-12" }
}
```

### GET /api/pdm/export/schedule

Exports schedule to CSV format.

**Query Parameters:** Same as /api/pdm/schedule

**Columns:**
- Vessel, Equipment, EquipmentType, FailureMode, Severity
- RUL_P10, RUL_P50, RUL_P90, Confidence
- EarliestStart, PreferredDate, LatestFinish, ScheduledDate
- Status, BlockReason, EstDowntimeHrs, EstCost
- WorkOrderId, RecommendedActions

### GET /api/pdm/filter-options

Returns available filter options for vessels and equipment types.

**Response:**
```json
{
  "vessels": [{ "id": "...", "name": "..." }],
  "equipmentTypes": ["Engine", "Pump", "Generator"]
}
```

## RUL Window Computation

The scheduling window is computed from RUL quantiles using these formulas:

```
PREP_TIME_DAYS = 1
BUFFER_DAYS = 2

earliestStart = today + max(PREP_TIME_DAYS, P10_days - BUFFER_DAYS)
preferredDate = today + max(PREP_TIME_DAYS, P50_days - BUFFER_DAYS)  
latestFinish  = today + max(PREP_TIME_DAYS, P90_days - BUFFER_DAYS)
```

**Note**: All dates use max(PREP_TIME_DAYS, X) to ensure minimum 1-day lead time.

Constants:
- PREP_TIME_DAYS = 1
- BUFFER_DAYS = 2
- DEFAULT_DOWNTIME_HOURS = 4
- DOWNTIME_COST_PER_HOUR = 325

## Block Reasons

| Reason | Condition |
|--------|-----------|
| `insufficient_confidence` | confidence < 50% |
| `capacity` | Vessel already has task scheduled on preferred date |
| `scheduling_conflict` | earliestStart > latestFinish (RUL window too short) |

## Troubleshooting

### No Tasks Appearing

1. Check if failure_predictions has data: 
   ```sql
   SELECT COUNT(*) FROM failure_predictions WHERE org_id = 'default-org-id';
   ```
2. Ensure equipment has vessel assignments:
   ```sql
   SELECT e.id, e.name, e.vessel_id, v.name as vessel_name 
   FROM equipment e LEFT JOIN vessels v ON e.vessel_id = v.id;
   ```
3. Check for resolved predictions (should have NULL resolved_by_work_order_id):
   ```sql
   SELECT id, failure_mode, resolved_by_work_order_id 
   FROM failure_predictions WHERE org_id = 'default-org-id';
   ```

### Tasks All Blocked

1. Check confidence values (need >= 50%):
   ```sql
   SELECT id, failure_mode, 
          (confidence_interval->>'lowDays')::int as p10,
          remaining_useful_life as p50,
          (confidence_interval->>'highDays')::int as p90
   FROM failure_predictions;
   ```
2. Check RUL values (need sufficient window - P90 > P10 + BUFFER_DAYS)
3. Check vessel capacity (only 1 task per vessel per preferred date)

### CSV Export Empty

1. Verify filters match existing data
2. Check date range includes scheduled/blocked tasks
3. Inspect network response for errors

### Capacity Conflicts Not Triggering

For capacity blocking to work, equipment must be on the same vessel:
```sql
SELECT e.id, e.name, e.vessel_id 
FROM equipment e 
WHERE e.vessel_id = 'your-vessel-id';
```
