# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application designed to enhance operational efficiency, reduce downtime, and ensure regulatory compliance for marine fleets. It offers advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management, aiming to be a leader in marine predictive maintenance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The frontend is a mobile-first React 18 single-page application using TypeScript, `shadcn/ui`, Wouter, and TanStack Query. It emphasizes intuitive navigation, high information density, clear visual hierarchy, and WCAG 2.1 AA accessibility.

## Technical Implementations

### Frontend

Built with React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, and `shadcn/ui`. Features include WebSocket-based real-time synchronization, Progressive Web App (PWA) capabilities, and cross-platform deployment via Capacitor.

### Backend

Developed with Express.js and TypeScript, providing RESTful APIs with Zod validation. Key features span Vessel Intelligence, Inventory Management, and Analytics with Redis caching. Security measures include API readiness checks, graceful shutdown, CORS, redacted logging, Helmet CSP, and rate limiting.

#### Feature Specifications

-   **Predictive Maintenance**: Automated scheduling, real-time notifications, and cron-based failure prediction using an ensemble of LSTM, XGBoost, and Random Forest models with SHAP. Includes Proposed Maintenance Schedule view with Gantt-style scheduling (vessel x date grid), RUL-based task windows (P10/P50/P90 confidence bands), blocked task management, and schedule KPIs. Tasks flow to work orders with full PdM context preservation.
-   **Telemetry Ingestion**: A hybrid C# Windows Service and Node.js architecture for offline-first data collection, supporting marine protocols (J1939/J1708/J1587).
-   **AI/ML Capabilities**: Condition Monitoring AI Studio, AI Sensor Optimization, OpenAI-powered LLM reports, advanced ML & acoustic monitoring, automated ML training, and FFT-based vibration analysis.
-   **PdM Platform (Industrial-Grade)**: Feature Store (statistical feature extraction), Fleet Analytics (baselines + z-score comparison), Model Registry (versioning + deployment lifecycle), Inference Pipeline (end-to-end prediction with latency tracking), Explainability (SHAP-style feature contributions), and Model Monitoring/Drift Detection. Backend: `server/domains/pdm-platform/` (5 domain modules). Frontend: `/pdm-platform` page with 5 tabs. Schema: 7 new tables (`model_versions`, `model_metrics`, `equipment_features`, `fleet_baselines`, `inference_runs`, `prediction_explanations`, `model_drift_metrics`).
-   **Operational & Compliance**: STCW-compliant Crew Scheduling with Hours of Rest Dashboard and Fatigue Risk Score, Cost Savings & ROI Tracking, CII Compliance, Operating Mode Detection, immutable audit trails, digital logbooks, and a Compliance Rules Engine.
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, inventory tracking, multi-supplier support, and out-of-stock purchase request workflow (prompts user to create PR when adding out-of-stock parts, automatically extends work order completion date by supplier lead time).
-   **Unified Vendors System**: Type-based vendor architecture for suppliers and service providers.
-   **Analytics**: Interactive visualizations (Recharts), multi-format export, and a Real-Time Notification System.
-   **Simulation**: A Physics-Aware Vessel Telemetry Simulator for generating synthetic data.
-   **Knowledge Base**: RAG enrichment for AI-powered report generation, featuring document ingestion, semantic chunking, local MiniLM-L6-v2 embeddings, and hybrid vector+BM25 search.
-   **RAG Conversation System**: A modular RAG architecture supporting multi-turn conversations with an OpenAI-powered answer generator, LLM-based query rewriter, and semantic cache.
-   **Telemetry Resilience Modules**: Includes a circuit breaker for PostgreSQL write protection, a graceful shutdown manager, an in-memory dead-letter queue with replay API, raw payload archival with deduplication (SHA-256 hash), equipment heartbeat tracking (online/offline/stale status), batch acknowledgment for edge buffering, and schema versioning with validation rules for J1939/J1587 protocols.
-   **Scheduling System Overhaul (SmartPAL-style)**: A production-ready crew scheduling system with a domain layer for business logic, settings schema, telemetry for observability, and golden tests.

### Hexagonal Architecture (DDD Modular Monolith)

The backend employs hexagonal architecture for clean separation of concerns, comprising a Domain Layer (business logic), Application Layer (use cases), Infrastructure Layer (adapters), Interfaces Layer (HTTP routes), Domain Event Registry, and Cloud-Safe Outbox Processor. Key domains like Maintenance, Crew-Extensions, Inventory, Crew, and Work-Orders utilize this. The `crew-extensions` domain also implements CQRS read models and a DI wiring pattern using constructor injection.

## System Design Choices

-   **Database**: Dual-mode deployment with cloud PostgreSQL (TimescaleDB) and local SQLite (Turso sync).
-   **Schema**: Normalized schema with UUID primary keys, timestamp tracking, PostgreSQL data types, and SQLite compatibility, modularized into 35 domain-specific files.
-   **Single-Tenant Architecture**: Simplified architecture with centralized tenant configuration in `shared/config/tenant.ts`. All modules import `DEFAULT_ORG_ID` from this single source of truth to prevent value drift across the codebase.
-   **Authentication**: HMAC for edge devices and password-protected admin mode with server-side session verification.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation violation alerts, and secure fleet status reporting.
-   **Telemetry Ingestion Architecture**: Enforces a single ingestion path (Hardware → C# Agent → SQLite → Node Bridge → PostgreSQL) with SQLite WAL-mode, cursor-based batch processing, exponential backoff, and source guard validation.
-   **ML/AI Backend**: Production ML models stored in the `ml_models` table with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Supports Cloud, Desktop (Tauri v2), and Mobile (Capacitor iOS/iPadOS).
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Includes a Redis circuit breaker, index version tracking, Vite code splitting, dependency pre-bundling, API caching, lazy-loaded pages, memoized context providers, optimized TanStack Query defaults, and image lazy loading.
-   **Database Indexing**: Migrations manage index creation, with production performing verification only.

# External Dependencies

-   **PostgreSQL**: Primary relational database.
-   **Neon Database**: Cloud hosting for PostgreSQL.
-   **Turso (libSQL)**: Local SQLite database with cloud synchronization.
-   **Redis**: High-performance caching.
-   **OpenAI**: AI-powered reports and analytics.
-   **TensorFlow.js (@tensorflow/tfjs-node)**: Neural network framework for LSTM.
-   **XGBoost**: Gradient boosting framework.
-   **StormGeo**: Weather and routing data provider.
-   **Aquametro FMCC**: Fuel Mass Consumption Computer.
-   **Edge Devices**: Marine equipment and IoT devices.

# Code Quality (Recent Fixes)

-   **Tenant Isolation**: All `validateOrgId` methods across 11 DB storage files now throw errors instead of logging warnings when orgId is missing, enforcing tenant isolation on mutating operations.
-   **Parameter Order**: `storage.getEquipment()` calls standardized to `(orgId, equipmentId)` across 8 files that previously had reversed arguments.
-   **Health Monitoring**: `IHealthStorage` interface replaces `any` type. `jobQueue.getStats()` and `getRecentJobs()` stub methods added to prevent runtime crashes on `/api/health/background-jobs`.
-   **Type Safety**: Actionable insights page uses typed `Severity` and `InsightType` unions instead of `Record<string, ...>`.
-   **CI Scripts**: `typecheck`, `lint`, `format`, `format:check` scripts added to package.json.
-   **Stub Documentation**: `getScheduleAssignmentsByRun` now logs a warning instead of silently returning empty array.