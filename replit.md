# Overview

ARUS (Marine Predictive Maintenance & Scheduling) is a full-stack web application designed to enhance operational efficiency, reduce downtime, and ensure regulatory compliance for marine fleets. It provides advanced equipment monitoring, predictive maintenance, intelligent scheduling, and comprehensive inventory management, aiming to be a leader in marine predictive maintenance. The project's vision is to deliver a cutting-edge platform that leverages AI/ML to transform marine operations, reduce costs, and improve safety and regulatory adherence across the global fleet.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The frontend is a mobile-first React 18 single-page application built with TypeScript, `shadcn/ui`, Wouter, and TanStack Query. It emphasizes intuitive navigation, high information density, clear visual hierarchy, and WCAG 2.1 AA accessibility.

-   **Vessel Dashboard**: Three-panel command center (`vessel-dashboard.tsx`, route `/vessels/:id`) replaces the old `vessel-detail.tsx`. Left panel: vessel status sidebar with health/risk gauges, key metrics. Center: interactive SVG vessel schematic with equipment hotspots + bottom tabs (Work Orders, Crew, Maintenance, Performance, DTCs). Right: inventory panel with compatible/critical/all parts tabs linked to selected equipment. Legacy `equipment-registry.tsx` deleted (was already a dead redirect to `/equipment`).

## Technical Implementations

### Frontend

Built with React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, and `shadcn/ui`. Key features include WebSocket-based real-time synchronization, Progressive Web App (PWA) capabilities, and cross-platform deployment via Capacitor (mobile) and Tauri v2 (desktop).

### Backend

Developed with Express.js and TypeScript, offering RESTful APIs with Zod validation. It integrates Vessel Intelligence, Inventory Management, and Analytics, leveraging Redis caching. Security features include API readiness checks, graceful shutdown, CORS, redacted logging, Helmet CSP, and rate limiting.

#### Feature Specifications

-   **Predictive Maintenance**: Automated scheduling, real-time notifications, and cron-based failure prediction using ensemble ML models (LSTM, XGBoost, Random Forest) including RUL-based task windows.
-   **Telemetry Ingestion**: Hybrid C# Windows Service and Node.js architecture for offline-first data collection, supporting marine protocols (J1939/J1708/J1587).
-   **AI/ML Capabilities**: Condition Monitoring AI Studio, AI Sensor Optimization, OpenAI-powered LLM reports, advanced ML & acoustic monitoring, automated ML training, FFT-based vibration analysis, a PdM Platform (Feature Store, Fleet Analytics, Model Registry, Inference Pipeline, Explainability, Model Monitoring/Drift Detection), and a Training Pipeline.
-   **Digital Twin Platform**: Provides Twin Definition, Twin State computation, Residual Analysis, Scenario Simulation, and Replay/Time Travel capabilities with continuous updates.
-   **Operational & Compliance**: STCW-compliant Crew Scheduling with Fatigue Risk Score, Cost Savings & ROI Tracking, CII Compliance, Operating Mode Detection, immutable audit trails, digital logbooks, and a Compliance Rules Engine.
-   **Logbook Correction Workflow**: Maritime-compliant correction system where original entries are never deleted — corrections are new entries referencing the original with mandatory reason. Immutable audit trail (`logbook_audit_log` table with triggers preventing UPDATE/DELETE), PSC inspection view, and countersigning. Uses unified `log_entries` table. Routes: `/api/logbook/corrections`, `/api/logbook/:entryId/corrections`, `/api/logbook/:entryId/audit`, `/api/logbook/psc-view`, `/api/logbook/:entryId/countersign`. Migration: `007-logbook-corrections-sensor-calibration.sql`.
-   **Sensor Calibration Registry**: Tracks calibration schedules, drift, accuracy, and operational limits for all sensors feeding telemetry data. Computes a data quality score (% of sensors properly calibrated) that directly affects PdM confidence intervals. Supports sensor types: vibration, temperature, pressure, flow, level, rpm, torque, humidity, exhaust_gas, fuel_flow. Routes: `/api/sensors/calibration`, `/api/sensors/calibration/summary`, `/api/sensors/calibration/overdue`, `/api/sensors/calibration/:id`, `/api/sensors/calibration/:id/calibrate`. Migration: `007-logbook-corrections-sensor-calibration.sql`.
-   **AMOS Import Adapter**: CSV/XML file import from AMOS CMMS with field mapping, dry-run preview, upsert logic, and optional RAG ingestion. Supports equipment (with hierarchy), work orders, parts, and maintenance plans. Routes: `POST /api/import/amos`, `POST /api/import/amos/preview`, `GET /api/import/amos/mappings`.
-   **SHIPMATE Import Adapter**: CSV import from SBN SHIPMATE ERP (PMS/SPS/CMS modules). Extends the AMOS parser with SHIPMATE-specific header normalization, component number dot-notation hierarchy, vessel name resolution, running hours sync, and RAG knowledge base ingestion. Modules: `pms_equipment`, `pms_jobs`, `sps_stores`, `cms_crew_certs` (read-only), `cms_rest_hours` (read-only). Routes: `POST /api/import/shipmate`, `POST /api/import/shipmate/preview`, `GET /api/import/shipmate/modules`.
-   **Equipment Hierarchy**: Parent-child equipment relationships with `parentEquipmentId`, auto-computed `hierarchyLevel` and `hierarchyPath` via DB trigger, and `equipment_tree` view.
-   **Inventory & Work Orders**: Modernized UIs with virtualized tables, checklists, multi-supplier support, and an out-of-stock purchase request workflow, integrated with a Unified Vendors System.
-   **Analytics**: Interactive visualizations, multi-format export, and a Real-Time Notification System.
-   **Simulation**: A Physics-Aware Vessel Telemetry Simulator for generating synthetic data.
-   **AI Copilot Agent**: Natural language chat interface (OpenAI function-calling) for fleet operations queries with 12 tools, a tiered permission model, SSE streaming, conversation persistence, multimodal input, proactive suggestion engine, and scheduled autonomous runs.
-   **Knowledge Base**: RAG enrichment for AI-powered report generation, featuring document ingestion, semantic chunking, and hybrid vector+BM25 search, integrated into a RAG Conversation System.
-   **Telemetry Resilience Modules**: Includes a circuit breaker for PostgreSQL write protection, graceful shutdown, in-memory dead-letter queue, and equipment heartbeat tracking.
-   **Unified Domain Event Bus**: A consolidated, strongly-typed event bus replacing fragmented event systems, covering 40+ event types across multiple namespaces.
-   **Certificate Registry**: Hexagonal domain for vessel certificates (class, statutory, flag state) with validity tracking, survey windows, conditions of class, flag state endorsements, and immutable audit trail. Routes: `/api/certificates`, `/api/certificates/summary`, `/api/certificates/expiring`. Migration: `006-certificates-hazmat-devmode.sql`.
-   **Hazmat/IMDG Parts**: Dedicated columns on `parts` table for dangerous goods classification (`imo_dg_class`, `un_number`, `imdg_code`, `is_hazmat`, `hazmat_handling`, `shelf_life_days`, `customs_tariff_code`, `msds_url`) replacing generic JSONB storage.
-   **Dev Mode Production Guard**: All dev mode permission bypasses gated by `import.meta.env.DEV` (Vite build-time constant). In production builds, dev mode code is tree-shaken out entirely. Affects `PermissionsContext`, `PermissionGate`, `DevModeToggle`.
-   **Hardening**: Comprehensive security (HMAC key rotation, RAG document sanitizer), resilience (DB degradation layer, LLM statistical fallback), data (idempotency middleware, telemetry partitioning), performance (dashboard pre-computation, API caching), ops (migration runner, API versioning), and maritime-specific (vessel timezone service, running hour accumulator, class survey tracking) features.
-   **DP Monitoring**: DP system configuration (DP1/DP2/DP3 class, thrusters, reference systems, power redundancy), IMCA-format incident reporting, daily pre-operations checklists, and fleet DP summary dashboard. Routes: `/api/dp/systems`, `/api/dp/incidents`, `/api/dp/daily-checks`, `/api/dp/summary`. Migration: `008-osv-specific.sql`.
-   **Charter Compliance**: Charter party KPI tracking (availability %, response time, fuel consumption, DP uptime) against contractual targets, daily/weekly KPI logging with auto-computed compliance flags, performance dashboard, and fleet overview. Routes: `/api/charter`, `/api/charter/kpi`, `/api/charter/:id/performance`, `/api/charter/fleet-overview`. Migration: `008-osv-specific.sql`.
-   **OVID/SIRE Vetting**: Inspection records (OVID, SIRE, CDI, RightShip, client vetting, internal), individual findings with remediation workflow (open → in_progress → closed → verified), auto-updating finding counts, and fleet vetting readiness score. Routes: `/api/vetting`, `/api/vetting/:id/findings`, `/api/vetting/:inspectionId/findings/:findingId/close`, `/api/vetting/fleet-readiness`. Migration: `008-osv-specific.sql`.
-   **Offshore Operations Logging**: Cargo transfer, anchor handling, SPM, bunkering, DP watchkeeping, and personnel transfer logs with weather conditions, safety checks (toolbox talk, JSA, PTW), client sign-off, and fuel consumption tracking. Operations summary feeds charter KPI reporting. Routes: `/api/offshore-ops`, `/api/offshore-ops/:id/complete`, `/api/offshore-ops/summary`. Migration: `008-osv-specific.sql`.
-   **EFMS Integration**: Electronic Fuel Monitoring System connection management (CRUD for Modbus TCP/RTU device configs), register mapping, fleet EFMS status overview, and a Modbus TCP poller service for real-time fuel data ingestion into the telemetry pipeline. Routes: `/api/efms/connections`, `/api/efms/connections/:id`, `/api/efms/status`. Poller: `server/domains/efms/poller.ts`. Migration: `008-osv-specific.sql`.
-   **RMS Shore Monitoring**: Aquametro FMCC full integration with expanded register map (35 registers incl. shaft, tanks, boiler, aux engines, DO flow, bunker flow), auto bunkering detection service, configurable threshold/geofence/daily-consumption alerting, and shore-side monitoring dashboard. Tables: `rms_alert_configs`, `rms_bunkering_events`, `rms_alert_log`. Routes: `/api/rms/summary`, `/api/rms/alerts`, `/api/rms/alerts/configs`, `/api/rms/bunkering`, `/api/rms/consumption/hourly/:vesselId`, `/api/rms/consumption/daily/:vesselId`, `/api/rms/tanks/:vesselId`, `/api/rms/rob/:vesselId`, `/api/rms/fleet-positions`, `/api/rms/vessel-track/:vesselId`. Services: `server/services/rms/bunkering-detector.ts`, `server/services/rms/alert-service.ts`. Migration: `009-rms-monitoring.sql`. Frontend: `/rms-monitoring`.
-   **OSV Role Definitions**: Five OSV-specific personas (Chief Engineer, DP Operator, Deck Officer/Master, Shore Superintendent, System Admin) with tailored quick actions, pinned navigation groups, and bottom nav config. File: `server/services/osv-roles/definitions.ts`.
-   **Vessel Extensions**: `dp_class`, `vetting_status`, `last_vetting_date`, `charter_status`, `current_charter_id` columns on vessels table; `is_amod_required` and `local_authority` on vessel_certificates for Brunei AMOD requirements. Migration: `008-osv-specific.sql`.

### Hexagonal Architecture (DDD Modular Monolith)

The backend employs a hexagonal architecture for clear separation of concerns, featuring a Domain Layer, Application Layer, Infrastructure Layer, Interfaces Layer, Domain Event Registry, and Cloud-Safe Outbox Processor. Key domains like Maintenance, Crew-Extensions, Inventory, Crew, Work-Orders, Certificates, DP, Charter, Vetting, Offshore-Ops, EFMS, and RMS follow this pattern, with the Fleet Registry being the first fully extracted hexagonal module.

## System Design Choices

-   **Database**: Dual-mode deployment with cloud PostgreSQL (TimescaleDB) and local SQLite (Turso sync) with a normalized schema, UUID primary keys, and SQLite compatibility.
-   **Single-Tenant Architecture**: Centralized tenant configuration.
-   **Authentication**: HMAC for edge devices; bcryptjs for password hashing; SHA-256 hashed session tokens; session-based admin auth.
-   **Security**: Admin Audit Logging, automated IP tracking, tenant isolation alerts, secure fleet status reporting, and comprehensive input validation.
-   **Telemetry Ingestion Architecture**: Enforces a single ingestion path with SQLite WAL-mode, cursor-based batch processing, and exponential backoff.
-   **ML/AI Backend**: Production ML models stored in the `ml_models` table with org-scoped isolation and lifecycle tracking.
-   **Deployment Modes**: Supports Cloud, Desktop (Tauri v2 with sidecar backend), and Mobile (Capacitor iOS/iPadOS).
-   **Tauri Desktop Architecture**: Sidecar management spawns a bundled Express server binary, with Windows production installs utilizing NSSM to run the backend as a Windows Service.
-   **RBAC**: Comprehensive Role-Based Access Control system.
-   **Performance Optimizations**: Includes Redis circuit breaker, Vite code splitting, API caching, lazy-loaded pages, memoized context providers, and optimized TanStack Query defaults.

# External Dependencies

-   **PostgreSQL**
-   **Neon Database**
-   **Turso (libSQL)**
-   **Redis**
-   **OpenAI**
-   **TensorFlow.js (@tensorflow/tfjs-node)**
-   **XGBoost**
-   **StormGeo**
-   **Aquametro FMCC**
-   **Edge Devices**