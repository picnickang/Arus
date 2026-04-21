# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application designed to optimize marine fleet operations. It provides advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management. The project aims to leverage AI/ML to transform marine operations, reduce costs, improve safety, and ensure regulatory adherence across the global fleet.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The frontend is a mobile-first React 18 single-page application built with TypeScript, `shadcn/ui`, Wouter, and TanStack Query. It emphasizes intuitive navigation, high information density, clear visual hierarchy, and WCAG 2.1 AA accessibility. Key components include a Vessel Dashboard with a three-panel layout for vessel status, schematics, and inventory, designed for full responsiveness across devices.

## Technical Implementations

### Frontend

Built with React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, and `shadcn/ui`. Features include WebSocket real-time synchronization, PWA capabilities, and cross-platform deployment via Capacitor (mobile) and Tauri v2 (desktop).

### Backend

Developed with Express.js and TypeScript, offering RESTful APIs with Zod validation. It integrates Vessel Intelligence, Inventory Management, and Analytics, leveraging Redis caching. Security features include API readiness checks, graceful shutdown, CORS, redacted logging, Helmet CSP, and rate limiting.

#### Feature Specifications

-   **Predictive Maintenance**: Automated scheduling, real-time notifications, and cron-based failure prediction using ensemble ML models (LSTM, XGBoost, Random Forest) and RUL-based task windows.
-   **Telemetry Ingestion**: Hybrid C# Windows Service and Node.js architecture for offline-first data collection, supporting marine protocols (J1939/J1708/J1587).
-   **AI/ML Capabilities**: Condition Monitoring AI Studio, AI Sensor Optimization, OpenAI-powered LLM reports, advanced ML & acoustic monitoring, automated ML training, FFT-based vibration analysis, and a comprehensive PdM Platform.
-   **Digital Twin Platform**: Provides Twin Definition, State computation, Residual Analysis, Scenario Simulation, and Replay/Time Travel.
-   **Operational & Compliance**: STCW-compliant Crew Scheduling with Fatigue Risk Score, Cost Savings & ROI Tracking, CII Compliance, Operating Mode Detection, immutable audit trails, digital logbooks, and a Compliance Rules Engine. Includes a maritime-compliant Logbook Correction Workflow and a Sensor Calibration Registry.
-   **Import Adapters**: Supports CSV/XML imports from AMOS CMMS and SBN SHIPMATE ERP for equipment, work orders, parts, and maintenance plans.
-   **Equipment Hierarchy**: Manages parent-child equipment relationships with auto-computed hierarchy levels.
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, multi-supplier support, and out-of-stock purchase request workflows. Unified completion path for work orders with prediction feedback and financial tracking.
-   **Dashboard**: Bridge Dashboard with metric cards (Fleet Health, Open Work Orders, Risk Alerts), Needs Attention strip, AI Summary, and Activity Feed.
-   **Analytics Hub**: Stacked summary with headline metrics, AI Key Findings, and domain-specific strips (Operations, Maintenance, Finance, Data Integrity).
-   **Simulation**: Physics-Aware Vessel Telemetry Simulator for synthetic data generation.
-   **AI Copilot Agent**: Natural language chat interface (OpenAI function-calling) for fleet operations queries with tiered permissions, SSE streaming, and conversation persistence.
-   **Knowledge Base**: Single-purpose document management page with search, upload, filters, and semantic search.
-   **Copilot Admin**: Monitoring dashboard for usage stats and schedules, with configuration options.
-   **Agent Activity**: Observability page showing chronological log of agent runs with summary metrics and filterable details.
-   **Agent Findings Feed**: Unified page consolidating agent suggestions, drafts, scheduled run results, and agent findings into a single reverse-chronological feed with filtering and inline actions.
-   **Agent Task & Finding Model**: Durable task orchestration and finding records with hexagonal architecture, supporting various finding types and severities.
-   **Telemetry Resilience Modules**: Circuit breaker for PostgreSQL, graceful shutdown, in-memory dead-letter queue, and equipment heartbeat tracking.
-   **Unified Domain Event Bus**: Consolidated, strongly-typed event bus with 40+ event types.
-   **Certificate Registry**: Hexagonal domain for vessel certificates with validity tracking and audit trail.
-   **Hazmat/IMDG Parts**: Dedicated fields for dangerous goods classification.
-   **Hardening**: Comprehensive security (HMAC key rotation, RAG document sanitizer), resilience (DB degradation layer, LLM statistical fallback), data (idempotency middleware, telemetry partitioning), performance (dashboard pre-computation, API caching), and maritime-specific features (vessel timezone service, running hour accumulator).
-   **OSV Specific Features**: DP Monitoring, Charter Compliance KPI tracking, OVID/SIRE Vetting inspection management, Offshore Operations Logging, EFMS Integration, and RMS Shore Monitoring with Aquametro FMCC integration.
-   **Equipment Intelligence**: Consolidated AI/ML/PdM view with fleet summary, risk-sorted equipment list, and detailed drawer, implemented with a hexagonal architecture.
-   **Suggestion Outcome Tracking**: Records outcome categories for agent suggestions with effectiveness summary.
-   **Daily Operations Briefing**: Automated shift-start summary persisted as structured entity with key operational sections and AI-generated executive summary.
-   **Financial Layer**: Three-part cost integrity system covering procurement to WO cost flow, decision-point cost context for AI suggestions, and savings claim integrity with validation.
-   **Prediction Lineage**: Every `failurePredictions` row now carries `modelVersionId`, `featureSetVersion`, and `featureSnapshotId` — a FK-capable pointer to the exact `equipmentFeatures` row used at inference time. Lineage query endpoint at `GET /api/pdm/infer/predictions/:id/lineage` returns the prediction, model version, feature set version, and full snapshot values for audit and reproducibility.

## System Design Choices

-   **Database**: Dual-mode deployment with cloud PostgreSQL (TimescaleDB) and local SQLite (Turso sync) with a normalized schema and UUID primary keys.
-   **Single-Tenant Architecture**: Centralized tenant configuration.
-   **Authentication**: HMAC for edge devices; bcryptjs for password hashing; SHA-256 hashed session tokens; session-based admin auth.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation alerts, secure fleet status reporting, and comprehensive input validation.
-   **Telemetry Ingestion Architecture**: Single ingestion path with SQLite WAL-mode, cursor-based batch processing, and exponential backoff.
-   **ML/AI Backend**: Production ML models stored in `ml_models` table with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Supports Cloud, Desktop (Tauri v2 with sidecar backend), and Mobile (Capacitor iOS/iPadOS).
-   **Tauri Desktop Architecture**: Sidecar management spawns a bundled Express server binary.
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Redis circuit breaker, Vite code splitting, API caching, lazy-loaded pages, memoized context providers, and optimized TanStack Query defaults.
-   **Hexagonal Architecture (DDD Modular Monolith)**: Clear separation of concerns into Domain, Application, Infrastructure, and Interfaces layers, with a Domain Event Registry and Cloud-Safe Outbox Processor.
-   **Storage Architecture**: `server/repositories.ts` is the single canonical import for all data access — individual repos (`db*Storage`), domain services (`workOrderService`, `vesselService`), and the compatibility facade (`storage`). The old `server/storage.ts` facade has been deleted. Guard script blocks any imports targeting the old path.
-   **Convergence Guardrails**: `check:guards` runs 5 scripts: schema drift validation, storage import boundary (static + dynamic + type-only), schema import boundary, cross-domain import boundary, and route registration pattern. Drift burn-down at `scripts/drift-burndown.json` with monotonic guard (drift must never increase beyond 116). Redirects reduced to 12 entries (3 permanent + 9 route migrations). 43 automated tests in `test:dual-db`.
-   **Dynamic-Loader Map (CRITICAL for dead-code work)**: Three patterns make files appear "unused" to static analyzers (knip, ts-prune, IDE find-references) while being load-bearing at runtime. Touching them without checking these will cause silent route registration failures:
    1.  **Domain Router Registry** — `server/routes/domain-router-registry.ts` declares 99 entries with `importPath: "../domains/<name>/index.js"` (or `../modules/<name>/index.js` for hexagonal modules like `fleet-registry`) and loads them via `await import(config.importPath)`. All 99 real targets are pinned as `entry` paths in `knip.json` so knip resolves them. Adding/removing a registry entry must be matched in `knip.json`. Note: only the **top-level** domain/module barrel is load-bearing — internal layer barrels (e.g. `<domain>/application/index.ts`, `<domain>/interfaces/index.ts`) are typically vestigial because top-level barrels import implementations directly. Verify before deleting layer barrels by checking what the top-level imports.
    2.  **Domain Barrel Re-Exports** — `server/domains/<domain>/index.ts` files re-export internal modules; the registry only imports the barrel, but the barrel keeps every named export reachable. Deleting "unused" exports from a barrel can silently break route registration.
    3.  **Repository Modular Loaders** — `server/repositories/<domain>/index.ts` loads sub-files via `loadModularFiles()`. The boot log line `[X Repository] Loaded N modular files` confirms the count; a drop indicates a missing file.
    Boot-health guard: `node scripts/check-boot-health.mjs` spawns the dev server and asserts (a) `Domain routers registered (99 modules)` is reached, (b) zero `Failed to register` lines, (c) `ARUS application is now live` emitted. Configure expected count via `BOOT_EXPECTED_MODULES`. **Run this guard after any deletion in `server/domains/`, `server/routes/`, `server/repositories/`, or any file matching a knip `entry` path.**
-   **Route Registration**: `domain-router-registry.ts` is the single route registration system. All routes — including infrastructure inline routes — register through the registry. Two modes: registerFn (for function-based registration) and router-mount (for Express Router objects with mountPath). Only observability routes (`/healthz`, `/readyz`, `/metrics`) are registered separately as a controlled exception. Route-registration guardrail prevents inline `app.get/post("/api/...")` outside approved files.
-   **PdM Domain**: Unified architecture — `server/pdm/routes.ts` (dashboard/risk/schedule), `server/domains/pdm-platform/` (inference, feature-store, fleet-analytics, model-registry, monitoring, prediction-governance, training-pipeline, digital-twin), `server/routes/pdm-gap-fill-routes.ts` (ML operations), `server/ml-routes/model-routes.ts` (CRUD), `server/routes/analytics/model-governance.ts` (read views). No deprecated annotations — all routes serve active client pages.

# Testing & CI/CD

-   **Unit Tests**: `npm run test:unit` runs ~335 tests in `tests/unit/` covering STCW compliance, prediction calibration, work order validation, shared validators, middleware smoke, domain registry, maritime converters, money utils, RUL engine, statistics/anomaly detection, dual-schema parity, and Tauri Windows installer config/WiX/sidecar validation. No database or network required.
-   **Integration Tests**: `npm run test:integration` runs tests requiring a PostgreSQL service container.
-   **CI Pipeline**: `.github/workflows/ci.yml` with lint+typecheck, unit tests, integration tests (PostgreSQL service), build verification, and dead code detection (knip).
-   **Docker**: `Dockerfile` (multi-stage production build) and `docker-compose.yml` (local dev with PostgreSQL + Redis).
-   **Migration Numbering**: Sequential 0001-0012. Script `scripts/fix-migration-numbering.sh` resolves duplicate prefixes.

# External Dependencies

-   PostgreSQL
-   Neon Database
-   Turso (libSQL)
-   Redis
-   OpenAI
-   TensorFlow.js (@tensorflow/tfjs-node)
-   XGBoost
-   StormGeo
-   Aquametro FMCC
-   Edge Devices
