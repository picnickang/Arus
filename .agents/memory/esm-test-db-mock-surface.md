---
name: ESM test db-mock export surface
description: Why jest.unstable_mockModule("server/db") must mirror the full re-export surface, and how to predicate-test drizzle queries without a real DB.
---

# ESM integration-test db mock must mirror server/db's FULL named exports

When an `--experimental-vm-modules` integration test does
`jest.unstable_mockModule("../../server/db", () => ({ db: {...} }))` and then
dynamically imports a route module, ESM linking fails with
`The requested module '../../db' does not provide an export named 'X'` if any
transitive importer pulls a named export the mock omits.

`server/db` re-exports `{ db, pool, isLocalMode, deploymentMode, libsqlClient }`
from `db-config`. The audit chain (`compliance/immutable-audit/log-event-postgres.ts`)
imports `pool`; others import the dual-mode flags. So a route-mounting test must
stub ALL of them (only `db` needs real behaviour; the rest can be `{}`/`false`/
`undefined`).

**Why:** the error surfaces at module-link time (before any test logic), and the
missing export name changes as the import graph grows, so chasing them one at a
time is whack-a-mole. Mirror the whole re-export list once.

**How to apply:** when a `*.test.ts` that mocks `server/db` starts failing at
`await import(".../routes")` with a "does not provide an export named …" error,
re-read `server/db`'s re-export list and add every name to the mock factory.

# Predicate-aware drizzle mock to catch column regressions (id vs name)

A db mock whose `.where()` ignores its condition cannot catch a wrong-column
regression (e.g. matching by `roles.name` when it should be `roles.id`). To make
the test bite: walk the drizzle SQL condition's `queryChunks` — column refs carry
a `.name` (DB column) and `Param` nodes carry `.value` — associate each param
with the most recent column, then filter fixture rows by those column/param sets.
Give fixtures an `id` that differs from `name` so a name-match drops the row.

**Why:** the ID-vs-name hub-resolution bug got the role-access task rejected
twice; a predicate-blind mock would have let it regress silently.

**How to apply:** see `tests/integration/permissions-hub-resolution.test.ts`
(`collectColumnParams` + `rolesForCondition`). Proven by flipping the service to
`inArray(roles.name, …)` → the assigned-role test fails; restore → passes.
