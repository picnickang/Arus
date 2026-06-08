# Security And Audit Status

## Status

Critical security posture has partial deterministic proof, but the application is not yet fully security-cleared for production.

## Evidence

| Area                                | Evidence                                                 | Result                |
| ----------------------------------- | -------------------------------------------------------- | --------------------- |
| API auth denial                     | `vessel-performance-auth`                                | Pass                  |
| Cross-tenant API denial             | `vessel-performance-auth`, `rag-conversation-ownership`  | Pass                  |
| WebSocket tenant scoping            | `websocket-strict-mode`                                  | Pass                  |
| Work-order assignment authorization | `work-order-assignment-route-gate`                       | Pass                  |
| RAG security admin gate             | Existing suite remains visible; not yet in embedded lane | Needs migration/proof |
| Permission audit read               | `permission-audit-read`                                  | Pass                  |

## Remaining Gaps

- Full privilege-escalation matrix is not green in the default lane.
- File upload abuse coverage is partial.
- Audit logging for permission changes, role changes, user lifecycle, crew archive/delete, inventory stock changes, work-order closeout, safety alarm lifecycle, and media delete/replace is incomplete.
- PostgreSQL audit-chain verification is in the Postgres lane and requires `DATABASE_URL`.

## Required Before Full Production

- Promote role and audit suites into deterministic lanes.
- Add high-risk media upload abuse tests.
- Run Postgres audit-chain verification in CI against a disposable Postgres service.
