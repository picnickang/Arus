---
name: Integration-test jest ESM mocking + db-config import wall
description: How to mock modules in the ARUS integration jest config, and why importing real route modules in-process crashes.
---

The integration jest config (`jest.config.mjs` → `jest.integration.config.mjs`) runs **native ESM** (`extensionsToTreatAsEsm: ['.ts']`, swc transform `module.type: es6`).

- `jest.mock(...)` is a **no-op** here. It silently does nothing — mocks appear "set" but never intercept. Use `jest.unstable_mockModule(specifier, factory)` and then `await import(...)` the module under test **after** the mock call (top-level mock call runs before `beforeAll`). Reference the mock fns (e.g. an `authorizeMock`) defined *before* the `unstable_mockModule` call.

**Why:** silently-ignored `jest.mock` is the #1 cause of "false-green" RBAC/negative tests — the real router fails to import, the suite's `if(!mountedOk) return` guards make every gate test pass trivially, and nobody notices the gate was never exercised. Always add a harness-sanity test asserting `mountErr === null` so a mount failure fails loudly.

**db-config import wall:** importing the real crew-admin / safety-alarms / crew-lifecycle route modules in-process pulls `server/db-config.ts`, which **eagerly** runs `drizzlePgNode(pool, { schema })` at module load. Under jest that throws `Cannot read properties of null (reading 'constructor')` (drizzle introspecting the mapped `@shared/schema-runtime` mock). Mocking db-config itself is fragile. Instead, for negative permission/role tests, import and mount the **real gate middlewares** (`requireRole` from `server/middleware/role-auth.ts`, `requirePermission` from `server/domains/permissions/middleware.ts`) on stub handlers, wired with the production allow-lists / resource+action pairs copied verbatim from the route files. Those middlewares carry no db-config dependency (role-auth only imports a type from `./auth`; the perm middleware's `./service` is the thing to `unstable_mockModule`).

**How to apply:** positive CRUD/persistence → hit the live dev server on :5000 (runs every request as the fixed dev admin, full perms). Negative perm/role enforcement → in-process supertest with the real middlewares + `unstable_mockModule`. Don't try to import full route-registration modules in-process.
