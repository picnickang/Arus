# Vessel Intelligence v2 Schema Guard Proof

Date: 2026-06-07

This note compares `origin/main` with the local Vessel Intelligence v2 branch for the two known schema guard failures.

## Commands

```bash
npm run check:schema
npm run check:schema-imports
```

The `origin/main` proof was run from a detached temporary worktree at commit `5a9ff91b1abf42386f41f15a674bdbbc93f57370`.

The local branch proof was run from commit `837f1e59926de07cc7147094c8bdc9ffb15406cf` plus the current working-tree changes.

## `check:schema`

Both `origin/main` and the local branch report the same 15 blocking drift rows:

- `workOrders`
- `maintenanceCosts`
- `partFailureHistory`
- `alertSuppressions`
- `complianceDocs`
- `portCall`
- `drydockWindow`
- `immutableAuditTrail`
- `predictionDataQuality`
- `requestIdempotency`
- `sheetLock`
- `sheetVersion`
- `dbSchemaVersion`
- `scheduleAssignments`
- `scheduleUnfilled`

The local branch increases guarded/runtime exports and Postgres tables because it adds the Vessel Intelligence registry schema, but no `vessel_*` registry table appears in the failure list.

| Ref | Guarded exports | PG tables found | SQLite tables found | Blocking drift |
| --- | ---: | ---: | ---: | ---: |
| `origin/main` | 209 | 284 | 130 | 15 |
| local branch | 217 | 292 | 130 | 15 |

## `check:schema-imports`

Both `origin/main` and the local branch report 40 schema import boundary violations.

The failure path list is identical across refs and contains no file under:

- `server/domains/vessel-diagram-registry/`
- `shared/schema/vessel-diagram-registry.ts`
- `client/src/pages/vessel-intelligence/`

## Conclusion

The schema guard failures are pre-existing. This Vessel Intelligence v2 change adds registry schema exports and tables, but it does not introduce new `check:schema` drift rows or new `check:schema-imports` violations.
