# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application designed to optimize marine fleet operations through advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management. The project's core purpose is to reduce operational costs, enhance safety standards, and ensure regulatory compliance across the global marine fleet, primarily by integrating AI/ML technologies.

# User Preferences

Preferred communication style: Simple, everyday language.

After every code change, run `npx tsc --noEmit` and only treat the update as done when it reports no errors.

Do not introduce new `any` or `as any` in route handlers (`server/domains/**/routes*.ts`, `server/domains/**/interfaces/*.ts`) or in the public methods of application services (`server/domains/**/application/*-service.ts`). Use `AuthenticatedRequest` from `server/middleware/auth.ts` for `req`, narrow `unknown` with type guards, and reach for `Parameters<typeof fn>[n]` / `Awaited<ReturnType<typeof fn>>` instead of an escape-hatch cast. Existing `any` in these files should be removed, not duplicated.

# System Architecture

## UI/UX Decisions

The frontend is a mobile-first React 18 single-page application built with TypeScript, `shadcn/ui`, Wouter, and TanStack Query. It emphasizes intuitive navigation, high information density, clear visual hierarchy, and WCAG 2.1 AA accessibility, with a fully responsive design.

## Technical Implementations

### Frontend

Developed using React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, and `shadcn/ui`. It supports WebSocket real-time synchronization, Progressive Web App (PWA) capabilities, and cross-platform deployment via Capacitor (mobile) and Tauri v2 (desktop).

### Backend

Implemented with Express.js and TypeScript, providing RESTful APIs with Zod validation. Key features include Vessel Intelligence, Inventory Management, and Analytics, supported by Redis caching and robust security measures.

#### Feature Specifications

> Wave-by-wave implementation history (Wave 0–6, Push A/B, hardening notes) lives in `docs/architecture/waves.md`.
> Telemetry warehouse export (daily Parquet to object storage) — bucket layout, Parquet schema, manifest shape, retention env var, and example Athena/BigQuery/Snowflake DDL live in `docs/telemetry-warehouse-export.md`.

-   **Predictive Maintenance**: Automated scheduling, real-time notifications, and AI/ML-driven failure prediction using ensemble models and RUL-based task windows.
-   **Telemetry Ingestion**: Hybrid C# Windows Service and Node.js architecture for offline-first data collection, supporting marine protocols.
-   **AI/ML Capabilities**: Condition Monitoring AI Studio, AI Sensor Optimization, OpenAI-powered LLM reports, advanced ML & acoustic monitoring, automated ML training, FFT-based vibration analysis, and a comprehensive PdM Platform.
-   **Digital Twin Platform**: Twin Definition, State computation, Residual Analysis, Scenario Simulation, and Replay/Time Travel functionalities.
-   **3D Digital Twin Viewer (Push A3)**: Route `/vessels/:id/3d` renders a vessel's GLB model with equipment pins, dependency-overlay highlighting (Push A2 graph), and a 6-hour replay scrubber. Documented UX contracts: (a) ingestion is `.glb`-only (single-file storage cannot resolve `.gltf` sidecars) with GLB magic-byte validation + admin role gate; (b) pin click selects in-scene and tints downstream amber via cached dependency query — an explicit "Open detail" CTA navigates to `/equipment?id=…` (raw navigation would unmount the overlay); (c) replay reads `/api/pdm/twin/state/history/:twinId?since=…` (twin-state history — past replay) rather than `ScenarioSimService` (forward projection). Backend admin-gated. Admin UI at `/admin/3d-models` (also surfaced via System Hub) lets admin/chief_engineer roles upload a `.glb` per vessel and add/move/delete equipment pins. Pins can be edited numerically in the table or placed by clicking directly on the loaded model — the embedded `Vessel3DTwin` raycasts the GLTF surface and writes world-space `(x,y,z)` into the armed row. Server-side validation errors (multer, magic-byte, Zod) are surfaced inline; non-admins still see the read-only viewer at `/vessels/:id/3d`.
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
-   **Safety Bulletins**: Cloud-only hexagonal domain (`server/domains/safety-bulletins/`, mirrors the certificates template — db-direct adapter, no SQLite mirror, no repositories barrel) backing the user-portal dashboard's "Safety Notices" + "Safety Status" cards with real data. `safety_bulletins` table is org-scoped with an optional nullable `vesselId` (null = fleet-wide). Routes: `GET /api/safety-bulletins` (`vesselId` + `includeInactive` filters; active-only by default) and `POST /api/safety-bulletins`. Replaces the prior fake feed that derived safety items from `/api/alerts?category=safety` (a category that never matches in cloud PG). Frontend status: critical if any bulletin is `critical` severity, else caution if any active, else good. List page at `/safety-bulletins`.
-   **Hazmat/IMDG Parts**: Dedicated fields for dangerous goods classification.
-   **OSV Specific Features**: DP Monitoring, Charter Compliance KPI tracking, OVID/SIRE Vetting inspection management, Offshore Operations Logging, EFMS Integration, RMS Shore Monitoring.
-   **Equipment Intelligence**: Consolidated AI/ML/PdM view with fleet summary and risk-sorted equipment list.
-   **Daily Operations Briefing**: Automated shift-start summary with AI-generated executive summary.
-   **Financial Layer**: Three-part cost integrity covering procurement-to-WO cost flow, decision-point cost context for AI suggestions, and savings claim integrity.
-   **Prediction Lineage**: Tracks `modelVersionId`, `featureSetVersion`, `featureSnapshotId` for audit and reproducibility.
-   **API Response Contracts**: `validateResponse<T>` outbound response validation against Zod schemas with drift tolerance.
-   **Structured Logging**: `server/lib/structured-logger.ts` — leveled (debug/info/warn/error), auto-enriches with correlation and request context.
-   **Push A1 — Real PdM Inference**: Python XGBoost trainer
    (`scripts/ml/python/train_xgb.py`) exports ONNX (serving) +
    native UBJ (TreeSHAP) per `(orgId, equipmentType)`, registers an
    `ml_models` row with `artifactPath`/`nativeArtifactPath` in
    `training_metrics`. Inference resolves the deployed artifact via
    `PredictionEngineService.resolveActiveVersion()` (reads `ml_models`
    by `orgId` + equipment type + `status='deployed'`) and serves it
    through `ModelBackedInferenceRunner` (`onnxruntime-node`). Every
    inference path goes through `serveWithShadowOrCanary` (Wave 3.3
    contract) — including the default `PDM_ONNX_MODE=live`, where
    ONNX is `productionPredict` (wrapped with a heuristic
    hard-failure fallback) and no candidate is set. In
    `PDM_ONNX_MODE=shadow|canary` the roles flip into the canonical
    Wave 3.3 observation substrate (heuristic-as-production, ONNX-as-
    candidate) for operator-led pre-rollout drills.
    `/ml/models/:id/promote` and `/rollback` mutate the same rows the
    runtime reads — closed loop. TreeSHAP via Python sidecar
    (`server/ml-explainability-python-shap.ts`, gated `ML_PYTHON_SHAP=1`)
    loads the deployed UBJ directly; permutation fallback in
    `prediction-engine.service.ts` scores against the same
    `modelVersionId` so attributions stay tied to the deployed model.
    Bearing+pump retrains HARD-FAIL when Python is unavailable
    (`scripts/ml/train-model-sidecar.mjs`) rather than silently
    downgrading to the calibration baseline. **Client-side ONNX
    (`onnxruntime-web`, `client/src/lib/ml/onnx-web-adapter.ts`)** is
    shipped opt-in (`VITE_PDM_ONNX_WEB=1`) for offline-PWA scoring
    and UI what-if previews; it loads the deployed artifact through
    `GET /api/v1/ml/models/:id/artifact` (org-scoped, deployed-only,
    path-constrained to `models/`). The server path through
    `serveWithShadowOrCanary` remains canonical for promotion,
    rollback, and audit — the browser adapter is a read-only consumer
    of whatever artifact the server has currently deployed.
-   **Workflow-Hexagonal Boundary**: Workflow Attention domain consumes other domains via four narrow ports in `server/domains/workflow/domain/ports.ts`. Real adapters wired in `server/composition/workflow-attention-sources.ts` and injected via the `createAttentionWorkflowService(sources)` factory. Setup route delegates admin-settings I/O to `server/domains/system-admin/application/setup-bootstrap-service.ts`. Enforced by `npm run check:domain-leaks`.
-   **Operational Workflow Layer**: Action-oriented layer including unified `/attention-inbox`, Operations Command Center, role-based "Today" panels, `WorkOrderCloseoutWizard` (work performed / cause / parts / labour / verification / PdM feedback), `/offline-outbox` page for queued mutations / conflicts / retries, `/equipment-scan` QR/text lookup (with optional `BarcodeDetector`), PdM decision-summary on schedule task detail. Legacy paths redirect to canonical routes via `buildRedirectTarget` in `client/src/App.tsx`. The shared API client queues mutating requests in an offline outbox and replays on connectivity return or on `ARUS_SYNC_OUTBOX_REQUEST` SW messages. Each op carries a unique `clientMutationId` and a `conflictPaused` flag for 409/412 handling (Keep-local / Merge / Use-server). WO completion via `POST /api/work-orders/:id/complete-with-feedback` accepts a structured `closeout` payload.


## System Design Choices

-   **Database**: Dual-mode (cloud PostgreSQL + local SQLite via Turso sync), normalized schema. TimescaleDB integration opt-in (see Wave 2.8 above).
-   **Architecture**: Single-tenant with centralized configuration; Hexagonal Architecture (DDD Modular Monolith).
-   **Authentication**: HMAC for edge devices; bcryptjs for password hashing; SHA-256 hashed session tokens; session-based admin auth.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation alerts, comprehensive input validation.
-   **Telemetry Ingestion**: Single ingestion path with SQLite WAL-mode, cursor-based batch processing, exponential backoff.
-   **ML/AI Backend**: Production ML models stored in `ml_models` with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Cloud, Desktop (Tauri v2 sidecar), Mobile (Capacitor iOS/iPadOS).
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **PdM Authorization Model**: PdM lifecycle mutations (model deploy/archive/delete/promote/rollback in `server/ml-routes/model-routes.ts`, `server/domains/pdm-platform/model-registry/routes.ts`, `server/domains/pdm-platform/training-pipeline/routes.ts`) gate on the permission grant `requirePermission("predictive_maintenance","manage_config")` — NOT hardcoded role names. This matches the frontend, which gates the PdM surface on the `predictive_maintenance` resource, so a permission-granted user is never blocked by a role-name list. The `admin`, `super_admin`, `company_admin`, and `chief_engineer` role templates (`server/config/default-role-templates.ts`) carry `predictive_maintenance` view/manage_config/override. Deployment note: the permission service has no admin wildcard bypass; existing seeded orgs do not auto-reseed templates, so orgs provisioned before this change need their admin/super_admin roles re-granted `predictive_maintenance:manage_config` (re-run role-template seeding or grant manually) or those admins will lose PdM lifecycle access.
-   **Backend-only domains (expose-or-remove decisions)**: DP Monitoring (`/api/dp`), Charter Compliance (`/api/charter`), Vetting (`/api/vetting`), Offshore Ops (`/api/offshore-ops`), and EFMS (`/api/efms`) are KEPT as authenticated, org-scoped API-only domains — every route applies `requireOrgId`, so they are not open holes, just niche OSV/integration features with no UI yet (UI deferred to product). Data Export (`/api/data-export`) is KEPT as an admin/internal API (`requireAdminAuth` + `auditAdminAction`). Full rationale recorded in `docs/ui-usefulness-density-audit.json` (`backendOnlyDomains`).
-   **Safety Bulletins list gating (confirmed)**: `GET /api/safety-bulletins` is intentionally readable by every authenticated org member (org-scoped only, no role gate) so safety notices reach all crew; `POST` is gated by `requireSafetyBulletinWriteRole`. The frontend matches this read-all/write-gated model, so there is no UI/API mismatch.
-   **Performance Optimizations**: Redis circuit breaker, Vite code splitting, API caching, lazy-loaded pages, memoized context providers.
-   **Component Decomposition**: Large feature components organized into directories with `index.tsx` entry + per-subcomponent files.
-   **Storage Architecture**: `server/repositories.ts` is the single canonical import for all data access.
-   **Convergence Guardrails**: Scripts prevent schema drift, enforce storage/domain import boundaries, ensure proper route registration.
-   **Dynamic-Loader Map**: Mechanism for dynamic loading of domain routers, barrel re-exports, repository modular loaders.
-   **Route Registration**: `domain-router-registry.ts` is the centralized system for all route registration.
-   **WebSocket Per-Org Connection Cap (LR-3)**: `WS_ORG_CONNECTION_LIMIT` env (default unset / 0 → no cap, legacy behaviour). When set to a positive integer, `TelemetryWebSocketServer` tracks live connections per `orgId` in `orgConnectionCounts: Map<string,number>` and refuses additional upgrades for any tenant at or above the cap with `ws.close(4290, "ORG_CONNECTION_LIMIT_EXCEEDED")` (4290 is a custom mapping of HTTP 429 — distinct from auth-failure 1008 so clients can apply a longer backoff). Two metrics expose the cap: `arus_websocket_connections_active_per_org{org_id}` (gauge, decremented on both `close` and `error`) and `arus_websocket_connections_rejected_total{org_id, reason}` (counter, `reason ∈ {cap_exceeded, auth_failed, tenant_strict, server_shutdown}`). Cardinality is bounded by tenant count. Cap is read at handshake time so ops can adjust without a restart. Runbook: `docs/operations/runbooks/websocket-outage.md` §3.
-   **WebSocket Tenant Strict Mode (Task 91)**: `WS_TENANT_STRICT_MODE` env flag (default off) hardens multi-server WebSocket fan-out for cross-tenant isolation. When on, the legacy `SYSTEM_ORG_ID` (`__system__`) bypass is disabled: client sockets never subscribe to the system namespace, `onFanoutEvent` drops any `SYSTEM_ORG_ID` event as defence-in-depth, and `wsServer.broadcast(channel, data)` without an explicit `orgId` logs a structured warning with a stack reference (`WS_TENANT_STRICT_MODE dropped SYSTEM_ORG_ID broadcast`) instead of fanning out. Pass an explicit tenant `orgId` (`wsServer.broadcast(channel, data, orgId)`) to address a single tenant — those publishes are unaffected. Default off so single-tenant/dev deploys keep the historical broadcast semantics; production multi-server deploys should set `WS_TENANT_STRICT_MODE=true`. Cross-tenant non-leakage is pinned by `tests/integration/websocket-strict-mode.test.ts` (two orgs, one client per org, asserts org-B never receives org-A events under strict mode).
-   **Tenant Quotas**: `enforceQuota(metric)` middleware (`server/middleware/tenant-quota.ts`) soft-warns at ≥80% with `X-Tenant-Quota-Warning`/`X-Tenant-Quota-Ratio` headers and hard-throttles at ≥100% with HTTP 429 + `Retry-After` + `TENANT_QUOTA_EXCEEDED`. Wired metrics and the routes that enforce/increment them: (a) `equipment_count` — `POST /api/equipment` (`server/domains/equipment/routes.ts`); (b) `storage_bytes` — `POST /api/kb/upload`, `POST /api/kb/upload/async` (decremented on `DELETE /api/kb/documents/:id`), `POST /api/v1/vessels/:vesselId/3d-model`, `POST /api/agent/chat-multimodal`, `POST /api/agent/conversations/:id/files`; (c) `telemetry_rows_today` — the sole active ingest path is `telemetryBatchWriter.writeBatch()`, which runs a per-org `quotaService.check()` BEFORE writing and silently drops every reading belonging to an over-limit org (observable via the `arus_telemetry_batch_quota_blocked_total{org_id}` counter and a `quotaBlocked` event); under-limit readings commit, and usage is incremented per-org AFTER commit. The 503-gated `POST /api/telemetry/readings` and `POST /api/telemetry/bulk` carry the `enforceQuota` middleware pre-wired for Phase C so the HTTP path returns 429 once it's re-enabled. Increment is fire-and-forget after the write succeeds; quota lookups failing-open never block the request path (commercial concern, not a correctness boundary — RLS remains the fail-closed perimeter).

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
