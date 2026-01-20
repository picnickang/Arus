# ARUS Architecture Documentation

**Last Updated:** 2026-01-05

## Overview

ARUS (Advanced Remote Unified Systems) is a marine predictive maintenance and scheduling platform built as a DDD modular monolith with hexagonal architecture patterns.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  React 18 + TypeScript + Vite + TanStack Query + shadcn/ui      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express.js Backend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Routes    │  │ Middleware  │  │     Domain Modules      │  │
│  │ (Thin API)  │  │ (Auth/RBAC) │  │   (42 DDD Domains)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                 │
│  ┌───────────────────────┐    ┌───────────────────────────────┐ │
│  │ PostgreSQL (Cloud)    │    │ SQLite (Turso - Offline)      │ │
│  │ Drizzle ORM           │    │ Dual-mode schema              │ │
│  └───────────────────────┘    └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # UI components (shadcn/ui)
│   │   ├── pages/             # Route pages
│   │   ├── hooks/             # Custom React hooks
│   │   └── lib/               # Utilities (queryClient, etc.)
│
├── server/                    # Express.js backend
│   ├── domains/               # DDD domain modules (42 domains)
│   │   ├── work-orders/       # Example domain
│   │   │   ├── domain/        # Business logic (entities, value objects)
│   │   │   ├── application/   # Use cases, services
│   │   │   ├── infrastructure/# Adapters (repositories)
│   │   │   └── interfaces/    # HTTP routes
│   │   └── ...
│   ├── lib/                   # Shared utilities
│   │   ├── api-helpers.ts     # Pagination, validation, responses
│   │   └── route-utils.ts     # Error handling, sendNotFound, etc.
│   ├── middleware/            # Express middleware
│   ├── storage/               # Storage layer (modular repositories)
│   └── bootstrap/             # App initialization
│
├── shared/                    # Shared code (frontend + backend)
│   ├── schema/                # Modular Drizzle schema (35 files)
│   ├── sqlite-schema/         # SQLite-specific schema
│   └── schema.ts              # Schema aggregator
│
├── tests/                     # Test suites
│   ├── unit/                  # Unit tests (Jest + @swc/jest)
│   └── integration/           # Integration test templates
│
└── docs/                      # Documentation
    └── dedup-report.md        # Code quality analysis
```

---

## Domain Modules (DDD)

### Hexagonal Architecture Pattern

Each domain follows hexagonal (ports & adapters) architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                        Domain                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Domain Layer (Pure Logic)              │    │
│  │   Entities, Value Objects, Domain Events           │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Application Layer (Use Cases)            │    │
│  │   Services, Orchestration, DI Composition          │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────┐   ┌────────────────────────────────┐    │
│  │  Ports (Interfaces)  │ ─ ─ ▶│   Adapters (Implementations) │    │
│  │  IWorkOrderRepo │       │   DrizzleWorkOrderRepo    │    │
│  └────────────────┘       └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Domain List (42 Modules)

| Domain | Description |
|--------|-------------|
| `work-orders` | Work order lifecycle management |
| `crew-extensions` | Crew scheduling (SmartPAL-style) |
| `inventory-optimization` | Inventory optimization algorithms |
| `maintenance` | Maintenance schedules and records |
| `telemetry` | Sensor data ingestion and processing |
| `compliance` | Regulatory compliance (STCW, CII) |
| `ml-analytics` | Machine learning predictions |
| `knowledge-base` | RAG document management |
| ... | (35 more domains) |

---

## API Design Patterns

### Standardized Helpers (`server/lib/api-helpers.ts`)

All API routes use shared helpers for consistency:

```typescript
import { 
  parsePagination,        // Strict pagination validation
  paginatedResponse,      // Standard pagination format
  validateBody,           // Zod schema validation
  sendValidationError,    // 400 with Zod errors
  sendBadRequest,         // 400 with message
  sendConflict,           // 409 conflict response
  parseDateRange          // Date filter extraction
} from "../lib/api-helpers";
```

### Pagination Pattern

```typescript
// Strict validation (returns 400 on invalid input)
const result = parsePagination(req.query as Record<string, unknown>);
if (!result.success) {
  return sendValidationError(res, result.error, "Invalid pagination");
}
const { page, limit, offset } = result.params;

// Response format
res.json(paginatedResponse(items, { page, limit, offset }, total));
// { data: [...], pagination: { page, limit, total, hasMore } }
```

### Validation Pattern

```typescript
// Route handler - validateBody takes the full Request object
const body = validateBody(req, insertWorkOrderSchema);
if (!body.success) {
  return sendValidationError(res, body.error);
}
const workOrder = await service.create(body.data);
```

---

## Database Architecture

### Dual-Mode Schema (PostgreSQL + SQLite)

The system supports both cloud and offline operation:

- **Cloud Mode**: PostgreSQL (Neon) with full features
- **Offline Mode**: SQLite (Turso) for vessel-side operation

Schema is modularized into 35 domain-specific files:

```
shared/schema/
├── base.ts          # Core tables (orgs, users)
├── work-orders.ts   # Work order tables
├── crew.ts          # Crew management
├── telemetry.ts     # Sensor readings
└── ...              # 31 more domain files
```

### Multi-Tenant Isolation

All tables include `org_id` for tenant isolation:

```typescript
// Table definition
export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey(),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  // ...
});

// Query pattern (always filter by orgId)
const orders = await db.select()
  .from(workOrders)
  .where(eq(workOrders.orgId, orgId));
```

---

## Testing Strategy

### Unit Tests (Jest + @swc/jest)

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
```

Test location: `tests/unit/`

Key test files:
- `api-helpers.test.ts` - 23 tests for pagination, validation, UUID parsing

### Integration Tests

Templates available in `tests/integration/` for:
- Work orders API
- Crew scheduling
- Telemetry ingestion
- Compliance exports
- RAG conversations

---

## Code Quality

### Recent Improvements (2026-01-05)

1. **Dead Code Removal**: 1,068 lines removed
   - `server/auto-fix/` (unused service)
   - Legacy features

2. **API Helpers Pattern**: Standardized across domains
   - work-orders (4 files)
   - crew-extensions (2 files)
   - inventory-optimization (1 file)

3. **Testing Infrastructure**: Jest configured with SWC

### Duplication Analysis

| Metric | Value |
|--------|-------|
| Total Lines | ~217,000 |
| Duplicate % | 2.07% |
| Domain Modules | 42 |

See `docs/dedup-report.md` for detailed analysis.

---

## Key Libraries

### Frontend
- **React 18** - UI framework
- **TanStack Query v5** - Data fetching
- **Wouter** - Routing
- **shadcn/ui** - Component library
- **Tailwind CSS** - Styling

### Backend
- **Express.js** - HTTP server
- **Drizzle ORM** - Database access
- **Zod** - Schema validation
- **pg-boss** - Job queue

### ML/AI
- **TensorFlow.js** - LSTM models
- **OpenAI** - Report generation
- **@xenova/transformers** - Local embeddings

---

## Development Workflow

### Starting the Application

```bash
npm run dev                 # Start dev server (port 5000)
```

### Database Operations

```bash
npm run db:push             # Sync schema to database
npm run db:push --force     # Force sync (safe)
```

### Code Quality

```bash
npm test                    # Run tests
npm run lint                # ESLint
npx knip                    # Dead code detection
npx jscpd                   # Duplication analysis
```

---

## Security

### Authentication
- HMAC for edge devices
- Session-based for web users
- RBAC with role permissions

### Multi-Tenant
- `org_id` isolation on all queries
- Tenant-scoped repository pattern
- Audit logging for admin actions

### API Security
- Rate limiting (express-rate-limit)
- Helmet CSP headers
- Input validation (Zod)

---

## Deployment

### Targets
- **Cloud**: Replit deployment (autoscale)
- **Desktop**: Tauri v2
- **Mobile**: Capacitor (iOS/iPadOS)

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Session encryption
- `OPENAI_API_KEY` - AI features (optional)

---

## Contributing

1. Follow existing patterns (see domain examples)
2. Use `api-helpers.ts` for route handlers
3. Add tests for new functionality
4. Update documentation as needed
