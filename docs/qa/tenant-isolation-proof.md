# Tenant Isolation Proof

## Status

Partial proof exists. API, WebSocket, object ownership, RAG conversation ownership, and selected vessel-performance paths have deterministic coverage. Full multi-entity tenant isolation remains incomplete.

## Evidence

| Area                                | Test Evidence                                                 | Result                |
| ----------------------------------- | ------------------------------------------------------------- | --------------------- |
| WebSocket tenant propagation        | `tests/integration/websocket-strict-mode.test.ts`             | Pass                  |
| Vessel performance cross-org access | `tests/integration/vessel-performance-auth.test.ts`           | Pass                  |
| RAG conversation ownership          | `tests/integration/rag-conversation-ownership.test.ts`        | Pass                  |
| KB upload/object boundaries         | `tests/integration/kb-upload-reliability.test.ts`             | Pass in embedded lane |
| Object storage client safety        | `tests/integration/object-storage-client-concurrency.test.ts` | Pass in embedded lane |

## Remaining Gaps

- Crew, vessels, equipment, inventory, work orders, safety alerts, documents, vessel registry records, and media references are not all proven through a single deterministic tenant-isolation matrix.
- PostgreSQL RLS tenant isolation remains in the explicit Postgres lane.
- Legacy forms and journey suites still carry direct `pg` and live-server assumptions.

## Required Before Full Production

- Promote entity-by-entity cross-tenant API tests into the embedded lane where possible.
- Keep RLS-specific checks in `test:integration:postgres`.
- Add guessed-ID update/delete attempts for high-risk entities.
