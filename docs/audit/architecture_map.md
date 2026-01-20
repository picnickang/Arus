# ARUS Architecture Map

**Generated**: November 4, 2025  
**Repository**: ARUS Marine Predictive Maintenance Platform

## Module Graph

```
ARUS Platform (Monorepo)
├── client/                     # React 18 SPA Frontend
│   ├── src/
│   │   ├── pages/             # Wouter routes
│   │   ├── components/        # shadcn/ui components
│   │   ├── hooks/             # TanStack Query hooks
│   │   └── lib/               # Utilities
│   └── public/                # Static assets
│
├── server/                     # Express.js Backend
│   ├── domains/               # Domain-Driven Design modules
│   │   ├── alerts/            # Alert management (14 endpoints)
│   │   ├── crew/              # Crew scheduling (23 endpoints)
│   │   ├── devices/           # Device registry (5 endpoints)
│   │   ├── equipment/         # Equipment management (15 endpoints)
│   │   ├── inventory/         # Inventory tracking (11 endpoints)
│   │   ├── maintenance/       # Maintenance orders (12 endpoints)
│   │   ├── vessels/           # Vessel operations (13 endpoints)
│   │   └── work-orders/       # Work order system (8 endpoints)
│   │
│   ├── governance/            # ML Governance & Audit Trail
│   │   ├── types.ts           # Governance type definitions
│   │   ├── lineage.ts         # Model lineage tracking
│   │   ├── provenance.ts      # Event provenance (SHA-256)
│   │   ├── routes.ts          # Governance APIs (7 endpoints)
│   │   └── ml-integration.ts  # ML training pipeline integration
│   │
│   ├── ai/                    # AI/ML Services
│   │   ├── root-cause-analyzer.ts
│   │   ├── copilot-service.ts
│   │   └── narrative-summary-service.ts
│   │
│   ├── ML Pipeline (20+ files)
│   │   ├── ml-prediction-service.ts   # Main prediction orchestrator
│   │   ├── ml-lstm-model.ts           # LSTM time-series forecasting
│   │   ├── ml-random-forest.ts        # Random Forest classifier
│   │   ├── ml-xgboost-model.ts        # XGBoost gradient boosting
│   │   ├── ml-training-pipeline.ts    # Automated training
│   │   ├── ml-ensemble-orchestrator.ts # Hybrid predictions
│   │   ├── ml-dataset-mixer.ts        # Dataset composition
│   │   ├── ml-drift-monitoring.ts     # Model drift detection
│   │   ├── ml-explainability-service.ts # SHAP analysis
│   │   └── ml-model-registry.ts       # Model versioning
│   │
│   ├── infrastructure/        # Cross-cutting concerns
│   │   ├── TenantScopedRepository.ts  # Multi-tenant isolation
│   │   ├── feature-flags.ts           # Feature toggles
│   │   └── observability.ts           # Metrics/logging
│   │
│   ├── services/              # Business logic services
│   │   ├── update-checker.ts
│   │   ├── github-release-service.ts
│   │   └── config-manager.ts
│   │
│   ├── middleware/            # HTTP middleware
│   │   └── auth.ts            # Authentication/RBAC
│   │
│   ├── routes.ts              # Main API router (569 endpoints)
│   ├── storage.ts             # Data access layer (214 methods)
│   ├── db.ts                  # Database connection
│   └── index.ts               # Server entry point
│
├── shared/                     # Shared types & schemas
│   └── schema.ts              # Drizzle ORM schema
│
├── scripts/                    # Automation & testing
│   ├── verify-provenance.ts
│   ├── test-ml-accuracy.ts
│   └── setup-test-equipment.ts
│
├── checkpoints/                # JSONL audit logs (created on first use)
│   ├── lineage.jsonl          # Model lineage (not yet created)
│   └── provenance.jsonl       # Event provenance chain (not yet created)
│
├── data/                       # Embedded SQLite databases
│   └── vessel-local.db        # Local vessel deployment database
│
└── docs/                       # Documentation
    ├── audit/                  # Audit reports (NEW - Phase 1 complete)
    └── dashboards/             # Grafana templates (EMPTY - Phase 2 deliverable)
```

## API Endpoint Inventory

### Total HTTP Endpoints: ~650+

| Module | Routes | Key Endpoints |
|--------|--------|---------------|
| **Main Router** | 569 | Dashboard, Fleet, Equipment, Telemetry |
| **Alerts** | 14 | Alert management, acknowledgement |
| **Crew** | 23 | Scheduling, STCW compliance |
| **Devices** | 5 | Device registry, status |
| **Equipment** | 15 | Health, RUL, degradation |
| **Inventory** | 11 | Parts tracking, procurement |
| **Maintenance** | 12 | Work orders, scheduling |
| **Vessels** | 13 | Performance, VPS charts |
| **Work Orders** | 8 | Creation, assignment, tracking |
| **Governance** | 7 | Lineage, provenance, verification |

### Critical Entry Points

1. **Frontend Entry**: `client/src/App.tsx` → Wouter router
2. **Backend Entry**: `server/index.ts` → Express app
3. **API Gateway**: `server/routes.ts` → Route registration
4. **Data Layer**: `server/storage.ts` → Repository pattern
5. **Database**: `server/db.ts` → Drizzle ORM + PostgreSQL
6. **ML Pipeline**: `server/ml-prediction-service.ts` → Model orchestration
7. **Governance**: `server/governance/routes.ts` → Audit trail APIs

## Data Flow Patterns

### 1. Telemetry Ingestion
```
Edge Device → MQTT/HTTP → J1939 Collector → Sensor Fusion → Storage → ML Prediction
```

### 2. Predictive Maintenance Flow
```
Equipment Telemetry → ML Prediction Service → RUL Engine → Alert Generation → Work Order
                                            ↓
                                    Provenance Log (SHA-256 chain)
```

### 3. ML Training Pipeline
```
Dataset Mixer → Feature Engineering → Model Training (LSTM/RF/XGBoost) → Registry
                                                                         ↓
                                                                   Lineage Log
```

### 4. Governance Flow
```
Prediction/Alert → Record Provenance → SHA-256 Chain → Verification Script → Audit Report
```

## Cross-Cutting Concerns

| Concern | Implementation | Files |
|---------|----------------|-------|
| **Authentication** | Session + RBAC | `middleware/auth.ts` |
| **Multi-tenancy** | Tenant-scoped repos | `infrastructure/TenantScopedRepository.ts` |
| **Rate Limiting** | Express middleware | `config/rate-limits.ts` |
| **Observability** | Prometheus metrics | `observability.ts`, `structured-logging.ts` |
| **Error Handling** | Global handlers | `error-handling.ts`, `error-logger.ts` |
| **Validation** | Zod schemas | Throughout routes |
| **Caching** | LRU caches | `ml-lru-cache.ts`, in-memory |
| **Background Jobs** | Queue processor | `background-jobs.ts`, `job-processors.ts` |

## Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Routing**: Wouter
- **State**: TanStack Query v5
- **UI**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **PWA**: Service Worker + Offline support

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon) / SQLite (Turso)
- **ORM**: Drizzle
- **Validation**: Zod
- **ML**: TensorFlow.js, XGBoost

### Infrastructure
- **Hosting**: Replit (development), Render (production)
- **Database**: Neon PostgreSQL (cloud), Turso (edge)
- **Storage**: Replit Object Storage (GCS)
- **Monitoring**: Prometheus metrics
- **Audit**: JSONL append-only logs

## Dead Code Candidates

Based on quick analysis, potential dead code:
- ❓ `server/standalone-simple.ts` (duplicate of minimal-server?)
- ❓ `server/sqlite-init.ts.backup` (backup file)
- ❓ Multiple standalone server files (minimal, production, standalone)
- ❓ Unused test fixtures in `tests/` directory

**Recommendation**: Run `npx depcheck` and analyze import graphs to identify unused modules.

## Security Architecture

### Authentication Layers
1. **Admin Routes**: `ADMIN_TOKEN` verification
2. **Edge Devices**: HMAC SHA-256 validation
3. **Session Management**: Express sessions + PostgreSQL store
4. **RBAC**: Role-based access control (Technician, Manager, Admin)

### Multi-Tenant Isolation
- **Database Level**: `orgId` column on all tables
- **Repository Pattern**: Tenant-scoped queries enforced
- **API Level**: Session context extraction (`req.user.orgId`)
- **Governance**: Delta validation prevents cross-tenant tampering

### Rate Limiting
- **General API**: 100 req/15min per IP
- **Telemetry**: 1000 req/15min (high-volume)
- **Write Operations**: 50 req/15min (stricter)

## Performance Considerations

### Optimizations in Place
- ✅ LRU model caching (6 models max)
- ✅ Inference semaphore (2 concurrent max)
- ✅ Circuit breakers on ML models
- ✅ Time-bucketing for telemetry preprocessing
- ✅ Composite database indexes
- ✅ Materialized views for hot queries
- ✅ Connection pooling (Drizzle)

### Known Bottlenecks
- ⚠️ LSTM inference latency (p95 ~800ms)
- ⚠️ Large telemetry window queries
- ⚠️ Real-time WebSocket broadcasts

## Deployment Modes

1. **Cloud (Default)**: PostgreSQL + Replit/Render
2. **Edge/Vessel**: SQLite + Turso sync
3. **Desktop**: Electron wrapper + embedded SQLite
4. **Mobile**: Capacitor (iOS) + embedded server

---

**Next Steps**:
1. Run `npx depcheck` for unused dependencies
2. Generate full API documentation with OpenAPI/Swagger
3. Create dependency graph visualization with Madge
4. Profile critical endpoints for optimization opportunities
