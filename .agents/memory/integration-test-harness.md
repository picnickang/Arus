---
name: Integration test harness (jest ESM + db mode)
description: How to run/author server integration tests in this repo, and why they crash in the cloud-mode sandbox.
---

# Running integration tests

Run them via `npm run test:integration` (or `node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.integration.config.mjs --runInBand`).

- The `--experimental-vm-modules` flag is mandatory. Without it, jest loads `.ts` as CJS scripts and any server module reached through the heavy chain (e.g. `server/routes/rag-routes` → services → openai → repositories → `server/db-config.ts`) throws `SyntaxError: await is only valid in async functions...` because `db-config.ts` uses top-level await. `npx jest` alone does NOT pass this flag.
- `jest.integration.config.mjs` overrides base `testMatch` to include `tests/integration/**/*.test.ts`, so integration files there are picked up by that config (not by the base `jest.config.mjs`, which only matches `server/**` and `tests/unit/**`).

# Why they fail to even boot in this Replit sandbox

`tests/setup.ts` forces `ARUS_DEPLOYMENT_MODE=CLOUD` and `@shared/schema-runtime` is mocked to `tests/mocks/schema-runtime.ts`. In cloud mode `db-config.ts` calls `drizzlePgNode(pgPool, { schema })` at module load, and the mocked/partial schema makes drizzle's `extractTablesRelationalConfig` crash with `Cannot read properties of null (reading 'constructor')`. This breaks integration tests that reach the real `db-config.ts` in the sandbox — verified the unmodified `tests/integration/rag-conversations.test.ts` fails identically. Rely on `npx tsc --noEmit` + review locally, and let CI (local/SQLite mode) run them.

**Escape hatch that DOES run in-sandbox:** a route/repo test that `jest.unstable_mockModule("../../server/db-config", () => ({ __esModule: true, db: <fake-chain> }))` never loads the real `db-config.ts`, so it sidesteps both the top-level-await transform AND the schema-null crash. With the mock in place you can import the REAL route + REAL use-case + REAL repository (they only pull `{ db }` from db-config) and drive the Drizzle chain with a fake. The fake only needs the chains the path actually exercises (e.g. acknowledge = `select().from().where().orderBy().limit()` + `update().set().where().returning()`). `equipment-hub-acknowledge.test.ts` does exactly this and passes 8/8 in the sandbox. Still requires `--experimental-vm-modules`.

**Why:** burned multiple attempts diagnosing this (transform error → wrong jest flag → schema-null crash) before realizing it's environmental, not test-authoring, error.

**How to apply:** when an integration test "fails to run" in the sandbox with the drizzle null-constructor crash, don't chase it — confirm an unmodified integration test fails the same way, then verify via tsc + review and skip execution.
