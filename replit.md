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
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, multi-supplier support, and out-of-stock purchase request workflows.
-   **Analytics**: Interactive visualizations, multi-format export, and a Real-Time Notification System.
-   **Simulation**: Physics-Aware Vessel Telemetry Simulator for synthetic data generation.
-   **AI Copilot Agent**: Natural language chat interface (OpenAI function-calling) for fleet operations queries with tiered permissions, SSE streaming, and conversation persistence.
-   **Knowledge Base**: Consolidated single-page with Chat (default) and Documents tabs. RAG enrichment for AI-powered report generation, including document ingestion, semantic chunking, and hybrid vector+BM25 search. `/kb-chat` redirects to `/knowledge-base?tab=chat`.
-   **Telemetry Resilience Modules**: Circuit breaker for PostgreSQL, graceful shutdown, in-memory dead-letter queue, and equipment heartbeat tracking.
-   **Unified Domain Event Bus**: Consolidated, strongly-typed event bus with 40+ event types.
-   **Certificate Registry**: Hexagonal domain for vessel certificates with validity tracking, survey windows, and immutable audit trail.
-   **Hazmat/IMDG Parts**: Dedicated fields on the parts table for dangerous goods classification.
-   **Dev Mode Production Guard**: Ensures dev mode features are tree-shaken in production builds.
-   **Hardening**: Comprehensive security (HMAC key rotation, RAG document sanitizer), resilience (DB degradation layer, LLM statistical fallback), data (idempotency middleware, telemetry partitioning), performance (dashboard pre-computation, API caching), and maritime-specific features (vessel timezone service, running hour accumulator).
-   **OSV Specific Features**: DP Monitoring, Charter Compliance KPI tracking, OVID/SIRE Vetting inspection management, Offshore Operations Logging, EFMS Integration, and RMS Shore Monitoring with Aquametro FMCC integration. Includes OSV-specific role definitions and vessel extensions.
-   **Equipment Intelligence**: Consolidated AI/ML/PdM view with fleet summary, risk-sorted equipment list, and detailed drawer, implemented with a hexagonal architecture. Coexists with standalone PdM Dashboard (risk queue, telemetry coverage, scheduling), PdM Pack (bearing/pump diagnostics), PdM Platform (ML lifecycle management), and Digital Twin (virtual replicas, simulation) pages — each serving distinct workflows that Equipment Intelligence does not replace.

## System Design Choices

-   **Database**: Dual-mode deployment with cloud PostgreSQL (TimescaleDB) and local SQLite (Turso sync) with a normalized schema and UUID primary keys.
-   **Single-Tenant Architecture**: Centralized tenant configuration.
-   **Authentication**: HMAC for edge devices; bcryptjs for password hashing; SHA-256 hashed session tokens; session-based admin auth.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation alerts, secure fleet status reporting, and comprehensive input validation.
-   **Telemetry Ingestion Architecture**: Single ingestion path with SQLite WAL-mode, cursor-based batch processing, and exponential backoff.
-   **ML/AI Backend**: Production ML models stored in `ml_models` table with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Supports Cloud, Desktop (Tauri v2 with sidecar backend), and Mobile (Capacitor iOS/iPadOS).
-   **Tauri Desktop Architecture**: Sidecar management spawns a bundled Express server binary, with Windows production installs utilizing NSSM.
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Redis circuit breaker, Vite code splitting, API caching, lazy-loaded pages, memoized context providers, and optimized TanStack Query defaults.
-   **Hexagonal Architecture (DDD Modular Monolith)**: Clear separation of concerns into Domain, Application, Infrastructure, and Interfaces layers, with a Domain Event Registry and Cloud-Safe Outbox Processor.

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