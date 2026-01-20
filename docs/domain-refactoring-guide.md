# Domain Refactoring Guide

**Status**: Active Refactoring in Progress (Oct 2025)  
**Goal**: Decompose monolithic `routes.ts` (14,844 lines) and `storage.ts` (15,004 lines) into domain-driven architecture  
**Pattern**: Three-layer architecture per domain (Routes → Service → Repository)

## Table of Contents
1. [Overview](#overview)
2. [Architecture Pattern](#architecture-pattern)
3. [Completed Domains](#completed-domains)
4. [Step-by-Step Refactoring Process](#step-by-step-refactoring-process)
5. [Domain Priority List](#domain-priority-list)
6. [Code Examples](#code-examples)
7. [Testing Checklist](#testing-checklist)
8. [Common Pitfalls](#common-pitfalls)

---

## Overview

### Problem
The current codebase has grown to production-scale functionality but suffers from architectural debt:
- **499 API endpoints** in a single file
- **No domain boundaries** - everything mixed together
- **Tight coupling** between HTTP, business logic, and data access
- **Difficult to test** individual components
- **Hard to onboard** new developers

### Solution
Incremental refactoring using domain-driven design:
1. Extract one domain at a time (starting with work-orders as pilot)
2. Use three-layer architecture for separation of concerns
3. Preserve all existing API contracts (no breaking changes)
4. Test thoroughly after each domain extraction
5. Use completed domains as templates for next ones

### Success Criteria
- ✅ No breaking changes to existing APIs
- ✅ All E2E tests pass
- ✅ Clear separation between layers
- ✅ Reduced coupling and improved testability
- ✅ Documented patterns for team consistency

---

## Architecture Pattern

### Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│         HTTP Layer (Routes)             │
│  • Request validation (Zod schemas)     │
│  • Rate limiting                        │
│  • HTTP status codes & responses        │
│  • Delegates to Service layer           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Business Logic (Service)          │
│  • Domain rules & workflows             │
│  • Event emission (WebSocket, MQTT)     │
│  • Cross-cutting concerns               │
│  • Orchestrates Repository calls        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Data Access (Repository)          │
│  • Storage interface adapter            │
│  • Direct database operations           │
│  • No business logic                    │
│  • Returns typed data structures        │
└─────────────────────────────────────────┘
```

### Layer Responsibilities

#### Routes Layer (HTTP)
**Responsibilities:**
- Validate request parameters using Zod schemas
- Apply rate limiting middleware
- Extract request data (params, query, body)
- Call service layer methods
- Map service results to HTTP responses
- Handle HTTP-specific errors (400, 404, 500)

**What NOT to do:**
- ❌ Direct database/storage access
- ❌ Business logic or calculations
- ❌ Event emission
- ❌ Complex data transformations

#### Service Layer (Business Logic)
**Responsibilities:**
- Implement domain-specific business rules
- Orchestrate multiple repository calls
- Emit events (WebSocket broadcasts, MQTT sync)
- Coordinate cross-cutting concerns (cost tracking, notifications)
- Handle domain-specific validation
- Manage transactions across operations

**What NOT to do:**
- ❌ HTTP status codes or response formatting
- ❌ Direct database queries
- ❌ Request/response parsing

#### Repository Layer (Data Access)
**Responsibilities:**
- Adapt storage interface to domain needs
- Execute database operations
- Return typed data structures
- Handle database-specific errors

**What NOT to do:**
- ❌ Business logic
- ❌ Event emission
- ❌ HTTP concerns
- ❌ Data transformations beyond mapping

---

## Completed Domains

### ✅ Work Orders (Pilot Domain)
**Files:**
- `server/domains/work-orders/routes.ts` - HTTP endpoints
- `server/domains/work-orders/service.ts` - Business logic
- `server/domains/work-orders/repository.ts` - Data access
- `server/domains/work-orders/index.ts` - Public exports

**Endpoints:** 8 endpoints
- `GET /api/work-orders` - List work orders
- `POST /api/work-orders` - Create work order
- `GET /api/work-orders/:id` - Get single work order
- `PATCH /api/work-orders/:id` - Update work order
- `DELETE /api/work-orders/:id` - Delete work order
- `POST /api/work-orders/:id/complete` - Complete work order
- `GET /api/work-orders/:id/completion` - Get completion details
- `GET /api/work-orders/:id/suggestions` - Get intelligent suggestions

**Status:** ✅ Completed, tested, architect-reviewed
**Notes:** Use as canonical reference for other domains

---

## Step-by-Step Refactoring Process

### Phase 1: Identify Domain Scope

1. **Search for endpoints** in `server/routes.ts`:
   ```bash
   # Example: Find all equipment endpoints
   grep -n "app\.(get|post|patch|delete).*equipment" server/routes.ts
   ```

2. **Identify related storage methods** in `server/storage.ts`:
   ```bash
   # Find equipment-related methods
   grep -n "async.*equipment" server/storage.ts
   ```

3. **Document dependencies**:
   - What other domains does this depend on?
   - What shared utilities are used?
   - What schemas from `shared/schema.ts` are involved?

### Phase 2: Create Domain Structure

1. **Create domain directory:**
   ```bash
   mkdir -p server/domains/[domain-name]
   ```

2. **Create three files:**
   - `routes.ts` - HTTP layer
   - `service.ts` - Business logic
   - `repository.ts` - Data access
   - `index.ts` - Public exports

### Phase 3: Extract Repository Layer

**Template:**
```typescript
// server/domains/[domain-name]/repository.ts
import type { /* types from @shared/schema */ } from "@shared/schema";
import { storage } from "../../storage";

/**
 * [Domain Name] Repository
 * Handles all data access for [domain] domain
 */
export class [Domain]Repository {
  /**
   * Get all [entities]
   */
  async findAll(organizationId?: string): Promise<Entity[]> {
    return storage.get[Entities](organizationId);
  }

  /**
   * Get single [entity] by ID
   */
  async findById(id: string, orgId: string): Promise<Entity | undefined> {
    return storage.get[Entity]ById(id, orgId);
  }

  /**
   * Create new [entity]
   */
  async create(data: InsertEntity): Promise<Entity> {
    return storage.create[Entity](data);
  }

  /**
   * Update [entity]
   */
  async update(id: string, data: Partial<InsertEntity>): Promise<Entity> {
    return storage.update[Entity](id, data);
  }

  /**
   * Delete [entity]
   */
  async delete(id: string): Promise<void> {
    return storage.delete[Entity](id);
  }
}

// Export singleton instance
export const [domain]Repository = new [Domain]Repository();
```

**Key Points:**
- Import storage from `../../storage`
- Use TypeScript types from `@shared/schema`
- Define as CLASS, export singleton instance
- Keep methods thin - just call storage
- Return typed results
- No business logic here

### Phase 4: Extract Service Layer

**Template:**
```typescript
// server/domains/[domain-name]/service.ts
import type { /* types */ } from "@shared/schema";
import { [domain]Repository } from "./repository";
import { recordAndPublish } from "../../sync-events";
import { mqttReliableSync } from "../../mqtt-reliable-sync";

/**
 * [Domain Name] Service
 * Contains all business logic for [domain] domain
 */
export class [Domain]Service {
  /**
   * Get all [entities] with business logic applied
   */
  async list[Entities](organizationId?: string): Promise<Entity[]> {
    const entities = await [domain]Repository.findAll(organizationId);
    
    // Apply business logic, calculations, etc.
    
    return entities;
  }

  /**
   * Create [entity] with side effects
   */
  async create[Entity](
    data: InsertEntity,
    userId?: string
  ): Promise<Entity> {
    // Business validation
    // ...

    // Create entity
    const entity = await [domain]Repository.create(data);

    // Publish events
    await recordAndPublish('[entity]', entity.id, 'create', entity, userId);
    
    mqttReliableSync.publish[Entity]Change('create', entity).catch(err => {
      console.error('[Domain Service] Failed to publish to MQTT:', err);
    });

    return entity;
  }
}

// Export singleton instance
export const [domain]Service = new [Domain]Service();
```

**Key Points:**
- Import repository, not storage directly
- Define as CLASS, export singleton instance
- Implement business rules and workflows
- Emit events via recordAndPublish and mqttReliableSync
- Coordinate multiple operations
- Keep HTTP concerns out

### Phase 5: Extract Routes Layer

**Template:**
```typescript
// server/domains/[domain-name]/routes.ts
import type { Express } from "express";
import { [domain]Service } from "./service";
import { insert[Entity]Schema } from "@shared/schema";
import { z } from "zod";

/**
 * Register [Domain] routes
 */
export function register[Domain]Routes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimiters;

  // GET all entities
  app.get("/api/[entities]", generalApiRateLimit, async (req, res) => {
    try {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const entities = await [domain]Service.list[Entities](orgId);
      res.json(entities);
    } catch (error) {
      console.error("Failed to fetch [entities]:", error);
      res.status(500).json({ 
        error: "Failed to fetch [entities]",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST create entity
  app.post("/api/[entities]", writeOperationRateLimit, async (req, res) => {
    try {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      
      // Validate request body
      const validationResult = insert[Entity]Schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid [entity] data",
          details: validationResult.error.errors
        });
      }

      const entity = await [domain]Service.create[Entity](
        validationResult.data
      );
      
      res.status(201).json(entity);
    } catch (error) {
      console.error("Failed to create [entity]:", error);
      res.status(500).json({ 
        error: "Failed to create [entity]",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
```

**Key Points:**
- Import service, not repository
- Use Zod schemas for validation
- Apply rate limiters
- Extract organization ID from headers
- Return proper HTTP status codes
- Delegate to service layer

### Phase 6: Create Index File

```typescript
// server/domains/[domain-name]/index.ts
/**
 * [Domain Name] Domain
 * Exports all [domain] domain functionality
 */

export { register[Domain]Routes } from './routes';
export { [domain]Service } from './service';
export { [domain]Repository } from './repository';
```

### Phase 7: Register Domain Router

In `server/routes.ts`, within the `registerRoutes` function, add after the sensor routes (around line 786):

```typescript
// Mount sensor routes for autoclassify, normalization, and templates
mountSensorRoutes(app);

// Register domain-specific routers (Architectural Refactoring - Oct 2025)
const { register[Domain]Routes } = await import('./domains/[domain-name]/index.js');
register[Domain]Routes(app, { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit });

// Observability endpoints (no rate limiting)
app.get('/api/healthz', healthzEndpoint);
```

**Important**: Add the import and registration **inside** the `registerRoutes` async function, not at the top-level module scope.

### Phase 8: Test Thoroughly

1. **Restart application** and check for errors
2. **Run E2E tests** for the domain
3. **Manual testing** of all endpoints
4. **Call architect** for code review with git diff

---

## Domain Priority List

Refactor domains in this order to minimize dependencies and risk:

### High Priority (Core Entities)
1. ✅ **Work Orders** - Completed (pilot domain)
2. **Equipment** - ~15 endpoints, critical domain
3. **Vessels** - ~12 endpoints, core entity
4. **Devices** - ~10 endpoints, telemetry foundation

### Medium Priority (Supporting Features)
5. **Maintenance** - ~18 endpoints, depends on work orders
6. **Inventory/Parts** - ~25 endpoints, depends on work orders
7. **Crew Management** - ~20 endpoints, independent domain
8. **Alerts** - ~12 endpoints, depends on equipment

### Lower Priority (Advanced Features)
9. **Telemetry** - ~30 endpoints, complex dependencies
10. **ML/Predictions** - ~15 endpoints, depends on telemetry
11. **Reports/Insights** - ~20 endpoints, depends on ML
12. **Admin** - ~25 endpoints, security-sensitive

### Specialized Domains
13. **DTC (Diagnostic Trouble Codes)** - ~8 endpoints
14. **Sync/Offline** - ~10 endpoints
15. **Analytics** - ~15 endpoints
16. **Operating Conditions** - ~12 endpoints

---

## Code Examples

### Example 1: Simple CRUD Domain

**Repository:**
```typescript
export class EquipmentRepository {
  async findAll(orgId?: string) {
    return storage.getEquipment(orgId);
  }
  
  async findById(id: string, orgId: string) {
    return storage.getEquipmentById(orgId, id);
  }
  
  async create(data: InsertEquipment) {
    return storage.createEquipment(data);
  }
}

export const equipmentRepository = new EquipmentRepository();
```

**Service:**
```typescript
export class EquipmentService {
  async listEquipment(orgId?: string) {
    return equipmentRepository.findAll(orgId);
  }
  
  async createEquipment(data: InsertEquipment, userId?: string) {
    const equipment = await equipmentRepository.create(data);
    
    // Publish events
    await recordAndPublish('equipment', equipment.id, 'create', equipment, userId);
    mqttReliableSync.publishEquipmentChange('create', equipment).catch(console.error);
    
    return equipment;
  }
}

export const equipmentService = new EquipmentService();
```

**Routes:**
```typescript
export function registerEquipmentRoutes(app: Express, rateLimiters: any) {
  app.get("/api/equipment", rateLimiters.generalApiRateLimit, async (req, res) => {
    try {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const equipment = await equipmentService.listEquipment(orgId);
      res.json(equipment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch equipment" });
    }
  });
}
```

### Example 2: Complex Domain with Side Effects

See `server/domains/work-orders/` for complete example showing:
- Multi-step workflows
- Event emission (WebSocket + MQTT)
- Cross-domain operations (cost tracking, inventory)
- Error handling with `safeDbOperation`
- Complex business logic (intelligent suggestions)

---

## Testing Checklist

After refactoring each domain:

### ✅ Unit Testing
- [ ] Repository methods return correct data types
- [ ] Service methods apply business logic correctly
- [ ] Error handling works as expected

### ✅ Integration Testing
- [ ] All endpoints return correct status codes
- [ ] Request validation works (400 for invalid data)
- [ ] Authorization/organization scoping works
- [ ] Rate limiting is applied correctly

### ✅ E2E Testing
- [ ] Create Playwright test covering main flows
- [ ] Test happy path (create → read → update → delete)
- [ ] Test error cases (invalid data, missing resources)
- [ ] Verify UI integration works

### ✅ Regression Testing
- [ ] Existing tests still pass
- [ ] No breaking changes to API contracts
- [ ] WebSocket events still broadcast
- [ ] MQTT sync still works

### ✅ Architect Review
- [ ] Call `architect` tool with git diff
- [ ] Address any critical findings
- [ ] Document any deviations from pattern

---

## Common Pitfalls

### ❌ Pitfall 1: Mixing Concerns
**Problem:**
```typescript
// ❌ BAD: Business logic in routes
app.post("/api/work-orders", async (req, res) => {
  const workOrder = await storage.createWorkOrder(req.body);
  
  // This should be in service layer!
  if (wsServer) {
    wsServer.broadcast({ type: 'work_order_created', data: workOrder });
  }
  
  res.json(workOrder);
});
```

**Solution:**
```typescript
// ✅ GOOD: Delegate to service
app.post("/api/work-orders", async (req, res) => {
  const workOrder = await workOrderService.create(
    organizationId, 
    req.body, 
    req.app.locals.wsServer
  );
  res.json(workOrder);
});

// Service handles side effects
export const workOrderService = {
  async create(orgId, data, wsServer) {
    const workOrder = await workOrderRepository.create(orgId, data);
    wsServer?.broadcast({ type: 'work_order_created', data: workOrder });
    return workOrder;
  }
};
```

### ❌ Pitfall 2: Repository Accessing Multiple Domains
**Problem:**
```typescript
// ❌ BAD: Repository knows about other domains
export class WorkOrderRepository {
  async create(data: InsertWorkOrder) {
    const workOrder = await storage.createWorkOrder(data);
    const equipment = await storage.getEquipmentById(data.equipmentId);
    // Repository should NOT access equipment!
    return workOrder;
  }
}
```

**Solution:**
```typescript
// ✅ GOOD: Service coordinates multiple repositories
export class WorkOrderService {
  async createWorkOrder(data: InsertWorkOrder) {
    // Service coordinates both repositories
    const equipment = await equipmentRepository.findById(data.equipmentId, data.orgId);
    if (!equipment) throw new Error("Equipment not found");
    
    return workOrderRepository.create(data);
  }
}
```

### ❌ Pitfall 3: Incomplete Validation
**Problem:**
```typescript
// ❌ BAD: No validation
app.post("/api/work-orders", async (req, res) => {
  const workOrder = await workOrderService.createWorkOrder(req.body);
  res.json(workOrder);
});
```

**Solution:**
```typescript
// ✅ GOOD: Validate before service call
app.post("/api/work-orders", async (req, res) => {
  const validationResult = insertWorkOrderSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: "Invalid data",
      details: validationResult.error.errors
    });
  }
  
  const workOrder = await workOrderService.createWorkOrder(validationResult.data);
  res.json(workOrder);
});
```

### ❌ Pitfall 4: Breaking API Contracts
**Problem:**
```typescript
// ❌ BAD: Changed response structure
app.get("/api/work-orders", async (req, res) => {
  const workOrders = await workOrderService.getAll(organizationId);
  res.json({ data: workOrders }); // Frontend expects array, not object!
});
```

**Solution:**
```typescript
// ✅ GOOD: Preserve existing contract
app.get("/api/work-orders", async (req, res) => {
  const workOrders = await workOrderService.getAll(organizationId);
  res.json(workOrders); // Returns array as before
});
```

### ❌ Pitfall 5: Forgetting Rate Limiters
**Problem:**
```typescript
// ❌ BAD: No rate limiting
export function registerWorkOrderRoutes(app: Express) {
  app.post("/api/work-orders", async (req, res) => {
    // ...
  });
}
```

**Solution:**
```typescript
// ✅ GOOD: Apply appropriate rate limiters
export function registerWorkOrderRoutes(app: Express, rateLimiters) {
  app.post("/api/work-orders", rateLimiters.writeOperationRateLimit, async (req, res) => {
    // ...
  });
}
```

---

## Conventions & Best Practices

### Naming Conventions
- **Domains**: Use singular form (e.g., `work-order`, not `work-orders`)
- **Files**: Use kebab-case (e.g., `work-orders/routes.ts`)
- **Exports**: Use camelCase (e.g., `workOrderService`, `workOrderRepository`)
- **Functions**: Use descriptive names (e.g., `registerWorkOrderRoutes`)

### File Organization
```
server/domains/
├── work-orders/
│   ├── routes.ts       # HTTP layer
│   ├── service.ts      # Business logic
│   ├── repository.ts   # Data access
│   └── index.ts        # Public exports
├── equipment/
│   ├── routes.ts
│   ├── service.ts
│   ├── repository.ts
│   └── index.ts
└── ...
```

### Import Patterns
```typescript
// Routes imports
import { [domain]Service } from "./service";
import { insert[Entity]Schema } from "@shared/schema";

// Service imports  
import { [domain]Repository } from "./repository";
import type { Entity, InsertEntity } from "@shared/schema";

// Repository imports
import { storage } from "../../storage";
import type { Entity, InsertEntity } from "@shared/schema";
```

### Error Handling
- **Routes**: Return HTTP-appropriate errors (400, 404, 500)
- **Service**: Throw descriptive errors, let routes handle HTTP mapping
- **Repository**: Let database errors bubble up, wrap if needed

### Documentation
- Add JSDoc comments to public methods
- Document non-obvious business rules
- Note dependencies and side effects
- Keep comments up-to-date

---

## Next Steps

1. **Equipment Domain** - Next refactoring target
2. **Vessels Domain** - After equipment
3. **Shared Infrastructure** - Extract common middleware
4. **Documentation** - Update API docs with new structure
5. **Team Training** - Onboard team on new patterns

---

## Questions & Support

For questions about refactoring:
1. Review the work-orders domain as reference
2. Check this guide for patterns
3. Run architect review early for guidance
4. Test incrementally to catch issues early

**Remember**: The goal is incremental improvement, not perfection. Each domain refactored makes the codebase better!
