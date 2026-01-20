# PdM Test Coverage Documentation

## Test Map

| Feature | Endpoint/Table | Test File | Tier |
|---------|---------------|-----------|------|
| Risk Queue | GET /api/pdm/risk-queue | server/tests/pdm/get-dashboard.test.ts | 0 |
| Dashboard | GET /api/pdm/dashboard | server/tests/pdm/get-dashboard.test.ts | 0 |
| Schedule | GET /api/pdm/schedule | server/tests/pdm/get-schedule.test.ts | 0 |
| Schedule API Contract | GET /api/pdm/schedule | server/tests/pdm/schedule-contract.test.ts | 0 |
| Golden Scenarios | pdm_alerts seeding | server/tests/pdm/schedule-scenarios.test.ts | 0 |
| Scheduling Math | computeBufferDays, etc | server/tests/pdm/get-schedule.test.ts | 0 |
| Property-Based | fast-check invariants | server/tests/pdm/schedule-properties.test.ts | 1 |
| Data Integrity | DB invariants | server/tests/pdm/data-integrity.test.ts | 0 |

## Test Tiers

### Tier 0 (Every PR - Fast)
- API contract regression (schema snapshots)
- Golden scenario integration tests (seeded fixtures)
- Data integrity tests (DB invariants)
- Scheduling math unit tests

### Tier 1 (Nightly - Optional)
- Property-based tests (fast-check)
- Timezone + clock skew tests
- Performance tests
- Security/tenancy tests

## Running Tests

```bash
# Run all PdM Tier 0 tests
npm run test:pdm

# Run specific test file
npm test -- --testPathPattern="server/tests/pdm/get-schedule.test.ts"

# Run Tier 1 tests (optional)
npm run test:pdm:tier1

# Run with coverage
npm run test:coverage -- --testPathPattern="server/tests/pdm"
```

## Test Database

Tests use mocked repositories by default. For integration tests requiring a database:

1. Ensure DATABASE_URL is set (uses test database)
2. Tests set `NODE_ENV=test` automatically
3. Redis and job queue are disabled in test mode

## Seeding

Test fixtures are defined in:
- `server/tests/pdm/fixtures.ts` - Canonical PdM alert cases

### Golden Scenarios

**Case A: Schedulable High Risk**
- severity: high
- RUL: P10=6, P50=8, P90=10
- Expected: Scheduled within week

**Case B: Blocked by Lead Time**
- severity: critical
- RUL: P10=2, P50=3, P90=4
- prep_days: 3
- Expected: blocked, reason=scheduling_conflict

**Case C: Blocked by Capacity**
- Two critical tasks on same vessel/day
- capacity: 8h/day, each task: 6h
- Expected: One scheduled, one blocked reason=capacity

## Updating Snapshots

When API contract changes intentionally:

```bash
npm test -- --updateSnapshot --testPathPattern="schedule-contract"
```

Review changes carefully before committing.

## Adding New Tests

1. Add test file to `server/tests/pdm/`
2. Use existing patterns from `get-schedule.test.ts`
3. Mock repository for unit tests
4. Use fixtures from `fixtures.ts` for consistent scenarios
5. Run `npm run test:pdm` to verify
