# ARUS targeted quality fixes — 2026-04-25

This archive applies targeted production-readiness fixes while keeping the existing hexagonal/domain modular structure intact.

## Fixed

1. **Production auth bootstrap**
   - Added `server/bootstrap/public-api-paths.ts` as the canonical public/sensitive API path policy.
   - Excluded `/api/admin/auth/verify`, `/api/admin/auth/status`, `/api/admin/auth/setup`, and setup endpoints from global authentication/org middleware.
   - Also excluded those public routes from the second global tenant-isolation middleware in `server/routes.ts`.

2. **Sensitive response logging**
   - Sensitive API routes now omit response bodies from request logs.
   - Log redaction now catches `sessionToken`, `session_token`, bearer/session fields, and existing token/secret keys.

3. **Single-tenant org consistency**
   - Replaced permissive org validation with canonical single-tenant validation in `server/orgIdValidation.ts`.
   - Any supplied `x-org-id` or `orgId` query must match `DEFAULT_ORG_ID`.
   - Admin auth and authentication code now import `DEFAULT_ORG_ID` rather than duplicating the literal.

4. **PostgreSQL context / RLS safety**
   - Replaced `SET LOCAL app.current_org_id` with `set_config(..., false)` so it is not silently scoped away outside a transaction.
   - Added default single-tenant DB context to `scripts/init-db.sql` and `server/db-security-policies.sql`.
   - Updated RLS comments to be honest: these policies are optional defense-in-depth for the current single-tenant mode, not a proven multi-tenant SaaS boundary by themselves.

5. **Docker Postgres init**
   - `scripts/init-db.sql` now creates `arus_user` idempotently before grants.
   - Added default privileges for future Drizzle-created objects.

6. **PdM inference modularity**
   - Reworked `server/domains/pdm-platform/inference/ports.ts` so the domain service depends on a scoring port.
   - Replaced the throwing stub with `HeuristicInferenceRunner`, a deterministic baseline adapter behind the port.
   - `PredictionEngineService` now calls the runner instead of hard-coding inference internally.
   - Inference routes now use `AuthenticatedRequest.orgId` rather than trusting `x-org-id`.

7. **Weibull/RUL math bugs**
   - Fixed undefined `reliability` variable in `calculateReliability`.
   - Added parameter validation for Weibull shape/scale and RUL threshold.
   - Fixed goodness-of-fit denominator to use both X and Y variance.
   - Added focused tests for Weibull reliability and the inference runner port.

8. **Replit deployment target**
   - Fixed `.replit` deployment run target from `dist/index.cjs` to the actual ESM build output `dist/index.js`.

9. **Project identity / upload hygiene**
   - Renamed package from `rest-express` to `arus-maritime-pdm`.
   - Removed generated local DB sidecars, generated PDF reports, bundled source-review text dumps, and stale Python/Replit scaffold files from this upload package.

## Files changed

- `.replit`
- `package.json`
- `package-lock.json`
- `scripts/init-db.sql`
- `server/bootstrap/middleware.ts`
- `server/bootstrap/public-api-paths.ts`
- `server/db-security-policies.sql`
- `server/domains/pdm-platform/inference/ports.ts`
- `server/domains/pdm-platform/inference/prediction-engine.service.ts`
- `server/domains/pdm-platform/inference/routes.ts`
- `server/domains/pdm-platform/inference/heuristic-inference-runner.ts`
- `server/domains/system-admin/routes/auth-routes.ts`
- `server/middleware/db-context.ts`
- `server/orgIdValidation.ts`
- `server/routes.ts`
- `server/security/authentication.ts`
- `server/tests/pdm/inference-runner.test.ts`
- `server/tests/pdm/weibull-rul.test.ts`
- `server/utils/redact-log.ts`
- `server/weibull-rul/parameter-estimation.ts`
- `server/weibull-rul/reliability-calculations.ts`

## Recommended Replit verification

Run these after upload:

```bash
npm install
npm run typecheck
npm run test:pdm
npm run check:workflow-routes
npm run check:guards
npm run build
```

Then test the auth bootstrap path in production mode:

```bash
NODE_ENV=production npm run build
NODE_ENV=production npm start
curl -i -X POST "$REPL_URL/api/admin/auth/verify" \
  -H 'content-type: application/json' \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}'
```

Expected: the auth endpoint should no longer be blocked by the global auth middleware. The response body must not appear in server logs.


## Second-pass cleanup applied 2026-04-25

This archive includes an additional hardening/maintainability pass after the initial fix set:

- Centralized single-tenant organization context further: protected server routes no longer read `x-org-id`, `req.header("x-org-id")`, `req.get("x-org-id")`, or `req.query.orgId` directly.
- Kept direct org-header reads only inside the two validation utilities that normalize/reject legacy org context.
- Added `scripts/check-org-context-boundary.mjs` and wired it into `check:guards` as `check:org-context` to prevent future route-level org drift.
- Updated `server/orgIdValidation.ts` so successful validation also normalizes `req.orgId`, `req.headers["x-org-id"]`, and `req.query.orgId` to the canonical `DEFAULT_ORG_ID` for legacy code paths.
- Updated `server/utils/orgIdValidation.ts` so utility middleware accepts missing org headers in single-tenant mode but rejects any supplied org different from `DEFAULT_ORG_ID`.
- Disabled optional PostgreSQL RLS session context by default via `ENABLE_PG_RLS_CONTEXT=true`; repository-level org filtering is now explicitly documented as authoritative.
- Renamed the PdM inference adapter from `stub-runner` to `heuristic-inference-runner` and exposed `method: "heuristic-baseline"` plus a caveat in inference responses.
- Updated the PdM inference runner test to assert the heuristic-baseline method/caveat.
- Moved stale/review/build-report files out of the project root into `docs/archive/reviews-2026-04/` to make the Replit root cleaner.
- Updated Swagger wording so `x-org-id` is described as optional compatibility context, not required multi-tenant isolation.

Recommended verification after upload/extract in Replit:

```bash
npm install
npm run check:org-context
npm run check:workflow-routes
npm run check:guards
npm run typecheck
npm run test:pdm
npm run build
```

Notes:

- Full TypeScript/Jest/build verification still requires dependencies to be installed in Replit.
- The active PdM inference path remains a deterministic baseline scorer until a trained model adapter is connected to the `InferenceRunnerPort`.
- PostgreSQL RLS session context is now opt-in only; do not advertise RLS as the authoritative isolation boundary unless requests run inside a pinned connection or transaction-scoped context.


## Workflow Update Pass

Added a workflow-oriented UI layer and production session fix:

- Added `client/src/features/workflow/**`
- Added `/attention-inbox`
- Added `WorkflowCommandCenter` to Home
- Added queue-based operating model and handover view
- Added `SessionGate` to prevent protected production API calls before unlock
- Added shared in-memory `sessionToken` registry used by queryClient and admin-api
- Updated Operations nav, route config, role quick actions, and Operations hub

See `WORKFLOW_UPDATE_SUMMARY.md` for workflow-specific details.
