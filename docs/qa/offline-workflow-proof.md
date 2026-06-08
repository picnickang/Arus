# Offline Workflow Proof

## Status

Partial proof exists. Embedded/local boot and selected offline-safe services are covered, but full offline workflow readiness is not proven.

## Evidence

- Embedded integration lane runs without `DATABASE_URL`.
- Unit coverage exists for offline conflict handling and object ownership gates.
- Deterministic integration coverage exists for telemetry and work-order assignment behavior.

## Remaining Gaps

- Inventory receive/reserve/consume in offline mode needs deterministic integration proof.
- Work order create/update/complete in offline mode needs deterministic integration proof.
- Safety acknowledgement and alert lifecycle in offline mode need deterministic integration proof.
- Crew update, sync retry, conflict handling, and restart-with-local-SQLite flows need broader runtime proof.

## Required Before Full Production

- Promote core maritime workflows from legacy forms/journeys into embedded tests with local fixtures and cleanup.
- Add restart-persistence checks against local SQLite for inventory, work orders, safety, crew, and sync outbox.
