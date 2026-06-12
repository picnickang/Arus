# Shipped Waves (Gap-Fill Plan)

Each bullet is one wave from the v2 ARUS Gap-Fill Plan. Implementation details live in source comments at the cited files — this is the high-level index.

**Wave 0 — Foundations**

- **0.1 pg-boss Job Queue**: `server/background-jobs.ts`, 9 processors, schema `pgboss_bg`, `batchSize:2` `retryLimit:3` exp backoff, graceful shutdown Phase 3. `GET /api/health/background-jobs`.
- **0.3 Marine Theming**: 4-theme system (`light`/`dark`/`bridge`/`daylight`) wired in `client/src/components/theme-provider.tsx` + `index.css`. Bridge = night-vision red/amber; daylight = max-contrast for sunlight. All 38 tokens themed.
- **0.4 Sentry FE+BE**: `server/instrument.ts` first-import, `client/src/lib/sentry.ts`. Env-gated (`SENTRY_DSN`/`VITE_SENTRY_DSN`); 0.1 traces; strips auth headers; replay/profiling off (PII).
- **0.5 API Versioning**: Routes mounted on `/api/v1/*` + legacy `/api/*` (sunset 2026-11-18); RFC 8594 headers via `server/middleware/api-versioning.ts`.
- **0.6 Feature Flag Overrides**: `server/infrastructure/feature-flags.ts` — user→tenant→global→env→default resolution; `feature_flag_overrides` table; 60s auto-refresh.
- **0.9 Error Boundary Strategy**: Per-pane ErrorBoundary wrapping so a single pane crash doesn't take down the cockpit.
- **0.11 CSP scaffolding** in `client/index.html` (tightened later in 5.11).

**Wave 1 — Enterprise Auth & Crypto**

- **1.2 TOTP MFA**: `server/lib/mfa-totp.ts` — `otpauth` wrapper, ±1 step skew, 160-bit secrets, recovery codes (Crockford-ish, caller must hash). Reuses `userSessions.mfaVerified`.

**Wave 2 — Observability & Resilience**

- **2.1 OpenTelemetry**: `server/otel.ts` absolute-first import (before Sentry), auto-instruments Express/http/pg/pg-boss. Gated `OTEL_EXPORTER_OTLP_ENDPOINT`; fs noise off. `client/src/lib/otel.ts` web tracer + Fetch/XHR stitches FE→BE traceparent.
- **2.5 Generalized Idempotency**: `server/middleware/idempotency.ts` reads `clientMutationId` from body when `Idempotency-Key` absent. Key `(orgId:method:path:key)`, 24h TTL, 2xx caching.
- **2.6 k6 Load Tests**: `tests/load/{smoke,steady,spike}.js` with embedded SLO thresholds. Out of unit runner; k6 installed out-of-band.
- **2.3 Backup Verification Harness**: `scripts/dr/verify-backup.mjs` — restores a `pg_dump` into a scratch DB, asserts schema parity + per-table row-count drift (±20% default) + anchor-table non-emptiness vs live read-only. Exits non-zero w/ JSON report for CI gating. Refuses to validate <1KiB dumps (catches 0-byte "success" failures). Companion to runbook §10 drill.
- **2.7 DR Runbook**: `docs/operations/dr-runbook.md` — RTO 2h / RPO 5min, 5 incident classes (app outage / PITR / region failover / compromise / tenant-scoped), pre-flight evidence capture, comms checklist, quarterly drill checklist.
- **2.8 TimescaleDB (opt-in)**: `TIMESCALEDB_ENABLED=true` runs `server/timescaledb-bootstrap.ts`. Never auto-converts non-hypertables (destructive); use `scripts/timescale-init-hypertables.mjs --apply`. Default OFF.

**Wave 3 — ML/AI Lifecycle**

- **3.1 Model Drift KPIs**: `server/observability/ml-metrics.ts` — PSI/KL/MAE/accuracy gauges. PSI <0.1 stable / 0.1-0.25 monitor / >0.25 retrain.
- **3.2 Model Registry Promote/Rollback**: `POST /api/v1/ml/models/:id/{promote,rollback}` atomically swap deployed-for-equipmentType. Built on existing `mlModels`.
- **3.3 Shadow + Canary**: `server/ml-prediction/shadow-canary.ts` `serveWithShadowOrCanary<T>()`. Mode inferred from inputs. Candidate errors NEVER propagate.
- **3.5 Prompt Registry**: `server/prompts/{registry,templates}.ts` — versioned `id@semver`, mutation throws (version-bump required), strict `{{var}}` interpolation.
- **3.6 PII Redaction**: `server/lib/llm-gateway/pii-redactor.ts` strips email/phone/SSN/long-digit IDs pre-LLM call. Idempotent.
- **3.7 OpenAI Cost Guardrails**: `server/lib/llm-gateway/budget-guard.ts` — per-tenant daily/monthly token budgets, 80% soft / 100% hard throw. UTC window rotation.

**Wave 5 — Client Hardening**

- **5.9 Web Vitals**: `client/src/lib/web-vitals.ts` native `PerformanceObserver` (no extra dep), beacon to `POST /api/v1/observability/web-vitals` on pagehide. Budgets LCP<2.5s INP<200ms CLS<0.1. Receipt sanitizes + Prom histogram.
- **5.11 CSP/HSTS Hardening**: `server/bootstrap/middleware.ts` helmet — prod `imgSrc` no `https:` wildcard, added `frameAncestors 'none'`/`baseUri 'self'`/`formAction 'self'`/`workerSrc`/`manifestSrc` + `upgradeInsecureRequests`; COOP/CORP `same-origin`; `styleSrc` keeps `'unsafe-inline'` (Tailwind runtime styles, nonce would need SSR).

**Push B1 — Multi-tenancy with Postgres RLS**

- **Tenant claim → req.orgId**: `shared/config/tenant.ts` exposes
  `requireTenantAuth()` (true when `REQUIRE_TENANT_AUTH=true`) and
  `fallbackOrgId()` (throws in tenant-auth mode). `server/middleware/auth.ts`
  derives `req.orgId` from `req.user.orgId`; missing claim → 401 in
  tenant-auth mode, falls back to `DEFAULT_ORG_ID` in legacy mode.
  `server/security/authentication.ts` populates `req.user.orgId` from the
  persisted `users` row (sessions without a `userId` get 401 in tenant-auth
  mode). Dev mock user still carries `DEFAULT_ORG_ID` so existing dev flows
  keep booting.
- **Postgres RLS** (`migrations/0018_rls_policies.sql`): idempotent
  `ENABLE + FORCE ROW LEVEL SECURITY` on every table in the canonical
  `server/tenancy/tenant-tables.ts` registry. Policies key on
  `current_setting('app.current_org_id', true)` — unset session var
  means NULL means 0 rows (fail-closed). FORCE so RLS still applies
  when the app connects as the DB owner (the Replit/Neon default that
  audits called out). `server/middleware/db-context.ts` auto-enables
  the per-request `SET LOCAL` when `REQUIRE_TENANT_AUTH=true` so the
  runtime and the policies are switched on by the same flag.
- **Per-tenant rate limits**: `server/lib/rate-limit-factory.ts`
  `createKeyGenerator()` composes `org:<orgId>` (preferred) or
  `ip:<addr>` (pre-auth). One tenant's burst can no longer drain
  another's bucket — even when both NAT through the same egress IP.
- **Tenant lifecycle**: `server/domains/system-admin/routes/tenant-routes.ts`
  `POST /api/admin/tenants` (provision + default quotas),
  `PATCH /:orgId/{suspend,unsuspend}` (writes `organizations.suspended_at`),
  `DELETE /:orgId` (requires `{ confirm: "DELETE_TENANT", reason }`,
  wraps the Wave 6.6 `TenantDeleteService` with the central
  `TENANT_TABLE_NAMES` allowlist, returns the HMAC-signed
  `DeletionCertificate`). Admin UI at `/admin/tenants`.
- **Quotas** (`server/tenancy/quota-service.ts` +
  `server/middleware/tenant-quota.ts`): per-tenant `storage_bytes`,
  `equipment_count`, `telemetry_rows_today`. 80% soft → response
  carries `X-Tenant-Quota-Warning`; 100% hard → 429 with
  `Retry-After` (next UTC midnight for daily windows). Limits live in
  `tenant_quotas`; running usage in `tenant_usage` (keyed
  `org_id × metric × window_start`). Service is fail-open if its own
  tables are unavailable — RLS remains the hard-isolation boundary.
- **Canonical tenant-table registry**: `server/tenancy/tenant-tables.ts`
  is the single source of truth shared by the RLS migration, the GDPR
  `TenantDeleteService` allowlist, and quota usage queries. New
  tenant-scoped tables MUST be appended here AND mirrored into
  migration 0018's `TENANT_TABLES` array; drift is a security regression.
- **Pinned-connection RLS context (Task #88)**: `server/middleware/db-context.ts`
  wraps every authenticated `/api/*` request in `BEGIN; SELECT
set_config('app.current_org_id', $orgId, true); …; COMMIT/ROLLBACK`
  against a single pinned `pg.PoolClient`. The drizzle handle bound to
  that client is stashed in `tenantContextStore`
  (`server/db/tenant-context.ts`) and the `db` Proxy in
  `server/db-config.ts` routes through it for the rest of the request,
  so existing repositories don't need plumbing changes. RLS is now the
  authoritative tenant boundary — the repository-level `WHERE org_id =
…` filters are kept as defense-in-depth. Background-job workers
  (`server/background-jobs.ts`) use the same `withTenantContext`
  wrapper keyed on the `orgId` packed into the job payload. The boot
  gate in `db-config.ts` refuses to start `REQUIRE_TENANT_AUTH=true`
  on `neon-http` (single-statement driver), forcing
  `standard`/`websocket` deployments. In legacy single-tenant mode the
  `DEFAULT_ORG_ID` fallback still applies; in tenant-auth mode a
  missing `req.orgId` is a hard `401 TENANT_CONTEXT_MISSING`. Verified
  by `tests/integration/rls-cross-tenant.test.ts`.

**Wave 6 — Compliance & Eventing**

- **6.6 GDPR Tenant-Delete**: `server/domains/gdpr/tenant-delete-service.ts` single tx, SERIALIZABLE (best-effort), identifiers allowlisted, PII redacted not deleted. HMAC-SHA256 `DeletionCertificate`.

## Hardening Notes

- **AES-256-GCM**: `crypto-service.ts` pins `authTagLength: 16` on cipher+decipher and rejects short tags pre-decipher (prevents short-tag forgery dropping 2^128→2^32). Regression test in `tests/unit/structured-logger.test.ts`.
- **DB Context SQLi**: `middleware/db-context.ts` allowlists `orgId` as `^[A-Za-z0-9_-]{1,64}$` before interpolating into `SET LOCAL app.current_org_id` (SET can't use bind params).
- **WO-SO Bridge View**: `migrations/wo-so-bridge.ts` DROP+CREATE (not `CREATE OR REPLACE` — `wo.*` column positions shift) inside one tx + `pg_advisory_xact_lock(8606482937720340837)` so concurrent boots can't race.
- **CJS-in-ESM**: `lp-optimizer/optimizer.ts` + `ml-routes/acoustic-routes.ts` use default imports (relies on `esModuleInterop`); ambient `.d.ts` shims at `server/types/{javascript-lp-solver,fft-js}.d.ts`.
- **ML Prediction Type Re-export**: `ml-prediction/index.ts` uses `export type {...}` for `MLPredictionResult`/`MLDataStatus` — tsx-emitted runtime ESM can't resolve `export interface` without the `type` modifier (throws `does not provide an export named` at boot even though `tsc --noEmit` is clean).
