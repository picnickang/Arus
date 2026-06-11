# Integration Tests

## Overview

These integration tests verify the full API request/response cycle including database operations.

## Current Status

**Integration tests are NOT included in default test run** (`npm test`).

The dual-mode schema (PostgreSQL/SQLite) architecture creates complexity with Jest's ESM module linker that requires a specialized setup to resolve.

## Technical Challenge

The `schema-runtime.ts` file uses runtime ternaries to conditionally export 173+ tables:

```typescript
export const workOrders = isLocalMode ? sqliteVessel.workOrdersSqlite : pgSchema.workOrders;
```

Jest's ESM module linker needs static exports at link time, causing crashes with:

```
TypeError: Cannot read properties of null (reading 'constructor')
at extractTablesRelationalConfig (drizzle-orm/relations.ts)
```

## Available Tests

### Unit Tests (Default - Always Run)

Located in `tests/unit/`:

- `api-helpers.test.ts` - 23 tests for pagination, validation, and utility functions

Run with: `npm test`

### Integration Test Templates (Require Manual Setup)

Located in `tests/integration/`:

- `work-orders.test.ts` - Work order CRUD and lifecycle
- `crew-scheduling.test.ts` - Crew scheduling and assignments
- `telemetry.test.ts` - Telemetry ingestion pipeline
- `compliance-exports.test.ts` - Excel/PDF export generation
- `rag-conversations.test.ts` - RAG conversation system

## Running Integration Tests (Advanced)

To run integration tests, you would need to:

1. Create a complete PostgreSQL-only schema facade (not using conditional exports)
2. Update `tests/mocks/schema-runtime.ts` to explicitly export all 173+ tables
3. Ensure DATABASE_URL points to a seeded PostgreSQL database

```bash
# Run specific integration test (requires schema facade fix)
npm test -- --testPathPatterns="work-orders" --config jest.integration.config.mjs
```

## Future Work

To fully enable integration tests:

1. Create a generated `tests/mocks/schema-runtime-pg.ts` that exports all PostgreSQL tables directly
2. Or: Mock at the storage layer level instead of the schema level
3. Or: Use Vitest which has better ESM support than Jest

## Recommended Approach

For reliable testing without database dependencies, use unit tests:

```typescript
import { parsePagination } from "../../server/lib/api-helpers.js";
// Test pure functions without database dependencies
```
