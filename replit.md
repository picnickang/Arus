# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application designed to optimize marine fleet operations through advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management. The project's core purpose is to reduce operational costs, enhance safety standards, and ensure regulatory compliance across the global marine fleet, primarily by integrating AI/ML technologies.

# User Preferences

Preferred communication style: Simple, everyday language.

After every code change, run `npx tsc --noEmit` and only treat the update as done when it reports no errors.

# System Architecture

## UI/UX Decisions

The frontend is a mobile-first React 18 single-page application built with TypeScript, `shadcn/ui`, Wouter, and TanStack Query. It emphasizes intuitive navigation, high information density, clear visual hierarchy, and WCAG 2.1 AA accessibility, with a fully responsive design.

## Technical Implementations

### Frontend

Developed using React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, and `shadcn/ui`. It supports WebSocket real-time synchronization, Progressive Web App (PWA) capabilities, and cross-platform deployment via Capacitor (mobile) and Tauri v2 (desktop).

### Backend

Implemented with Express.js and TypeScript, providing RESTful APIs with Zod validation. Key features include Vessel Intelligence, Inventory Management, and Analytics, supported by Redis caching and robust security measures.

#### Feature Specifications

-   **Predictive Maintenance**: Automated scheduling, real-time notifications, and AI/ML-driven failure prediction using ensemble models and RUL-based task windows.
-   **Telemetry Ingestion**: Hybrid C# Windows Service and Node.js architecture for offline-first data collection, supporting marine protocols.
-   **AI/ML Capabilities**: Condition Monitoring AI Studio, AI Sensor Optimization, OpenAI-powered LLM reports, advanced ML & acoustic monitoring, automated ML training, FFT-based vibration analysis, and a comprehensive PdM Platform.
-   **Digital Twin Platform**: Twin Definition, State computation, Residual Analysis, Scenario Simulation, and Replay/Time Travel functionalities.
-   **Operational & Compliance**: STCW-compliant Crew Scheduling with Fatigue Risk Score, Cost Savings & ROI Tracking, CII Compliance, Operating Mode Detection, immutable audit trails, digital logbooks, and a Compliance Rules Engine.
-   **Import Adapters**: CSV/XML imports from AMOS CMMS and SBN SHIPMATE ERP.
-   **Equipment Hierarchy**: Parent-child equipment relationships.
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, multi-supplier support, unified completion paths with prediction feedback, and financial tracking.
-   **Dashboards**: Bridge Dashboard with key metrics and alerts; Analytics Hub with headline metrics and AI Key Findings.
-   **Simulation**: Physics-Aware Vessel Telemetry Simulator for synthetic data generation.
-   **AI Copilot Agent**: Natural language chat interface (OpenAI function-calling) for fleet operations with tiered permissions and SSE streaming.
-   **Knowledge Base**: Document management with search, upload, and semantic search.
-   **Agent Activity & Findings**: Observability pages for agent runs and unified suggestions feed.
-   **Telemetry Resilience**: Circuit breaker, graceful shutdown, in-memory dead-letter queue, equipment heartbeat tracking.
-   **Unified Domain Event Bus**: Consolidated, strongly-typed event bus.
-   **Certificate Registry**: Hexagonal domain for vessel certificates with validity tracking.
-   **Hazmat/IMDG Parts**: Dedicated fields for dangerous goods classification.
-   **OSV Specific Features**: DP Monitoring, Charter Compliance KPI tracking, OVID/SIRE Vetting inspection management, Offshore Operations Logging, EFMS Integration, RMS Shore Monitoring.
-   **Equipment Intelligence**: Consolidated AI/ML/PdM view with fleet summary and risk-sorted equipment list.
-   **Daily Operations Briefing**: Automated shift-start summary with AI-generated executive summary.
-   **Financial Layer**: Three-part cost integrity covering procurement-to-WO cost flow, decision-point cost context for AI suggestions, and savings claim integrity.
-   **Prediction Lineage**: Tracks `modelVersionId`, `featureSetVersion`, `featureSnapshotId` for audit and reproducibility.
-   **API Response Contracts**: `validateResponse<T>` outbound response validation against Zod schemas with drift tolerance.
-   **Structured Logging**: `server/lib/structured-logger.ts` — leveled (debug/info/warn/error), auto-enriches with correlation and request context.
-   **Workflow-Hexagonal Boundary**: Workflow Attention domain consumes other domains via four narrow ports in `server/domains/workflow/domain/ports.ts`. Real adapters wired in `server/composition/workflow-attention-sources.ts` and injected via the `createAttentionWorkflowService(sources)` factory. Setup route delegates admin-settings I/O to `server/domains/system-admin/application/setup-bootstrap-service.ts`. Enforced by `npm run check:domain-leaks`.
-   **Operational Workflow Layer**: Action-oriented layer including unified `/attention-inbox`, Operations Command Center, role-based "Today" panels, `WorkOrderCloseoutWizard` (work performed / cause / parts / labour / verification / PdM feedback), `/offline-outbox` page for queued mutations / conflicts / retries, `/equipment-scan` QR/text lookup (with optional `BarcodeDetector`), PdM decision-summary on schedule task detail. Legacy paths redirect to canonical routes via `buildRedirectTarget` in `client/src/App.tsx`. The shared API client queues mutating requests in an offline outbox and replays on connectivity return or on `ARUS_SYNC_OUTBOX_REQUEST` SW messages. Each op carries a unique `clientMutationId` and a `conflictPaused` flag for 409/412 handling (Keep-local / Merge / Use-server). WO completion via `POST /api/work-orders/:id/complete-with-feedback` accepts a structured `closeout` payload.

#### Shipped Waves (Gap-Fill Plan)

Each bullet is one wave from the v2 ARUS Gap-Fill Plan. Implementation details live in source comments at the cited files — this is the high-level index.

-   **0.1 Background Job Queue (pg-boss)**: `server/background-jobs.ts` runs 9 processors (AI equipment/fleet analysis, PDF/CSV/HTML report generation, crew & maintenance scheduling, telemetry, insights snapshot). Pinned to schema `pgboss_bg` so it coexists with the document-ingestion `pgboss` schema. Failure-mode: no `DATABASE_URL` or `boss.start()` throws → falls back to `supported: false` no-op so the app still boots. Defaults: `batchSize: 2`, `retryLimit: 3` exp backoff, archive 1d, delete 7d. Stats + recent-jobs ring buffer power `GET /api/health/background-jobs`. `server/bootstrap/shutdown.ts` Phase 3 calls `jobQueue.stop({ graceful: true, timeout: 5000 })`.
-   **0.3 Marine Theming**: `client/src/components/theme-provider.tsx` + `client/src/index.css` implement the four-theme system the ThemeProvider had been declaring but never wiring (`light` / `dark` / `bridge` / `daylight`). New `:root[data-theme="bridge"]` (night-vision red/amber on near-black, preserves watch officer's dark adaptation) and `:root[data-theme="daylight"]` (max-contrast for deck sunlight glare). Hybrid application: provider sets `data-theme` on `<html>` AND the Tailwind class (with `bridge` mapped to `dark` so `dark:` utilities still resolve). All 38 design tokens themed across all four palettes. `theme-toggle.tsx` dropdown surfaces all five options under a "Marine Operations" subheader.
-   **0.4 Sentry FE + BE**: `server/instrument.ts` (imported FIRST in `server/index.ts` so auto-instrumentation can hook the module loader) inits `@sentry/node`. `client/src/lib/sentry.ts` inits `@sentry/react` with `browserTracingIntegration()`. Both gated on env vars (`SENTRY_DSN` / `VITE_SENTRY_DSN`) and no-op when absent — local dev / CI / self-host without a Sentry org pay zero cost. `tracesSampleRate: 0.1` default (env-overridable). Server `beforeSend` strips `authorization` / `cookie` / `x-api-key` headers from events; client `beforeBreadcrumb` drops non-error console noise. Profiling and session-replay deliberately off (need explicit customer opt-in due to PII surface).
-   **0.5 API Versioning**: All routes served under both `/api/v1/*` (current) and `/api/*` (legacy, deprecated with sunset 2026-11-18). RFC 8594 `Deprecation` / `Sunset` / `Link: rel="successor-version"` / `Warning` headers stamped on every legacy response. Wiring in `server/middleware/api-versioning.ts`, invoked from `server/bootstrap/middleware.ts` before `/api` auth chain. Swagger `servers` lists `/api/v1` first.
-   **0.6 Feature Flag Overrides**: `server/infrastructure/feature-flags.ts` layers a DB-backed override cache over the env-var manager. Resolution order: **user override → tenant override → global override → env-var → static default**. Surface: `isEnabledFor(flag, ctx)`, `refresh(db)`, `startAutoRefresh(db, intervalMs=60_000)` (returns stop fn, `unref()`'d), `getOverridesSnapshot()`. Existing `isEnabled(flag)` + 5 call sites untouched. Table `feature_flag_overrides` from migration 011; unique index on `(flag_key, COALESCE(tenant_id,''), COALESCE(user_id,''))` because NULLs would otherwise allow duplicate scope tuples. Cache primed in `server/bootstrap/services.ts`; failures swallowed with warn.
-   **0.9 Error Boundary Strategy**: Per-pane / per-route ErrorBoundary wrapping in the cockpit so one pane crashing doesn't take the whole surface down.
-   **0.11 CSP comment block** in `client/index.html` formalized (later tightened in 5.11).
-   **2.5 Generalized Idempotency**: `server/middleware/idempotency.ts` reads `clientMutationId` from request body when no `Idempotency-Key` header is present, so offline-outbox replays hit the cached response without needing a second header. Key composition `(orgId:method:path:key)`, 24h TTL, 2xx caching, periodic cleanup loop.
-   **2.8 TimescaleDB (opt-in)**: `TIMESCALEDB_ENABLED=true` runs `server/timescaledb-bootstrap.ts` at startup — `CREATE EXTENSION IF NOT EXISTS`, applies retention + compression policies to already-hypertable tables. Never auto-converts non-hypertables (destructive PK rebuild); that's `node scripts/timescale-init-hypertables.mjs --apply [--force]` (dry-run by default, `--force` if existing rows). Default OFF — no-op + disabled log when unset.
-   **3.1 Model Drift + Accuracy KPIs**: `server/observability/ml-metrics.ts` exports `mlFeaturePsi` / `mlFeatureKlDivergence` / `mlModelRollingMae` / `mlModelRollingAccuracy` / `mlModelAccuracyDecayRatio` gauges + `computePsi()` / `recordModelDrift()` / `recordModelPerformance()` helpers. PSI convention: <0.1 stable, 0.1–0.25 monitor, >0.25 retrain. Empty bins floored to 1e-4.
-   **3.2 Model Registry Promote/Rollback**: `POST /api/v1/ml/models/:id/promote` atomically archives every currently-deployed model with matching `equipmentType`, then deploys the candidate. `POST .../rollback` archives current, redeploys the most-recently-archived previously-deployed model for same equipmentType. Two-step sequence (storage surface has no tx handle); window is single-digit ms, idempotent. Built on existing `mlModels` schema rather than adopting MLflow.
-   **3.3 Shadow + Canary Serving**: `server/ml-prediction/shadow-canary.ts` exports `serveWithShadowOrCanary<T>()`. Mode inferred from inputs: candidate + no `canaryPercent` = shadow (both run, production result returned, divergence histogrammed); candidate + `canaryPercent` 1..100 = canary (random split, candidate failure falls back to production). Counters `arus_ml_shadow_comparisons_total` / `arus_ml_canary_traffic_total`, histogram `arus_ml_shadow_divergence`. Candidate-side errors NEVER propagate.
-   **3.4 Copilot Eval Harness**: `server/copilot/eval-harness.ts` exports `runCopilotEval(questions, call)` + `SEED_GOLDEN_QUESTIONS` (6 starter Qs covering vessel-status / risk-listing / WO search & create / inventory / RUL). Dependency-free; does NOT call OpenAI itself — caller injects a `CopilotCallable` so CI is deterministic and free with mocks, live runs explicit with a real callable. Scores: ordered-prefix tool-call accuracy, fractional `expectedContains` hits, hallucination flag on `mustNotContain` hits, p50/p95 latency, total tokens.
-   **3.5 Prompt Registry**: `server/prompts/{registry,templates}.ts` externalize LLM prompts into versioned `id@semver` refs. Mutating registered prompts throws (version bump required) so old refs stay reproducible forever. Strict-mode interpolation rejects undeclared `{{var}}` references at register time. Seeded with `risk-narrative@1.0.0`, `fleet-daily-briefing@1.0.0`, `wo-cause-suggestion@1.0.0`.
-   **3.6 PII Redaction**: `server/lib/llm-gateway/pii-redactor.ts` strips emails / phones / long-digit IDs / SSNs from message content before provider call. Idempotent — double-redaction is a no-op.
-   **3.7 OpenAI Cost Guardrails**: `server/lib/llm-gateway/budget-guard.ts` per-tenant daily/monthly token budgets. Soft-breach at 80% (one-shot warn per window via in-memory dedup set), hard-breach at 100% (`BudgetExceededError` thrown pre-call). Prom counters `arus_llm_tokens_consumed_total` / `arus_llm_budget_utilization_ratio` / `arus_llm_budget_breaches_total`. Budgets from `OPENAI_DAILY_TOKEN_BUDGET` / `OPENAI_MONTHLY_TOKEN_BUDGET` env vars with per-tenant override; absent = no-op. Windows rotate at UTC day/month boundary; the `llmCostTracking` table owns billing-grade accounting.
-   **3.8 ISO 14224 Failure-Mode Taxonomy**: `shared/taxonomy/iso14224.ts` exposes the Table B.1 set as a typed const + `getFailureMode()` / `isFailureModeCode()` / `failureModesByCategory()` / `coerceFailureMode(freeText)` (maps `"vibration"` / `"oil leak"` / `"tripped"` → canonical codes; falls back to `"OTH"` rather than miscategorizing). Code-resident on purpose: slow-changing reference set, not tenant data; pinning in build avoids per-lookup fetches AND removes tenant-mutation risk. Backfilling existing `failureHistory.failureMode` is a deferred one-time migration; new write paths can adopt immediately.
-   **5.9 Web Vitals + Route Budgets**: `client/src/lib/web-vitals.ts` uses native `PerformanceObserver` (no `web-vitals` package install) to capture LCP / INP-proxy / CLS / FCP / TTFB; beacons via `navigator.sendBeacon` (fetch+keepalive fallback) to `POST /api/v1/observability/web-vitals` on visibilitychange/pagehide. Budgets: LCP<2.5s, INP<200ms, CLS<0.1. Receipt route at `server/observability/web-vitals-route.ts` sanitizes inputs, observes `arus_web_vitals_value` histogram (CLS×100, others/1000 to share buckets), increments `arus_web_vitals_breaches_total` on poor ratings, 204s on success/error. Public path (added to `bootstrap/public-api-paths.ts`) — `sendBeacon` can't reliably attach cookies and payload is intrinsically untrusted. Mounted on `/api/v1` + legacy `/api`.
-   **5.11 CSP/HSTS Hardening**: `server/bootstrap/middleware.ts` helmet config — prod `imgSrc` drops `https:` wildcard (kept `'self'` + `data:` + `blob:`), added `frameAncestors 'none'` / `baseUri 'self'` / `formAction 'self'` / `workerSrc 'self' blob:` / `manifestSrc 'self'` + prod-only `upgradeInsecureRequests`. Added `crossOriginOpenerPolicy: same-origin`, `crossOriginResourcePolicy: same-origin`, `referrerPolicy: strict-origin-when-cross-origin`. `styleSrc` keeps `'unsafe-inline'` (Tailwind + shadcn runtime styles; nonce would need SSR). `script-src` already `'self'` in prod (no inline, no eval).
-   **6.6 GDPR Tenant-Delete Tool**: `server/domains/gdpr/tenant-delete-service.ts` — `TenantDeleteService.execute(tenantId, reason)` in one tx with best-effort `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` (swallowed if driver rejects). Tables registered explicitly with optional `org_id` column override — never wildcards on column-name match. Retention rules redact PII columns to `[REDACTED]` rather than delete (regulators see the record of deletion). Identifiers allowlist-validated `^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$`; tenant literal ≤128 chars + quote-doubled defensively. Returns HMAC-SHA256-signed `DeletionCertificate` (signed with `SESSION_SECRET`; empty signature + warn if absent) including `certificateId` (UUID v4), per-table row counts, retention summary, timing.
-   **6.7 Outbound Webhook Delivery**: `server/webhooks/webhook-delivery.ts` — `WebhookDeliveryService.deliverOnce()` (single attempt, never throws on transport error; returns attempt record so a pg-boss processor can decide retry) and `deliver()` (inline retry loop for tests). Stripe-style HMAC over `timestamp.body` so replay-with-rewritten-timestamp breaks signature; sent as `X-Arus-Signature: sha256=<hex>` + `X-Arus-Timestamp` + `X-Arus-Event-Id` + `X-Arus-Event-Type` + `X-Arus-Attempt`. `verifySignature()` uses `crypto.timingSafeEqual`. 5 attempts, exp backoff capped at 5 min + full jitter, 10s per-request `AbortController` timeout. Subscription `events: ['*']` matches all. Opt-in dead-letter sink; failures swallowed.
-   **6.8 Telemetry Data-Quality Monitoring**: `server/observability/data-quality.ts` — `DataQualityMonitor.evaluate(channel, vesselId, value, tsMs)` returns breach array (does NOT block ingestion). Rules: `range` (outside `[min,max]`), `freshness` (`maxGapSeconds` since last sample; gauge tracks current gap), `monotonic` (decreases reject unless drop exceeds `wraparoundThreshold` — counter rollover). Prom: `arus_dq_assertion_breaches_total` / `arus_dq_channel_freshness_seconds` / `arus_dq_channel_last_value`. `sweep(nowMs)` periodic helper for stale-freshness emission.

#### Hardening Notes

-   **AES-256-GCM**: `server/lib/crypto-service.ts` pins `authTagLength: 16` on both `createCipheriv` and `createDecipheriv`, rejects short tags before decipher creation. Prevents attacker-controlled short-tag attacks that would drop forgery resistance from 2^128 to 2^32. Regression-pinned by `tests/unit/structured-logger.test.ts`.
-   **DB Context SQL-Injection Hardening**: `server/middleware/db-context.ts` allowlists `orgId` via `^[A-Za-z0-9_-]{1,64}$` before interpolating into `SET LOCAL app.current_org_id` (cannot use parameterized queries for SET commands). Defense-in-depth if auth middleware regresses.
-   **WO-SO Bridge View**: `server/migrations/wo-so-bridge.ts` recreates the `work_orders_with_service_info` view in a single tx guarded by `pg_advisory_xact_lock(8606482937720340837)`. DROP+CREATE (not `CREATE OR REPLACE`) because `wo.*` column positions shift when columns are added to `work_orders` — `CREATE OR REPLACE VIEW` rejects with "cannot change name of view column". Tx makes the swap atomic under MVCC; advisory lock serializes concurrent app boots so multi-instance deploys don't race.
-   **CJS-in-ESM Fixes**: `server/lp-optimizer/optimizer.ts` and `server/ml-routes/acoustic-routes.ts` converted from `require()` to default imports (relies on `esModuleInterop: true` to surface CJS `module.exports`). Ambient `.d.ts` shims at `server/types/javascript-lp-solver.d.ts` and `server/types/fft-js.d.ts`.
-   **ML Prediction Type Re-export**: `server/ml-prediction/index.ts` uses `export type {…}` for `MLPredictionResult` / `MLDataStatus` because tsx-emitted runtime ESM cannot resolve `export type`/`export interface` bindings without the `type` modifier. Without it, background services init throws `does not provide an export named 'MLDataStatus'` even though `tsc --noEmit` is clean.

## System Design Choices

-   **Database**: Dual-mode (cloud PostgreSQL + local SQLite via Turso sync), normalized schema. TimescaleDB integration opt-in (see Wave 2.8 above).
-   **Architecture**: Single-tenant with centralized configuration; Hexagonal Architecture (DDD Modular Monolith).
-   **Authentication**: HMAC for edge devices; bcryptjs for password hashing; SHA-256 hashed session tokens; session-based admin auth.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation alerts, comprehensive input validation.
-   **Telemetry Ingestion**: Single ingestion path with SQLite WAL-mode, cursor-based batch processing, exponential backoff.
-   **ML/AI Backend**: Production ML models stored in `ml_models` with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Cloud, Desktop (Tauri v2 sidecar), Mobile (Capacitor iOS/iPadOS).
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Redis circuit breaker, Vite code splitting, API caching, lazy-loaded pages, memoized context providers.
-   **Component Decomposition**: Large feature components organized into directories with `index.tsx` entry + per-subcomponent files.
-   **Storage Architecture**: `server/repositories.ts` is the single canonical import for all data access.
-   **Convergence Guardrails**: Scripts prevent schema drift, enforce storage/domain import boundaries, ensure proper route registration.
-   **Dynamic-Loader Map**: Mechanism for dynamic loading of domain routers, barrel re-exports, repository modular loaders.
-   **Route Registration**: `domain-router-registry.ts` is the centralized system for all route registration.

# External Dependencies

-   PostgreSQL, Neon Database, Turso (libSQL), Redis
-   OpenAI, TensorFlow.js (`@tensorflow/tfjs-node`), XGBoost
-   Sentry (`@sentry/node` + `@sentry/react`, env-gated)
-   StormGeo, Aquametro FMCC
-   Edge Devices
