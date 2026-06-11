# Tenant Isolation Security Audit

**Date**: October 27, 2025  
**Status**: Phase 0 - Discovery  
**Severity**: CRITICAL

## Executive Summary

Comprehensive audit of multi-tenant security issues in ARUS platform. Identified **476+ instances** requiring remediation across 17 files.

### Risk Summary

| Issue Type                    | Count         | Severity    | Files Affected |
| ----------------------------- | ------------- | ----------- | -------------- |
| Hard-coded `default-org-id`   | 17 files      | 🔴 CRITICAL | Core services  |
| `getOrgIdFromRequest()` calls | 145 uses      | 🟠 HIGH     | Route handlers |
| Optional `orgId` parameters   | 314 instances | 🟠 HIGH     | Storage layer  |
| **TOTAL REMEDIATION NEEDED**  | **476+**      | 🔴 CRITICAL | -              |

## Critical Findings

### 1. Hard-Coded Organization IDs (17 files)

Files with `default-org-id` hard-coding:

```
server/index.ts
server/storage.ts
server/routes.ts
server/insights-scheduler.ts
server/services/config-manager.ts
server/vibration-analysis.ts
server/beast-mode-config.ts
server/tools/edge-diagnose-cli.ts
server/insights-engine.ts
server/enhanced-llm.ts
server/sqlite-init.ts
server/optimization-cleanup-scheduler.ts
server/security.ts
server/mqtt-ingestion-service.ts
server/scripts/seed-ml-data.ts
server/scripts/debug-prediction.ts
server/ml-training-data.ts
```

**Risk**: Direct tenant bypass - services can access any organization's data by using hard-coded default.

**Impact**:

- GDPR violation potential
- SOC 2 compliance failure
- Cross-tenant data leakage

### 2. Helper Function Proliferation (145 uses)

`getOrgIdFromRequest()` usage:

- `server/routes.ts`: 138 instances
- `server/domains/vessels/routes.ts`: 7 instances

**Risk**: Scattered tenant validation logic, inconsistent enforcement, easy to forget.

**Pattern Example**:

```typescript
// CURRENT (UNSAFE):
const orgId = getOrgIdFromRequest(req); // Returns default if missing
const equipment = await storage.getEquipment(orgId);

// DESIRED (SAFE):
const repository = TenantRepositoryFactory.create(req.orgId); // Already validated
const equipment = await repository.getEquipment(); // Auto-scoped
```

### 3. Optional Organization Parameters (314 instances)

Storage interface has 314 methods with optional `orgId?` parameters.

**Risk**: Methods can be called without org context, leading to unscoped queries.

**Example Issues**:

```typescript
// UNSAFE: Optional orgId allows bypass
interface IStorage {
  getEquipment(orgId?: string): Promise<Equipment[]>; // ❌ Can be called without orgId
  getWorkOrders(orgId?: string): Promise<WorkOrder[]>; // ❌ Dangerous
}

// SAFE: Mandatory tenant context
class TenantScopedRepository {
  constructor(private readonly orgId: string) {} // Immutable

  async getEquipment(): Promise<Equipment[]> {
    // orgId ALWAYS available and enforced
    return db.select().from(equipment).where(eq(equipment.orgId, this.orgId));
  }
}
```

## Migration Inventory

### Phase 1: High-Risk Domains (Priority 1)

These domains handle sensitive customer data and require immediate remediation:

1. **Equipment Domain**
   - Files: `server/routes.ts` (equipment endpoints)
   - Storage methods: ~50 methods
   - Risk: Equipment data leakage across organizations

2. **Work Orders & Maintenance**
   - Files: `server/routes.ts` (work order endpoints)
   - Storage methods: ~40 methods
   - Risk: Maintenance schedules visible across tenants

3. **Telemetry & Sensor Data**
   - Files: `server/routes.ts` (telemetry endpoints)
   - Storage methods: ~30 methods
   - Risk: Real-time sensor data exposure

### Phase 2: Medium-Risk Domains (Priority 2)

4. **Crew Management**
   - Files: `server/routes.ts` (crew endpoints)
   - Storage methods: ~25 methods
   - Risk: Employee data privacy violations

5. **Inventory & Parts**
   - Files: `server/routes.ts` (inventory endpoints)
   - Storage methods: ~30 methods
   - Risk: Proprietary parts catalogs exposed

6. **Analytics & Reports**
   - Files: `server/routes.ts` (analytics endpoints), `server/insights-engine.ts`
   - Storage methods: ~40 methods
   - Risk: Business intelligence leakage

### Phase 3: Lower-Risk Domains (Priority 3)

7. **Configuration & Settings**
   - Files: `server/routes.ts` (settings endpoints)
   - Storage methods: ~20 methods
   - Risk: System configuration exposure

8. **Background Jobs**
   - Files: `server/insights-scheduler.ts`, `server/optimization-cleanup-scheduler.ts`
   - Risk: Scheduled jobs processing wrong tenant data

## Implementation Strategy

### Phase 0: Readiness (Current)

- [x] Complete security audit
- [ ] Design `TenantScopedRepository` base class
- [ ] Create repository factory pattern
- [ ] Add feature flags for gradual rollout
- [ ] Set up metrics and monitoring

### Phase 1: Foundation (Week 1-2)

- [ ] Implement `TenantScopedRepository` base class
- [ ] Create `TenantRepositoryFactory` with org context injection
- [ ] Strengthen `validateOrgIdHeader` middleware
- [ ] Add contract tests for tenant isolation
- [ ] Establish rollback procedures

### Phase 2: Domain Migration (Week 3-6)

- [ ] Migrate Equipment domain (dual-write pattern)
- [ ] Migrate Work Orders domain
- [ ] Migrate Telemetry domain
- [ ] Migrate remaining high-risk domains
- [ ] Continuous validation and monitoring

### Phase 3: Cleanup & Hardening (Week 7-8)

- [ ] Remove all hard-coded `default-org-id`
- [ ] Eliminate `getOrgIdFromRequest()` helper
- [ ] Make all storage orgId parameters mandatory
- [ ] Add static analysis checks to CI
- [ ] Final security penetration testing

## Success Criteria

### Phase 1 Success

- ✅ Zero hard-coded org IDs in new code
- ✅ Repository factory covers 3+ domains
- ✅ 100% contract test coverage for migrated domains
- ✅ Rollback tested and documented

### Phase 2 Success

- ✅ 80%+ of high-risk domains migrated
- ✅ Zero cross-tenant data leakage incidents
- ✅ Performance metrics within 5% baseline
- ✅ All feature flags tested

### Phase 3 Success

- ✅ 100% tenant-scoped repository adoption
- ✅ Zero optional orgId parameters
- ✅ CI blocks tenant isolation violations
- ✅ Security audit passed

## Risk Mitigation

### Backward Compatibility

- Use **dual-write adapters** during migration
- Feature flags for gradual rollout
- Shadow mode for testing before cutover

### Performance Impact

- Benchmark before/after migration
- Monitor query performance
- Cache org context where appropriate

### Production Safety

- Canary deployments per domain
- Automated rollback triggers
- Real-time monitoring dashboards

## Next Actions

1. **Immediate** (This Week):
   - Design TenantScopedRepository architecture
   - Create repository factory prototype
   - Set up feature flags

2. **Short Term** (Week 2):
   - Implement base classes
   - Migrate Equipment domain (pilot)
   - Add comprehensive tests

3. **Medium Term** (Week 3-6):
   - Systematic domain migrations
   - Continuous security validation
   - Performance optimization

---

**Document Owner**: Security & Architecture Team  
**Review Cadence**: Weekly during migration  
**Last Updated**: 2025-10-27
