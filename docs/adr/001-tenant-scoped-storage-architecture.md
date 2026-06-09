# ADR 001: Tenant-Scoped Storage Architecture

> **Superseded in part by [ADR 002](002-single-tenant-operating-model.md)
> (2026-06-09).** This ADR was never advanced past _Proposed_. ARUS ships as a
> single-tenant, multi-vessel system; the multi-tenant target described below is
> archived as aspirational, not current. Read ADR 002 first for the
> authoritative tenancy model.

**Status**: Proposed (superseded in part — see ADR 002)  
**Date**: 2025-10-27  
**Deciders**: Platform Engineering Team  
**Consulted**: Security Team, Backend Team  
**Informed**: All Development Teams

## Context and Problem Statement

ARUS is a multi-tenant marine predictive maintenance platform where strict data isolation between organizations is critical for security, compliance, and customer trust. Current storage implementation has several architectural issues:

### Current Issues

1. **Hard-coded Organization IDs**: Multiple endpoints use hard-coded default organization IDs (`default-org-id`), creating security vulnerabilities
2. **Inconsistent Tenant Enforcement**: Some storage methods accept optional `orgId` parameters, allowing accidental cross-tenant data access
3. **Mixed Responsibility**: Tenant validation happens at both middleware and storage layers, but enforcement is inconsistent
4. **Legacy Helper Functions**: `getOrgIdFromRequest()` scattered throughout codebase makes refactoring difficult
5. **Testing Gaps**: Insufficient multi-tenant isolation tests, making regressions easy to introduce

### Business Impact

- **Security Risk**: Potential data leakage between organizations
- **Compliance Violations**: GDPR, SOC 2 requirements for data isolation
- **Customer Trust**: Loss of confidence if tenant isolation is breached
- **Technical Debt**: Increasing maintenance burden and bug surface area

## Decision Drivers

- **Security**: Must guarantee 100% tenant isolation with defense-in-depth
- **Developer Experience**: Should be impossible to accidentally access cross-tenant data
- **Performance**: Minimal overhead for tenant filtering
- **Maintainability**: Clear patterns that scale to large teams
- **Migration Risk**: Must support gradual migration without breaking existing functionality

## Considered Options

### Option 1: Middleware-Only Enforcement

**Description**: Validate tenant access at middleware layer only, pass orgId through request context

**Pros**:

- Single point of enforcement
- Minimal storage layer changes
- Easy to implement

**Cons**:

- Relies on middleware being applied to all routes
- Storage layer doesn't validate tenant isolation
- Easy to bypass with direct storage calls
- No defense-in-depth

**Decision**: ❌ Rejected - Insufficient defense-in-depth

### Option 2: Storage-Only Enforcement

**Description**: Embed tenant context in all storage methods, remove middleware validation

**Pros**:

- Guaranteed isolation at data layer
- Cannot bypass tenant checks

**Cons**:

- Requires complete rewrite of storage layer
- No early validation (fails late in request)
- Poor user experience (generic errors)
- High migration risk

**Decision**: ❌ Rejected - Too risky for gradual migration

### Option 3: **Tenant-Scoped Repository Pattern (Recommended)**

**Description**: Hybrid approach with middleware enforcement + tenant-scoped storage repositories

**Pros**:

- Defense-in-depth (middleware + storage layers)
- Type-safe tenant context
- Gradual migration path
- Clear architectural patterns
- Impossible to forget tenant filtering

**Cons**:

- Requires refactoring existing storage interface
- More boilerplate code
- Learning curve for team

**Decision**: ✅ **SELECTED** - Best balance of security and maintainability

## Decision Outcome

We will implement a **Tenant-Scoped Repository Pattern** with the following architecture:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP Request                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Middleware: requireOrgId                                │
│  - Validates user authentication                         │
│  - Enforces user.orgId === x-org-id                      │
│  - Attaches orgId to request context                     │
│  - Rejects unauthorized requests early                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Route Handler                                           │
│  - Receives validated request                            │
│  - Creates tenant-scoped repository                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  TenantScopedRepository                                  │
│  - Immutable orgId in constructor                        │
│  - All queries automatically filtered by orgId           │
│  - Type-safe: Cannot create without orgId                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Database Layer (Drizzle ORM)                            │
│  - WHERE orgId = :orgId injected automatically           │
│  - No cross-tenant data leakage possible                 │
└─────────────────────────────────────────────────────────┘
```

### Implementation Pattern

#### 1. Tenant-Scoped Repository Interface

```typescript
/**
 * Base interface for all tenant-scoped repositories
 */
interface ITenantScopedRepository {
  readonly orgId: string; // Immutable organization ID
}

/**
 * Equipment repository with automatic tenant filtering
 */
class EquipmentRepository implements ITenantScopedRepository {
  readonly orgId: string;

  constructor(orgId: string) {
    if (!orgId || orgId === "") {
      throw new Error("EquipmentRepository requires valid orgId");
    }
    this.orgId = orgId;
  }

  /**
   * All queries automatically filtered by orgId
   */
  async getById(equipmentId: string): Promise<Equipment | null> {
    return db.query.equipment.findFirst({
      where: and(
        eq(equipment.id, equipmentId),
        eq(equipment.orgId, this.orgId) // Automatic tenant filter
      ),
    });
  }

  async list(): Promise<Equipment[]> {
    return db.query.equipment.findMany({
      where: eq(equipment.orgId, this.orgId), // Automatic tenant filter
    });
  }

  async create(data: InsertEquipment): Promise<Equipment> {
    // Enforce orgId from repository context
    const equipmentData = {
      ...data,
      orgId: this.orgId, // Override any provided orgId
    };

    const [created] = await db.insert(equipment).values(equipmentData).returning();

    return created;
  }
}
```

#### 2. Repository Factory

```typescript
/**
 * Factory for creating tenant-scoped repositories
 */
class RepositoryFactory {
  constructor(private readonly orgId: string) {}

  equipment(): EquipmentRepository {
    return new EquipmentRepository(this.orgId);
  }

  devices(): DeviceRepository {
    return new DeviceRepository(this.orgId);
  }

  telemetry(): TelemetryRepository {
    return new TelemetryRepository(this.orgId);
  }
}

/**
 * Helper to create repository factory from authenticated request
 */
function createRepositories(req: AuthenticatedRequest): RepositoryFactory {
  if (!req.user || !req.orgId) {
    throw new Error("Cannot create repositories without authenticated user");
  }
  return new RepositoryFactory(req.orgId);
}
```

#### 3. Route Handler Usage

```typescript
// BEFORE (Unsafe)
app.get("/api/equipment/:id", requireOrgId, async (req, res) => {
  const equipment = await storage.getEquipment(req.params.id);
  // ❌ No tenant filtering! Returns equipment from any org
  res.json(equipment);
});

// AFTER (Safe)
app.get("/api/equipment/:id", requireOrgId, async (req, res) => {
  const repos = createRepositories(req as AuthenticatedRequest);
  const equipment = await repos.equipment().getById(req.params.id);
  // ✅ Automatically filtered by req.orgId - cannot access other tenants
  res.json(equipment);
});
```

### Positive Consequences

✅ **Defense-in-Depth Security**

- Middleware validates early (user experience)
- Storage layer enforces isolation (data integrity)
- Impossible to bypass tenant filtering

✅ **Type Safety**

- TypeScript enforces orgId at compile time
- Cannot create repositories without tenant context
- Clear API contracts

✅ **Developer Experience**

- Pattern is obvious and hard to misuse
- Auto-complete guides correct usage
- Refactoring is IDE-assisted

✅ **Gradual Migration**

- Can migrate route-by-route
- Old and new patterns coexist
- Low risk of breaking changes

✅ **Testability**

- Easy to test multi-tenant scenarios
- Mock repositories per tenant
- Clear test boundaries

### Negative Consequences

⚠️ **Migration Effort**

- ~150+ routes need updating
- Storage interface requires refactoring
- Team training on new patterns

⚠️ **Boilerplate Increase**

- More lines of code per route
- Repository creation overhead
- Factory pattern adds indirection

⚠️ **Performance Overhead**

- Repository instantiation per request
- Additional function calls
- (Mitigated: Negligible compared to DB query time)

## Migration Strategy

### Phase 1: Foundation (Week 1-2)

**Goal**: Establish patterns without breaking existing functionality

1. ✅ Create base repository interfaces
2. ✅ Implement example repositories (Equipment, Devices)
3. ✅ Write migration guide and examples
4. ✅ Add multi-tenant integration tests
5. ✅ Deploy alongside existing storage layer

**Success Criteria**:

- New repository pattern available
- Zero production impact
- Documentation complete

### Phase 2: Pilot Migration (Week 3-4)

**Goal**: Migrate 10-15 high-risk endpoints

1. Audit endpoints using `getOrgIdFromRequest()` or hard-coded IDs
2. Prioritize security-critical endpoints:
   - `/api/equipment/*`
   - `/api/devices/*`
   - `/api/telemetry/*`
   - `/api/work-orders/*`
3. Migrate to tenant-scoped repositories
4. Add/update integration tests
5. Monitor error rates and performance

**Success Criteria**:

- 15+ endpoints migrated
- All tests passing
- No production incidents
- Performance within SLA

### Phase 3: Bulk Migration (Week 5-8)

**Goal**: Migrate remaining endpoints

1. Create tracking spreadsheet (endpoint → status)
2. Migrate in batches of 20-30 endpoints/week
3. Peer review all migrations
4. Continuous monitoring and rollback plan

**Success Criteria**:

- 90%+ endpoints migrated
- Security tests covering all patterns
- Legacy patterns documented for deprecation

### Phase 4: Cleanup (Week 9-10)

**Goal**: Remove legacy patterns and technical debt

1. Deprecate old storage interface methods
2. Remove `getOrgIdFromRequest()` helper
3. Update ESLint rules to prevent legacy patterns
4. Final security audit

**Success Criteria**:

- 100% tenant-scoped repositories
- Zero hard-coded organization IDs
- Security audit passed

## Testing Strategy

### Unit Tests

```typescript
describe("EquipmentRepository", () => {
  it("should filter equipment by orgId", async () => {
    const repo = new EquipmentRepository("org-1");
    const equipment = await repo.list();

    // All results must belong to org-1
    equipment.forEach((e) => {
      expect(e.orgId).toBe("org-1");
    });
  });

  it("should throw error when creating repository without orgId", () => {
    expect(() => new EquipmentRepository("")).toThrow();
  });
});
```

### Integration Tests

```typescript
describe("Multi-tenant Equipment API", () => {
  it("should prevent cross-tenant access", async () => {
    // Setup: Two organizations with equipment
    const org1 = createTestOrg();
    const org2 = createTestOrg();
    const equipment1 = createEquipment(org1.id);
    const equipment2 = createEquipment(org2.id);

    // Act: User from org1 tries to access org2 equipment
    const response = await request(app)
      .get(`/api/equipment/${equipment2.id}`)
      .set("x-org-id", org1.id)
      .set("Authorization", `Bearer ${org1Token}`)
      .expect(404); // Not found (filtered by tenant)

    // Assert: Cannot see cross-tenant data
    expect(response.body.error).toBe("Equipment not found");
  });
});
```

### Security Tests

```typescript
describe("Tenant Isolation Security", () => {
  it("should log and block cross-tenant access attempts", async () => {
    const consoleSpy = jest.spyOn(console, "warn");

    await request(app)
      .get("/api/equipment/other-org-equipment")
      .set("x-org-id", "org-2")
      .set("Authorization", "Bearer org-1-token")
      .expect(403);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[SECURITY] Cross-tenant access attempt")
    );
  });
});
```

## Rollback Plan

If critical issues are discovered during migration:

### Immediate Rollback (< 1 hour)

1. Revert specific endpoint migrations via Git
2. Deploy previous version
3. Monitor error rates return to baseline

### Gradual Rollback (< 1 day)

1. Feature flag to toggle repository pattern
2. Gradually shift traffic to legacy implementation
3. Investigate and fix issues
4. Re-enable repository pattern when resolved

### Nuclear Option (< 1 week)

1. Full rollback to pre-migration state
2. Comprehensive post-mortem
3. Revised migration strategy
4. Extended testing period

## Monitoring and Metrics

### Key Metrics to Track

**Security Metrics**:

- Cross-tenant access attempts blocked (should be 0)
- Failed tenant validation rate
- Unauthorized access logs

**Performance Metrics**:

- Repository instantiation time (< 1ms)
- Query execution time (unchanged from baseline)
- Memory usage per request (< 5% increase)

**Migration Progress**:

- % endpoints migrated
- % routes using legacy patterns
- Test coverage by domain

### Alerting Thresholds

| Metric                       | Threshold      | Action             |
| ---------------------------- | -------------- | ------------------ |
| Cross-tenant access attempts | > 0            | Page security team |
| Failed validations           | > 0.1%         | Investigate logs   |
| Query time increase          | > 20%          | Performance review |
| Memory per request           | > 10% increase | Memory profiling   |

## References

- **Security Incident**: 2025-10-26 - Hard-coded organization ID discovered during security audit
- **Related ADRs**: None (first ADR)
- **External References**:
  - [OWASP Multi-Tenancy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multitenant_Architecture_Cheat_Sheet.html)
  - [Repository Pattern - Martin Fowler](https://martinfowler.com/eaaCatalog/repository.html)

## Decision Log

| Date       | Decision                                  | Rationale                                                     |
| ---------- | ----------------------------------------- | ------------------------------------------------------------- |
| 2025-10-27 | Selected Tenant-Scoped Repository Pattern | Best balance of security, maintainability, and migration risk |
| 2025-10-27 | 10-week phased migration                  | Reduces risk, allows learning, enables rollback               |
| 2025-10-27 | Defense-in-depth (middleware + storage)   | Maximum security with good UX                                 |

---

**Next Review Date**: 2025-11-10 (after Phase 2 completion)  
**Owner**: Platform Engineering Lead  
**Approvers**: CTO, Security Lead
