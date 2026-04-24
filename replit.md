# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application designed to optimize marine fleet operations. It achieves this through advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management. The project's core purpose is to reduce operational costs, enhance safety standards, and ensure regulatory compliance across the global marine fleet, primarily by integrating AI/ML technologies.

# User Preferences

Preferred communication style: Simple, everyday language.

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
-   **Digital Twin Platform**: Offers Twin Definition, State computation, Residual Analysis, Scenario Simulation, and Replay/Time Travel functionalities.
-   **Operational & Compliance**: STCW-compliant Crew Scheduling with Fatigue Risk Score, Cost Savings & ROI Tracking, CII Compliance, Operating Mode Detection, immutable audit trails, digital logbooks, and a Compliance Rules Engine.
-   **Import Adapters**: Supports CSV/XML imports from AMOS CMMS and SBN SHIPMATE ERP.
-   **Equipment Hierarchy**: Manages parent-child equipment relationships.
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, multi-supplier support, unified completion paths with prediction feedback, and financial tracking.
-   **Dashboards**: Bridge Dashboard with key metrics and alerts; Analytics Hub with headline metrics and AI Key Findings.
-   **Simulation**: Physics-Aware Vessel Telemetry Simulator for synthetic data generation.
-   **AI Copilot Agent**: Natural language chat interface (OpenAI function-calling) for fleet operations with tiered permissions and SSE streaming.
-   **Knowledge Base**: Single-purpose document management with search, upload, and semantic search.
-   **Agent Activity & Findings**: Observability pages for agent runs and a unified feed of agent suggestions.
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
-   **API Response Contracts**: `validateResponse<T>` helper for outbound response validation against Zod schemas, designed for drift tolerance and robust error handling across environments.
-   **Structured Logging**: `server/lib/structured-logger.ts` provides a leveled logging solution (`debug`/`info`/`warn`/`error`) that automatically enriches log entries with correlation and request context, ensuring observability without impacting performance or stability.

## System Design Choices

-   **Database**: Dual-mode deployment with cloud PostgreSQL (TimescaleDB) and local SQLite (Turso sync), utilizing a normalized schema.
-   **Architecture**: Single-tenant with centralized configuration, implementing a Hexagonal Architecture (DDD Modular Monolith).
-   **Authentication**: HMAC for edge devices; bcryptjs for password hashing; SHA-256 hashed session tokens; session-based admin authentication.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation alerts, and comprehensive input validation.
-   **Telemetry Ingestion Architecture**: Single ingestion path with SQLite WAL-mode, cursor-based batch processing, and exponential backoff.
-   **ML/AI Backend**: Production ML models stored in `ml_models` table with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Cloud, Desktop (Tauri v2 with sidecar backend), and Mobile (Capacitor iOS/iPadOS).
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Redis circuit breaker, Vite code splitting, API caching, lazy-loaded pages, and memoized context providers.
-   **Component Decomposition**: Large feature components are organized into directories with `index.tsx` as the entry point and individual files for subcomponents, promoting modularity and maintainability.
-   **Storage Architecture**: `server/repositories.ts` acts as the single canonical import for all data access operations.
-   **Convergence Guardrails**: Scripts are in place to prevent schema drift, enforce storage and domain import boundaries, and ensure proper route registration.
-   **Dynamic-Loader Map**: Mechanism for dynamic loading of domain routers, barrel re-exports, and repository modular loaders.
-   **Route Registration**: `domain-router-registry.ts` is the centralized system for all route registration.

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