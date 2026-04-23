# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application that optimizes marine fleet operations through advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management. The project aims to reduce costs, improve safety, and ensure regulatory adherence across the global fleet by leveraging AI/ML technologies.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The frontend is a mobile-first React 18 single-page application, built with TypeScript, `shadcn/ui`, Wouter, and TanStack Query. It focuses on intuitive navigation, high information density, clear visual hierarchy, and WCAG 2.1 AA accessibility, designed for full responsiveness.

## Technical Implementations

### Frontend

Built with React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, and `shadcn/ui`. It supports WebSocket real-time synchronization, PWA capabilities, and cross-platform deployment via Capacitor (mobile) and Tauri v2 (desktop).

### Backend

Developed with Express.js and TypeScript, offering RESTful APIs with Zod validation. It integrates Vessel Intelligence, Inventory Management, and Analytics, utilizing Redis caching and robust security features.

#### Feature Specifications

-   **Predictive Maintenance**: Automated scheduling, real-time notifications, and cron-based failure prediction using ensemble ML models and RUL-based task windows.
-   **Telemetry Ingestion**: Hybrid C# Windows Service and Node.js architecture for offline-first data collection, supporting marine protocols.
-   **AI/ML Capabilities**: Condition Monitoring AI Studio, AI Sensor Optimization, OpenAI-powered LLM reports, advanced ML & acoustic monitoring, automated ML training, FFT-based vibration analysis, and a comprehensive PdM Platform.
-   **Digital Twin Platform**: Provides Twin Definition, State computation, Residual Analysis, Scenario Simulation, and Replay/Time Travel.
-   **Operational & Compliance**: STCW-compliant Crew Scheduling with Fatigue Risk Score, Cost Savings & ROI Tracking, CII Compliance, Operating Mode Detection, immutable audit trails, digital logbooks, and a Compliance Rules Engine.
-   **Import Adapters**: Supports CSV/XML imports from AMOS CMMS and SBN SHIPMATE ERP.
-   **Equipment Hierarchy**: Manages parent-child equipment relationships.
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, multi-supplier support, and unified completion paths with prediction feedback and financial tracking.
-   **Dashboards**: Bridge Dashboard with key metrics and alerts; Analytics Hub with headline metrics and AI Key Findings.
-   **Simulation**: Physics-Aware Vessel Telemetry Simulator for synthetic data generation.
-   **AI Copilot Agent**: Natural language chat interface (OpenAI function-calling) for fleet operations with tiered permissions and SSE streaming.
-   **Knowledge Base**: Single-purpose document management page with search, upload, filters, and semantic search.
-   **Agent Activity & Findings**: Observability pages for agent runs and a unified feed of agent suggestions and findings.
-   **Telemetry Resilience**: Circuit breaker, graceful shutdown, in-memory dead-letter queue, and equipment heartbeat tracking.
-   **Unified Domain Event Bus**: Consolidated, strongly-typed event bus.
-   **Certificate Registry**: Hexagonal domain for vessel certificates with validity tracking.
-   **Hazmat/IMDG Parts**: Dedicated fields for dangerous goods classification.
-   **Hardening**: Comprehensive security, resilience, data integrity, and performance optimizations.
-   **OSV Specific Features**: DP Monitoring, Charter Compliance KPI tracking, OVID/SIRE Vetting inspection management, Offshore Operations Logging, EFMS Integration, and RMS Shore Monitoring.
-   **Equipment Intelligence**: Consolidated AI/ML/PdM view with fleet summary and risk-sorted equipment list.
-   **Daily Operations Briefing**: Automated shift-start summary with AI-generated executive summary.
-   **Financial Layer**: Three-part cost integrity system covering procurement to WO cost flow, decision-point cost context for AI suggestions, and savings claim integrity.
-   **Prediction Lineage**: Tracks `modelVersionId`, `featureSetVersion`, and `featureSnapshotId` for audit and reproducibility of predictions.
-   **API Response Contracts**: `validateResponse<T>` helper in `server/lib/api-helpers.ts` validates outbound responses against Zod schemas (throws in dev/test, logs+passes-through in production). Wired into 14 endpoints across PDM, home, and permissions domains. Schemas use `.passthrough()` + `.optional()` to catch missing required fields without rejecting drift; ID fields use `z.string().or(z.number())`; date fields use `isoOrDateSchema = z.union([z.date(), z.string().datetime({ offset: true })])`. Schema drift inventory in `scripts/drift-burndown.json` carries `resolution` + `risk` notes for each medium-priority entry.
-   **Cast Compression Helpers**: `pickSchema<T>` and `cloudOnly<T>` for dual-mode table exports, and `col(name)` / `columns()` for dynamic Drizzle column access.
-   **withErrorHandling Default Generic**: Simplifies error handling by defaulting generic `Req` to `Request`.

## System Design Choices

-   **Database**: Dual-mode deployment with cloud PostgreSQL (TimescaleDB) and local SQLite (Turso sync) with a normalized schema.
-   **Architecture**: Single-tenant with centralized configuration, utilizing a Hexagonal Architecture (DDD Modular Monolith).
-   **Authentication**: HMAC for edge devices; bcryptjs for password hashing; SHA-256 hashed session tokens; session-based admin auth.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation alerts, and comprehensive input validation.
-   **Telemetry Ingestion Architecture**: Single ingestion path with SQLite WAL-mode, cursor-based batch processing, and exponential backoff.
-   **ML/AI Backend**: Production ML models stored in `ml_models` table with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Cloud, Desktop (Tauri v2 with sidecar backend), and Mobile (Capacitor iOS/iPadOS).
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Redis circuit breaker, Vite code splitting, API caching, lazy-loaded pages, and memoized context providers.
-   **Component Decomposition**: Large feature components split into directories with `index.tsx` as the entry point and one file per subcomponent. Examples: `client/src/features/pdm/components/schedule-view/` (`ScheduleKPIStrip`, `FilterBar`, `GanttScheduleView`, `BlockedTasksSection`, `MoveTaskDialog`, `TaskDetailPanel`, `RulGauge`, `StatusComponents`, plus shared `constants.ts` and `utils.ts`); `client/src/components/agent/AgentChatPanel/` (`ConversationHistory`, `EmptyState`, `MessageBubble`, `StreamingIndicator`, `MessageInputBar`, `ToolCallTimeline`, `InlineDraftApproval`, plus `types.ts`, `constants.ts`, `streamClient.ts` for stream retry logic); `client/src/pages/certificate-registry/` (`CertificateFormDialog`, `SummaryCards`, `FilterBar`, `CertificatesTable`, `CertificateDetailSheet`, `DeleteConfirmDialog`, `LoadingSkeleton`, plus `constants.ts`, `utils.ts`, `types.ts`; `index.tsx` re-exports `CERT_TYPE_LABELS` and `getCertExpiryStatus` so consumer `client/src/pages/equipment.tsx` keeps its named imports). Module resolution falls through to `index.tsx`, so existing import paths remain stable.
-   **Storage Architecture**: `server/repositories.ts` serves as the single canonical import for all data access.
-   **Convergence Guardrails**: Scripts to prevent schema drift, enforce storage and domain import boundaries, and ensure proper route registration.
-   **Dynamic-Loader Map**: Mechanism for dynamic loading of domain routers, barrel re-exports, and repository modular loaders.
-   **Route Registration**: `domain-router-registry.ts` is the single system for all route registration.

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