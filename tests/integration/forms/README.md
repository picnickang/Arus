# Forms + Journeys Integration Tests

This directory holds CRUD-lifecycle and downstream-propagation tests for every
user-facing form in the app, plus the cross-domain end-to-end journeys that
chain those forms together (`../journeys/`).

## What each test does

For each form we exercise:

1. **Lifecycle** — create via the form's POST endpoint, read back via GET,
   update via PATCH/PUT, and delete (or the closest lifecycle the form
   supports).
2. **Foreign-key integrity** — verify FKs are written, missing parents are
   rejected, deletes/cascades behave as documented.
3. **Downstream propagation** — assert the new/updated/deleted record is
   reflected in the list pages, detail endpoints, dashboards, KPIs, search /
   inbox / feed surfaces, exports, and audit / notification queues that the
   user sees.

Cross-domain journeys live in `../journeys/` and chain several forms together
(e.g. WO → equipment → completion → cost roll-up).

## Conventions

- **Live server.** Tests hit the dev server at `TEST_BASE_URL || http://localhost:5000`.
  Workflows must be running.
- **Headers.** Every request goes through `api()` from `_helpers.ts`, which
  sets `x-org-id: default-org-id`, `x-user-role: admin`,
  `x-user-id: forms-integration-test`.
- **`RUN_ID` per file.** Each test file declares one `RUN_ID = makeRunId(...)`
  at the top. Every string field a test writes (name, title, description,
  notes, wo_number, etc.) embeds that `RUN_ID` so `afterAll` can cascade-delete
  by `RUN_ID` substring.
- **Cleanup.** `cleanupByRunId(RUN_ID, [tables])` deletes any row in the listed
  tables whose stringified text/jsonb columns contain the `RUN_ID`. It is
  best-effort and never throws.
- **Eventual consistency.** Use `retry(fn, predicate, { timeoutMs })` (default
  2 s) for surfaces that depend on async aggregates (cached counters, briefing
  generation, attention inbox).
- **Helpers.** Use `expectInList(path, predicate, msg)` for "the new row shows
  up in the list" assertions and `assertSurfacesHealthy([paths])` for "all
  downstream reads still 2xx after the write".
- **Bootstrap refs.** `getRefIds()` returns one existing
  vessel / equipment / crew / supplier id from the dev DB, cached per-process,
  so tests don't need to seed parents.
- **No production code changes.** If a test surfaces a real propagation bug,
  file a follow-up task — do **not** patch the production code from inside the
  test PR.

## Running

```bash
# Full integration suite (includes these tests):
npm run test:integration

# Just the form / journey tests:
npx jest --config jest.integration.config.mjs tests/integration/forms tests/integration/journeys
```

Adding a top-level `npm run test:forms` alias requires editing `package.json`
which the build constraints disallow. Use the second command above instead.

## Adding a new form test

1. Pick the test file that matches the form's domain (or create a new one
   under `tests/integration/forms/`).
2. At the top: `const RUN_ID = makeRunId("<short-tag>");`.
3. In `afterAll`, call `cleanupByRunId(RUN_ID, ["table_a", "table_b"])` for
   every table the test wrote into.
4. Write at least: a creation test, a read-back / list-membership test, an
   update test (when the form supports it), a delete or lifecycle-end test.
5. Add at least one downstream-propagation assertion (list / detail / KPI /
   audit / inbox / export — whichever surface the form is supposed to feed).
