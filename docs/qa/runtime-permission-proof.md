# Runtime Permission Proof

## Status

Partial proof exists through deterministic integration slices. This is not yet a complete role-by-role production proof.

## Evidence

| Role/Area                      | Endpoint/Flow                                   | Expected                            | Actual                                                                    | Result |
| ------------------------------ | ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- | ------ |
| unauthenticated                | Vessel Performance API routes                   | 401                                 | 401 in `vessel-performance-auth`                                          | Pass   |
| cross-org user                 | Vessel Performance vessel/narrative reads       | denied                              | denied in `vessel-performance-auth`                                       | Pass   |
| admin/super-admin primary role | `/api/permissions/me` and hub access resolution | access includes primary role grants | covered in `permissions-me-primary-role` and `permissions-hub-resolution` | Pass   |
| non-admin                      | hub access resolution                           | no unintended access                | covered in `permissions-hub-resolution`                                   | Pass   |
| work-order assignee            | assignment response routes                      | only assigned crew can respond      | covered in `work-order-assignment-route-gate`                             | Pass   |
| RAG conversation owner         | RAG conversation read/update/export             | owner allowed, non-owner denied     | covered in `rag-conversation-ownership`                                   | Pass   |
| WebSocket tenant clients       | tenant-scoped broadcasts                        | only matching tenant receives event | covered in `websocket-strict-mode`                                        | Pass   |

## Remaining Gaps

- Full role matrix is not yet proven for `company_admin`, `fleet_manager`, `captain`, `chief_engineer`, `logistics`, `technician`, `crew`, and `viewer` across every hub.
- Browser-level direct URL checks are not yet in a green Playwright lane.
- Legacy permission matrix tests remain outside the default lane until migrated.

## Required Before Full Production

- Promote `role-403-matrix.test.ts`, `role-hub-access-audit.test.ts`, and related permission suites into the embedded lane or the Postgres lane after deterministic cleanup.
- Generate and compare a runtime role-permission matrix in CI.
