# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application designed to enhance operational efficiency, reduce downtime, and ensure regulatory compliance for marine fleets. It provides advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management, aiming to be a leader in marine predictive maintenance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The frontend is a mobile-first React 18 single-page application built with TypeScript, `shadcn/ui`, Wouter, and TanStack Query. It prioritizes intuitive navigation, high information density, clear visual hierarchy, and WCAG 2.1 AA accessibility.

## Technical Implementations

### Frontend

Built with React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, and `shadcn/ui`. Key features include WebSocket-based real-time synchronization, Progressive Web App (PWA) capabilities, and cross-platform deployment via Capacitor (mobile) and Tauri v2 (desktop). A desktop first-run setup wizard facilitates backend URL configuration.

### Backend

Developed with Express.js and TypeScript, offering RESTful APIs with Zod validation. It incorporates Vessel Intelligence, Inventory Management, and Analytics, leveraging Redis caching. Security features include API readiness checks, graceful shutdown, CORS, redacted logging, Helmet CSP, and rate limiting.

#### Feature Specifications

-   **Predictive Maintenance**: Automated scheduling, real-time notifications, and cron-based failure prediction using ensemble ML models (LSTM, XGBoost, Random Forest). Includes RUL-based task windows, blocked task management, and schedule KPIs.
-   **Telemetry Ingestion**: A hybrid C# Windows Service and Node.js architecture for offline-first data collection, supporting marine protocols (J1939/J1708/J1587).
-   **AI/ML Capabilities**: Condition Monitoring AI Studio, AI Sensor Optimization, OpenAI-powered LLM reports, advanced ML & acoustic monitoring, automated ML training, and FFT-based vibration analysis.
-   **PdM Platform (Industrial-Grade)**: Features a Feature Store, Fleet Analytics with equipment-type-scoped baselines, a Model Registry for versioning and deployment, an Inference Pipeline, Explainability (SHAP-style feature contributions), and Model Monitoring/Drift Detection.
-   **Training Pipeline**: Manages the end-to-end model training lifecycle, including dataset management, run monitoring, and model promotion.
-   **Prediction Governance**: Implements validity windows, provenance tracking, and a review/approve/suppress workflow for failure predictions.
-   **Digital Twin Platform (Asset-Level)**: Provides Twin Definition (templates + instances), Twin State computation, Residual Analysis, Scenario Simulation, and Replay/Time Travel capabilities. Integrates with existing telemetry and analytics.
-   **Continuous Twin Updates**: Scheduled twin state and residual refreshes with freshness tracking.
-   **Operational & Compliance**: STCW-compliant Crew Scheduling with Fatigue Risk Score, Cost Savings & ROI Tracking, CII Compliance, Operating Mode Detection, immutable audit trails, digital logbooks, and a Compliance Rules Engine.
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, multi-supplier support, and an out-of-stock purchase request workflow.
-   **Unified Vendors System**: Type-based vendor architecture for suppliers and service providers.
-   **Analytics**: Interactive visualizations, multi-format export, and a Real-Time Notification System.
-   **Simulation**: A Physics-Aware Vessel Telemetry Simulator for generating synthetic data.
-   **Knowledge Base**: RAG enrichment for AI-powered report generation, featuring document ingestion, semantic chunking, and hybrid vector+BM25 search.
-   **RAG Conversation System**: A modular RAG architecture supporting multi-turn conversations with an OpenAI-powered answer generator.
-   **Telemetry Resilience Modules**: Includes a circuit breaker for PostgreSQL write protection, graceful shutdown, in-memory dead-letter queue, raw payload archival, equipment heartbeat tracking, batch acknowledgment, and schema versioning.
-   **Scheduling System Overhaul**: A production-ready crew scheduling system.
-   **PdM Gap-Fill Services**: Six production-ready services closing the gap between demo and fleet-operator trust: Prediction Calibration (Platt scaling), Prediction Outcome Tracker, Anomaly Correlator (spatial/temporal grouping), Telemetry Aggregator (multi-resolution bucketing into `telemetry_aggregated`), Model Evaluation Gate, and ML Training Job Queue (async via pg-boss). Routes in `server/routes/pdm-gap-fill-routes.ts` (10 endpoints).
-   **Hardening (22 Items)**: Security (HMAC key rotation, replay protection, RAG document sanitizer), Resilience (DB degradation layer, WS message buffer, LLM statistical fallback, storage circuit breaker), Data (idempotency middleware, telemetry partitioning migration, equipment ID validator), Performance (dashboard pre-computation, equipment health pagination, async compliance check), Ops (migration runner, structured error codes, API versioning `/api/v1/*`, correlation ID middleware, gap-fill smoke tests), Maritime (vessel timezone service, bandwidth-aware responses, running hour accumulator, class survey tracking).

### Hexagonal Architecture (DDD Modular Monolith)

The backend uses a hexagonal architecture for separation of concerns, featuring a Domain Layer, Application Layer, Infrastructure Layer, Interfaces Layer, Domain Event Registry, and Cloud-Safe Outbox Processor. Key domains like Maintenance, Crew-Extensions, Inventory, Crew, and Work-Orders follow this pattern, with `crew-extensions` also utilizing CQRS read models.

## System Design Choices

-   **Database**: Dual-mode deployment with cloud PostgreSQL (TimescaleDB) and local SQLite (Turso sync).
-   **Schema**: Normalized schema with UUID primary keys, timestamp tracking, PostgreSQL data types, and SQLite compatibility, modularized into domain-specific files.
-   **Single-Tenant Architecture**: Centralized tenant configuration for simplified architecture.
-   **Authentication**: HMAC for edge devices; bcryptjs (pure JS, cost=12) password hashing with `ADMIN_TOKEN_HASH` env var; SHA-256 hashed session tokens stored in DB; session-based admin auth via Bearer token lookup; legacy `ADMIN_TOKEN` auto-migrates on first login. Admin setup restricted to localhost/Tauri origins.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation violation alerts, secure fleet status reporting, 128-char password cap, shared URL validation (`urlValidation.ts`), conditional `trust proxy` (loopback for vessel/desktop, true for cloud), 5MB body limit, response log truncation at 500 chars, public health endpoints (`/healthz`, `/readyz`) exempt from auth.
-   **Telemetry Ingestion Architecture**: Enforces a single ingestion path with SQLite WAL-mode, cursor-based batch processing, exponential backoff, and source guard validation.
-   **ML/AI Backend**: Production ML models stored in the `ml_models` table with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Supports Cloud, Desktop (Tauri v2 with sidecar backend + Windows NSSM service), and Mobile (Capacitor iOS/iPadOS).
-   **Tauri Desktop Architecture**: Sidecar management spawns a bundled Express server binary (`arus-server`) with lifecycle monitoring. On Windows, production installs use NSSM to run the backend as a Windows Service (`ARUSBackend`) via WiX installer with dedicated `ARUS_svc` service account. Two installer variants: vessel (offlineInstaller, ~145MB, air-gapped) and cloud (downloadBootstrapper, ~25MB). Dev mode uses sidecar spawning with auto-detection of existing services. First-run setup wizard configures deployment mode, backend URL, vessel ID, and admin password. 4-stage sidecar build pipeline (`scripts/build-sidecar.mjs`): esbuild bundle → pkg compile → smoke test (`--health-check`) → binary copy. Server entry point (`server/index.ts`) supports `--init-db` and `--health-check` CLI modes for WiX post-install and build verification.
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Includes Redis circuit breaker, index version tracking, Vite code splitting, dependency pre-bundling, API caching, lazy-loaded pages, memoized context providers, optimized TanStack Query defaults, and image lazy loading.
-   **Database Indexing**: Migrations manage index creation.

# External Dependencies

-   **PostgreSQL**: Primary relational database.
-   **Neon Database**: Cloud hosting for PostgreSQL.
-   **Turso (libSQL)**: Local SQLite database with cloud synchronization.
-   **Redis**: High-performance caching.
-   **OpenAI**: AI-powered reports and analytics.
-   **TensorFlow.js (@tensorflow/tfjs-node)**: Neural network framework.
-   **XGBoost**: Gradient boosting framework.
-   **StormGeo**: Weather and routing data provider.
-   **Aquametro FMCC**: Fuel Mass Consumption Computer.
-   **Edge Devices**: Marine equipment and IoT devices.