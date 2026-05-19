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

**Wave 0 — Foundations**
-   **0.1 pg-boss Job Queue**: `server/background-jobs.ts`, 9 processors, schema `pgboss_bg`, `batchSize:2` `retryLimit:3` exp backoff, graceful shutdown Phase 3. `GET /api/health/background-jobs`.
-   **0.3 Marine Theming**: 4-theme system (`light`/`dark`/`bridge`/`daylight`) wired in `client/src/components/theme-provider.tsx` + `index.css`. Bridge = night-vision red/amber; daylight = max-contrast for sunlight. All 38 tokens themed.
-   **0.4 Sentry FE+BE**: `server/instrument.ts` first-import, `client/src/lib/sentry.ts`. Env-gated (`SENTRY_DSN`/`VITE_SENTRY_DSN`); 0.1 traces; strips auth headers; replay/profiling off (PII).
-   **0.5 API Versioning**: Routes mounted on `/api/v1/*` + legacy `/api/*` (sunset 2026-11-18); RFC 8594 headers via `server/middleware/api-versioning.ts`.
-   **0.6 Feature Flag Overrides**: `server/infrastructure/feature-flags.ts` — user→tenant→global→env→default resolution; `feature_flag_overrides` table; 60s auto-refresh.
-   **0.9 Error Boundary Strategy**: Per-pane ErrorBoundary wrapping so a single pane crash doesn't take down the cockpit.
-   **0.11 CSP scaffolding** in `client/index.html` (tightened later in 5.11).

**Wave 1 — Enterprise Auth & Crypto**
-   **1.1 SSO (SAML 2.0 + OIDC)**: `shared/schema/sso.ts` (`sso_configs` per `(orgId, protocol)`); `server/sso/{saml,oidc,routes}.ts`. `@node-saml/passport-saml` v5 + `openid-client` v6 lazy-imported. PKCE state in httpOnly cookie (10min TTL). Session issuance via `SsoSessionIssuer` port — NOT auto-mounted.
-   **1.2 TOTP MFA**: `server/lib/mfa-totp.ts` — `otpauth` wrapper, ±1 step skew, 160-bit secrets, recovery codes (Crockford-ish, caller must hash). Reuses `userSessions.mfaVerified`.
-   **1.3 KMS Envelope Encryption**: `server/lib/kms-envelope.ts` — wraps inner AES-256-GCM DEK under cloud KMS CMK via `@aws-sdk/client-kms` (lazy). Gated `KMS_KEY_ID`. DEK `.fill(0)`'d in `finally`. `rewrapEnvelope` for rotation.

**Wave 2 — Observability & Resilience**
-   **2.1 OpenTelemetry**: `server/otel.ts` absolute-first import (before Sentry), auto-instruments Express/http/pg/pg-boss. Gated `OTEL_EXPORTER_OTLP_ENDPOINT`; fs noise off. `server/lib/pg-boss-trace.ts` `injectTraceContext`/`withTraceContext` propagates across queue. `client/src/lib/otel.ts` web tracer + Fetch/XHR stitches FE→BE traceparent.
-   **2.2 Loki Log Shipping**: `server/lib/loki-transport.ts` — optional Pino transport gated `LOKI_URL`; runs in Worker. stdout JSON stays canonical sink. `LOKI_BASIC_AUTH`/`LOKI_BEARER_TOKEN`.
-   **2.5 Generalized Idempotency**: `server/middleware/idempotency.ts` reads `clientMutationId` from body when `Idempotency-Key` absent. Key `(orgId:method:path:key)`, 24h TTL, 2xx caching.
-   **2.6 k6 Load Tests**: `tests/load/{smoke,steady,spike}.js` with embedded SLO thresholds. Out of unit runner; k6 installed out-of-band.
-   **2.7 DR Runbook**: `docs/operations/dr-runbook.md` — RTO 2h / RPO 5min, 5 incident classes (app outage / PITR / region failover / compromise / tenant-scoped), pre-flight evidence capture, comms checklist, quarterly drill checklist.
-   **2.8 TimescaleDB (opt-in)**: `TIMESCALEDB_ENABLED=true` runs `server/timescaledb-bootstrap.ts`. Never auto-converts non-hypertables (destructive); use `scripts/timescale-init-hypertables.mjs --apply`. Default OFF.

**Wave 3 — ML/AI Lifecycle**
-   **3.1 Model Drift KPIs**: `server/observability/ml-metrics.ts` — PSI/KL/MAE/accuracy gauges. PSI <0.1 stable / 0.1-0.25 monitor / >0.25 retrain.
-   **3.2 Model Registry Promote/Rollback**: `POST /api/v1/ml/models/:id/{promote,rollback}` atomically swap deployed-for-equipmentType. Built on existing `mlModels`.
-   **3.3 Shadow + Canary**: `server/ml-prediction/shadow-canary.ts` `serveWithShadowOrCanary<T>()`. Mode inferred from inputs. Candidate errors NEVER propagate.
-   **3.4 Copilot Eval Harness**: `server/copilot/eval-harness.ts` — dependency-free; caller injects `CopilotCallable` so CI is mock-deterministic. 6 seed questions.
-   **3.5 Prompt Registry**: `server/prompts/{registry,templates}.ts` — versioned `id@semver`, mutation throws (version-bump required), strict `{{var}}` interpolation.
-   **3.6 PII Redaction**: `server/lib/llm-gateway/pii-redactor.ts` strips email/phone/SSN/long-digit IDs pre-LLM call. Idempotent.
-   **3.7 OpenAI Cost Guardrails**: `server/lib/llm-gateway/budget-guard.ts` — per-tenant daily/monthly token budgets, 80% soft / 100% hard throw. UTC window rotation.
-   **3.8 ISO 14224 Taxonomy**: `shared/taxonomy/iso14224.ts` — typed Table B.1 const + `coerceFailureMode(freeText)` ("vibration"→canonical, fallback "OTH"). Code-resident (slow-changing, not tenant data).

**Wave 5 — Client Hardening**
-   **5.9 Web Vitals**: `client/src/lib/web-vitals.ts` native `PerformanceObserver` (no extra dep), beacon to `POST /api/v1/observability/web-vitals` on pagehide. Budgets LCP<2.5s INP<200ms CLS<0.1. Receipt sanitizes + Prom histogram.
-   **5.11 CSP/HSTS Hardening**: `server/bootstrap/middleware.ts` helmet — prod `imgSrc` no `https:` wildcard, added `frameAncestors 'none'`/`baseUri 'self'`/`formAction 'self'`/`workerSrc`/`manifestSrc` + `upgradeInsecureRequests`; COOP/CORP `same-origin`; `styleSrc` keeps `'unsafe-inline'` (Tailwind runtime styles, nonce would need SSR).

**Wave 6 — Compliance & Eventing**
-   **6.6 GDPR Tenant-Delete**: `server/domains/gdpr/tenant-delete-service.ts` single tx, SERIALIZABLE (best-effort), identifiers allowlisted, PII redacted not deleted. HMAC-SHA256 `DeletionCertificate`.
-   **6.7 Outbound Webhooks**: `server/webhooks/webhook-delivery.ts` Stripe-style HMAC over `timestamp.body`, 5 attempts exp backoff + jitter, 10s AbortController, `verifySignature()` timing-safe.
-   **6.8 Telemetry Data Quality**: `server/observability/data-quality.ts` `DataQualityMonitor` — range/freshness/monotonic rules (does NOT block ingestion). Prom assertion-breach/freshness/last-value gauges.

#### Hardening Notes

-   **AES-256-GCM**: `crypto-service.ts` pins `authTagLength: 16` on cipher+decipher and rejects short tags pre-decipher (prevents short-tag forgery dropping 2^128→2^32). Regression test in `tests/unit/structured-logger.test.ts`.
-   **DB Context SQLi**: `middleware/db-context.ts` allowlists `orgId` as `^[A-Za-z0-9_-]{1,64}$` before interpolating into `SET LOCAL app.current_org_id` (SET can't use bind params).
-   **WO-SO Bridge View**: `migrations/wo-so-bridge.ts` DROP+CREATE (not `CREATE OR REPLACE` — `wo.*` column positions shift) inside one tx + `pg_advisory_xact_lock(8606482937720340837)` so concurrent boots can't race.
-   **CJS-in-ESM**: `lp-optimizer/optimizer.ts` + `ml-routes/acoustic-routes.ts` use default imports (relies on `esModuleInterop`); ambient `.d.ts` shims at `server/types/{javascript-lp-solver,fft-js}.d.ts`.
-   **ML Prediction Type Re-export**: `ml-prediction/index.ts` uses `export type {...}` for `MLPredictionResult`/`MLDataStatus` — tsx-emitted runtime ESM can't resolve `export interface` without the `type` modifier (throws `does not provide an export named` at boot even though `tsc --noEmit` is clean).

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
-   OpenTelemetry (`@opentelemetry/sdk-node` + `@opentelemetry/sdk-trace-web`, env-gated)
-   SSO (`@node-saml/passport-saml` v5 + `openid-client` v6, opt-in per tenant)
-   MFA (`otpauth`, opt-in per user), KMS (`@aws-sdk/client-kms`, env-gated), Loki (`pino`+`pino-loki`, env-gated)
-   k6 load testing (installed out-of-band, scripts under `tests/load/`)
-   StormGeo, Aquametro FMCC
-   Edge Devices
