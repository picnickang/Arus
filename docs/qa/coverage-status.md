# Coverage Status

Updated: 2026-06-09

## Gate

`npm run test:coverage:summary` uses the existing Jest coverage floor:

- Statements: 20%
- Branches: 20%
- Functions: 20%
- Lines: 20%

The threshold was not lowered, and production files were not excluded to improve the score.

## Baseline Before This Pass

Initial coverage run failed because `server/cost-savings-engine/procurement-costs.integration.test.ts` depended on a live `localhost:5000` service:

- Statements: 5.33%
- Branches: 3.88%
- Functions: 4.96%
- Lines: 5.28%
- Suites: 1 failed, 100 passed
- Tests: 4 failed, 1322 passed

Root cause: the procurement cost integration test used direct HTTP calls against an assumed running server instead of a deterministic test app, service test, or embedded database fixture.

## Coverage After Deterministic Runtime Fix

After replacing the live-service procurement test with deterministic service coverage and adding embedded runtime smoke coverage, the full coverage command is stable but still below the release threshold:

- Statements: 12.66%
- Branches: 5.16%
- Functions: 9.95%
- Lines: 12.88%
- Suites: 102 passed, 102 total
- Tests: 1326 passed, 1326 total

Result: coverage execution is deterministic, but `npm run test:coverage:summary` still fails the 20% threshold.

## Coverage After Continued Behavior-Test Wave

After adding behavior-first coverage for the Vessel Diagram Registry service/store boundary, workflow attention aggregation and persistence, vessel intelligence calculation helpers, and AMOS/Shipmate import field mapping, the coverage command still runs cleanly but remains below the release threshold:

- Statements: 13.85%
- Branches: 6.63%
- Functions: 12.15%
- Lines: 14.03%
- Suites: 106 passed, 106 total
- Tests: 1344 passed, 1344 total

Result: all coverage suites pass, but `npm run test:coverage:summary` still fails the 20% global coverage threshold.

## Coverage After Inventory, Safety, And Crew-Admin Wave

After adding behavior-first coverage for inventory application mutations, safety alarm lifecycle rules, and crew-admin access/offboarding behavior, the full coverage command still executes deterministically and all suites pass, but the global threshold remains below the required 20% floor:

- Statements: 14.31%
- Branches: 7.18%
- Functions: 12.71%
- Lines: 14.49%
- Suites: 109 passed, 109 total
- Tests: 1364 passed, 1364 total

Result: `npm run test:coverage:summary` still fails only the global coverage thresholds.

Supplemental focused attribution runs were also used to verify the new tests cover their intended high-risk modules:

- `server/domains/inventory/application/inventory-service.test.ts` plus `server/domains/safety-alarms/application/safety-alarm-service.test.ts`, scoped to their two services: 96.55% statements, 94.36% branches, 100% functions, 96.55% lines.
- `server/domains/crew-admin/application/crew-admin-service.test.ts`, scoped to `crew-admin-service.ts`: 60.21% statements, 48.13% branches, 71.62% functions, 60.16% lines.

## Coverage After Work-Order And Crew-Task Wave

After adding behavior-first coverage for work-order assignment transactions and crew-task side effects, the full coverage command executed deterministically outside the workspace sandbox. The initial sandboxed run failed because `tsx` IPC pipes and `supertest` local listeners were blocked by sandbox permissions; the escalated run confirmed those were not code failures.

- Statements: 14.36%
- Branches: 7.22%
- Functions: 12.78%
- Lines: 14.54%
- Suites: 110 passed, 110 total
- Tests: 1369 passed, 1369 total

Result: `npm run test:coverage:summary` still fails only the global coverage thresholds.

## Coverage After Briefing, KB, Import, And Runtime-Lane Expansion

After adding behavior-first coverage for briefing generation, KB upload validation, legacy work-order service behavior, AMOS/Shipmate dry-run imports, and expanding the coverage config to include the deterministic embedded/server integration lanes, coverage improved materially but still remains below the 20% global floor:

- Statements: 17.50%
- Branches: 9.96%
- Functions: 16.01%
- Lines: 17.73%
- Suites: 133 passed, 2 failed during cleanup, 135 total
- Tests: 1590 passed, 1590 total

The two failed suites were not assertion failures. They were cleanup-order failures caused by a shared embedded SQLite client already being closed when `afterAll` cleanup attempted best-effort fixture deletion:

- `tests/integration/lr35-pdm-promote-rollback-gate.test.ts`
- `tests/integration/rag-conversation-ownership.test.ts`

Both suites were then fixed to tolerate an already-closed libSQL client only during cleanup, and a focused rerun passed:

- Command: `node --max-old-space-size=8192 --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.coverage.config.mjs --runInBand --runTestsByPath tests/integration/lr35-pdm-promote-rollback-gate.test.ts tests/integration/rag-conversation-ownership.test.ts`
- Result: 2 suites passed, 21 tests passed

Result: coverage execution is now closer to the release gate and the cleanup flake is fixed, but `npm run test:coverage:summary` still fails the global 20% coverage threshold. Based on the latest JSON summary, passing the current global floor requires roughly 1,541 additional covered statements, 3,802 additional covered branch arms, 464 additional covered functions, and 1,344 additional covered lines against the current denominator.

## Coverage After Deterministic Integration Promotion

After fixing the cleanup-order flake, additional deterministic integration suites were promoted into the coverage lane for AMOS golden imports, PdM decision-support routes, operator information routes, operator experience routes, attention inbox role gates, safety bulletin routes and feed behavior, compliance exports, feature-flag tenant isolation, tenant quota throttling, permission grant lockout, role hub-access auditing, 403 role matrices, RAG security admin gates, and equipment dependency graph projection.

The full coverage command now runs substantially more runtime proof without assertion failures:

- Statements: 18.05%
- Branches: 10.45%
- Functions: 16.59%
- Lines: 18.29%
- Suites: 150 passed, 150 total
- Tests: 1696 passed, 1696 total

Result: `npm run test:coverage:summary` still exits non-zero because the unchanged 20% global threshold is not met. With the current denominator, passing the floor requires approximately 1,200 additional covered statements, 3,617 additional covered branch arms, 396 additional covered functions, and 1,014 additional covered lines.

Coverage-lane test quality caveat: a few older promoted suites still contain warning-based readiness fallbacks, such as route import-shape or DB/app readiness warnings, even when the Jest suite result is passing. These should be converted into explicit deterministic setup or explicit quarantine decisions before relying on the coverage lane as a final release gate.

Additional promotion probes were intentionally not added to the coverage lane:

- `tests/integration/crew-photo-object-serving.test.ts` passed with real object-serving assertions, but was not added after the latest full coverage run because the gate remained far below threshold and a single media-serving suite would not materially change the global result without another long rerun.
- `tests/integration/cross-tenant-domains.test.ts` and `tests/integration/rls-cross-tenant-api.test.ts` reported passing suites but emitted DB/RLS readiness skip warnings, so they need deterministic setup hardening before promotion.
- `tests/integration/crew-suite/**` still depends on a manually running `127.0.0.1:5000` service and failed with `ECONNREFUSED`, so those suites remain outside the deterministic coverage lane.
- `tests/integration/findings.test.ts`, `tests/integration/schematic-layout-crud.test.ts`, `tests/integration/workflow-gap-closure.test.ts`, `tests/integration/rag-conversations.test.ts`, and `tests/integration/task-235-domains.test.ts` still have stale route/status/schema expectations or embedded route 500s that must be fixed before promotion.

## Meaningful Coverage Added

- Procurement cost rollup now verifies draft service orders are excluded from totals.
- Procurement cost rollup now verifies finalized service order actual amounts are aggregated into work order totals.
- Embedded runtime coverage now boots the real test app in embedded SQLite mode.
- Runtime readiness coverage now verifies `/api/healthz` and `/api/readyz` without requiring production `DATABASE_URL` or manually running localhost.
- Vessel Diagram Registry service coverage now verifies tenant-scoped diagrams, upload/media persistence, active version publishing, section map creation, section CRUD, equipment assignment CRUD, thumbnail upload/delete, replacement behavior side effects, validation blockers, clone/archive/restore/delete flows, and missing-source error paths.
- Workflow attention service coverage now verifies alert/work order/equipment/inventory aggregation, queue counts, source health, handover persistence, blocker resolution persistence, issue report target routing, partial source failures, input normalization, and test-isolated state persistence.
- Vessel intelligence helper coverage now verifies dashboard calculation behavior for vessel age, operating hours, average resolution time, equipment health, compliance scoring, cost trends, environmental factors, predictive lead time, and recommendation priority.
- AMOS and Shipmate import-adapter coverage now verifies deterministic field mappings, required-field errors, default values, transform warnings, module dispatch, equipment hierarchy, criticality, date parsing, running hours, status mapping, job/store/crew certification/rest-hour mappings, and unmapped-field preservation.
- Inventory application service coverage now verifies org-scoped read delegation, create/update/delete events, stock metadata, low-stock threshold crossing, missing-record failure behavior, and no event emission on failed mutations.
- Safety alarm application service coverage now verifies protected alarm type seeding, inactive filtering, custom key normalization, protected type immutability, serious-alarm confirmation and resolution-note requirements, vessel-scoped acknowledgement, fleet-wide acknowledgement, route-facing validation codes, and alarm list delegation.
- Crew administration service coverage now verifies protected role lifecycle rules, role hub grant eligibility, permission-cache invalidation, crew access readiness, former-crew access risk, vessel assignment validation, secondary-role assignment dedupe, supervisor validation, user hub access gating, last-admin lockout prevention, credential boundary errors, crew login linking, and offboarding access revocation without record deletion.
- Work-order assignment service coverage now verifies transactional create behavior, post-commit event and WebSocket broadcast boundaries, completion persistence, completion post-commit emission, inventory projection invocation, and no-projection behavior when completion lacks org context.
- Crew task application service coverage now verifies read delegation, persistence-first create effects, changed-field audit detection, no-op update suppression, missing-task no-effect behavior, delete/comment effects after existence confirmation, and empty activity-log behavior when the event repository is absent.
- Briefing generator coverage now verifies deterministic section assembly, app-generated UUID behavior, fallback summary behavior when no OpenAI key is configured, date serialization compatibility, and embedded SQLite-safe ID generation.
- KB upload validation coverage now verifies MIME allow-listing, magic-byte validation for PDF/PNG/JPEG uploads, spoofed-content rejection, staged-file validation, oversized upload rejection, and malformed content rejection.
- Legacy work-order service coverage now verifies clone/delete/complete behavior, completion notes and actual-hours persistence, missing-record failure behavior, and current service gaps exposed by embedded SQLite schema drift.
- AMOS and Shipmate dry-run import coverage now verifies parser/header normalization, equipment/work-order/parts/maintenance/job/store/crew/rest-hour mapping, malformed-row error reporting, and empty-file rejection without writing to production storage.
- Coverage configuration now includes the proven deterministic embedded integration lane and explicit server/e2e lane so route-level permission, RAG ownership, KB upload, PDM promote/rollback gate, vessel registry, briefing, outcome, activity, telemetry, and object-storage concurrency coverage contribute to the release signal.
- Promoted integration coverage now also exercises AMOS golden imports, PdM decision-support contracts, operator information/experience routes, attention role gates, safety bulletin filtering and tenant scoping, compliance exports, feature-flag tenant isolation, tenant quota throttling, permission-grant lockout, role hub-access auditing, 403 role matrices, RAG security admin gates, and equipment dependency graph projection.

## High-Risk Areas Now Covered

- Cost-savings procurement rollup behavior.
- Work order procurement total persistence boundary.
- Embedded runtime app boot path.
- Embedded SQLite readiness reporting.
- Deterministic non-production server health/readiness path.
- Vessel Diagram Registry tenant and media mutation boundaries.
- Attention workflow operator queue aggregation and persisted handover/blocker/issue state.
- Vessel intelligence calculation helpers that feed operational dashboard values.
- Maritime import adapter mappings for AMOS and Shipmate source data.
- Inventory mutation service behavior and event publication boundaries.
- Safety alarm lifecycle and vessel/fleet scoping rules.
- Crew-admin permission-adjacent access, offboarding, and organization-scoped readiness behavior.
- Work-order assignment transaction semantics, post-commit side effects, and completion projection boundaries.
- Crew task mutation side effects and missing-record safety behavior.
- Agent briefing generation and fallback serialization in embedded SQLite.
- KB upload MIME, size, and magic-byte validation boundaries.
- RAG conversation ownership, PDM promote/rollback permission gates, and deterministic route-lane runtime behavior.
- AMOS/Shipmate dry-run import parsing and validation boundaries.

## Remaining High-Risk Coverage Gaps

The full coverage denominator still includes many large production modules with little or no coverage. The largest remaining gaps include:

- Crew extension scheduler routes.
- Work order route/controller behavior beyond assignment service coverage.
- Inventory database receive, reserve, and consume paths.
- Equipment intelligence repositories.
- Knowledge-base document persistence and retrieval beyond upload validation.
- WebSocket tenant propagation behavior.
- PostgreSQL-specific route and repository contract coverage.
- Embedded SQLite work-order route parity: the legacy `tests/integration/work-orders.test.ts` still fails because the SQLite `work_orders` table is missing `cost_justification`, and the legacy test payload still uses stale priority semantics.
- Large route/repository files with near-zero branch coverage, including crew scheduler routes, PDM routes/repositories, equipment intelligence repositories, RAG route branches, permissions routes, AMOS/Shipmate non-dry-run persistence paths, and analytics/checklist repositories.
- Coverage-lane determinism cleanup: older promoted suites that warn and return early when app/bootstrap shape changes should be hardened so passing suites always mean assertions executed.
- Legacy integration promotion blockers: crew-suite tests need an embedded test app instead of live `localhost:5000`; schematic-layout CRUD needs embedded route/schema repair; findings/RAG/task-235 expectations need to be reconciled with current auth and validation behavior.
- Frontend/browser coverage is proven through Playwright smoke, but not included in Jest coverage.

## Assessment

This pass improved runtime proof and removed non-deterministic coverage failures, then raised coverage with behavior-first tests for high-risk production modules. Coverage remains a release blocker. The next productive wave should prioritize high-branch modules that can be exercised deterministically: embedded SQLite work-order route/schema parity, inventory database receive/reserve/consume repositories, WebSocket tenant propagation, permissions/RAG route branches, PDM route/repository contracts, and AMOS/Shipmate non-dry-run persistence paths.
