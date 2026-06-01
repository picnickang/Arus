---
name: Integration test harness (jest ESM + db mode)
description: How to run/author server integration tests in this repo, and why they crash in the cloud-mode sandbox.
---

# Running integration tests

Run them via `npm run test:integration` (or `node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.integration.config.mjs --runInBand`).

- The `--experimental-vm-modules` flag is mandatory. Without it, jest loads `.ts` as CJS scripts and any server module reached through the heavy chain (e.g. `server/routes/rag-routes` → services → openai → repositories → `server/db-config.ts`) throws `SyntaxError: await is only valid in async functions...` because `db-config.ts` uses top-level await. `npx jest` alone does NOT pass this flag.
- `jest.integration.config.mjs` overrides base `testMatch` to include `tests/integration/**/*.test.ts`, so integration files there are picked up by that config (not by the base `jest.config.mjs`, which only matches `server/**` and `tests/unit/**`).

# Why they fail to even boot in this Replit sandbox

`tests/setup.ts` forces `ARUS_DEPLOYMENT_MODE=CLOUD` and `@shared/schema-runtime` is mocked to `tests/mocks/schema-runtime.ts`. In cloud mode `db-config.ts` calls `drizzlePgNode(pgPool, { schema })` at module load, and the mocked/partial schema makes drizzle's `extractTablesRelationalConfig` crash with `Cannot read properties of null (reading 'constructor')`. This breaks ALL integration tests in the sandbox — verified the unmodified `tests/integration/rag-conversations.test.ts` fails identically. So integration tests can't be executed here; rely on `npx tsc --noEmit` + architect review locally, and let CI (local/SQLite mode) run them.

**Why:** burned multiple attempts diagnosing this (transform error → wrong jest flag → schema-null crash) before realizing it's environmental, not test-authoring, error.

**How to apply:** when an integration test "fails to run" in the sandbox with the drizzle null-constructor crash, don't chase it — confirm an unmodified integration test fails the same way, then verify via tsc + review and skip execution.
