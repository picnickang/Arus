# Embedded SQLite Parity Status

## Status

Embedded mode is improving but not yet full parity with PostgreSQL.

## Current Evidence

- `npm run test:integration:embedded` passed with 17 suites and 141 tests during this stabilization pass.
- The embedded lane covers Agent activity, work-order assignment, permissions, WebSocket strict mode, RAG ownership, object storage concurrency, ML train idempotency, vessel performance auth, Vessel Diagram Registry routes, KB upload reliability, PDM promote/rollback gate, and telemetry.
- Agent SQLite tables were added for activity/briefing/schedule-related storage paths.

## Known Remaining Parity Risks

- Some legacy suites still expose missing or drifted SQLite columns/tables when run in the full aggregate suite.
- Some code paths still emit PostgreSQL-only SQL/function assumptions, such as `gen_random_uuid` in briefing generation.
- Direct `pg` Pool cleanup and assertions in legacy forms/journeys are not SQLite-compatible.

## Required Before Full Production

- Move high-value legacy entity workflows into deterministic embedded suites.
- Replace PostgreSQL-only SQL in embedded routes with portable query builders or driver-specific adapters.
- Keep Postgres-only assertions in the Postgres contract lane.
