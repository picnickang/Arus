# Phase 2C: Sensor & Parts Domain Migration Plan

## Overview

This document outlines the migration plan for sensor configuration and parts-related endpoints to use tenant-scoped repositories, following the successful completion of Phase 2B equipment CRUD migration.

## Status

- **Phase 2B Equipment CRUD**: ✅ Complete (architect-approved)
- **Phase 2C Sensor/Parts**: 📋 Documented for future work

## Available Repositories

### 1. SensorConfigurationRepository

**Location**: `server/infrastructure/TenantScopedRepository.ts`

**Methods**:

- `getAll(filters?: { equipmentId?: string; sensorType?: string })` - Get all sensor configurations with optional filtering
- `getById(id: string)` - Get single sensor configuration
- `getByEquipmentId(equipmentId: string)` - Get all sensors for equipment
- `create(data)` - Create new sensor configuration
- `update(id: string, data)` - Update sensor configuration

### 2. SensorStateRepository

**Location**: `server/infrastructure/TenantScopedRepository.ts`

**Methods**:

- `getLatest(equipmentId: string)` - Get latest sensor state
- `getHistory(equipmentId: string, limit: number)` - Get sensor state history
- `upsert(data)` - Create or update sensor state

## Endpoints to Migrate

### Equipment Sensor Methods (Current: Legacy Storage)

#### 1. GET /api/equipment/:id/sensor-coverage

**Current**: `equipmentRepository.getSensorCoverage(equipmentId, orgId)`
**Target**: Use `SensorConfigurationRepository.getByEquipmentId(equipmentId)`
**Complexity**: LOW - Direct mapping
**Priority**: P2

#### 2. POST /api/equipment/:id/sensors/setup

**Current**: `equipmentRepository.setupSensors(equipmentId, orgId)`
**Target**: Use `SensorConfigurationRepository.create()` for bulk sensor setup
**Complexity**: MEDIUM - Requires bulk operation logic
**Priority**: P2

### Equipment Parts Methods (Current: Legacy Storage)

#### 3. GET /api/equipment/:id/parts/compatible

**Current**: `equipmentRepository.getCompatibleParts(equipmentId, orgId)`
**Target**: Needs PartsRepository implementation
**Complexity**: HIGH - Repository not yet implemented
**Priority**: P3
**Dependencies**:

- Create `PartsRepository` extending `TenantScopedRepository`
- Implement parts compatibility logic
- Add parts inventory joins

#### 4. GET /api/equipment/:id/parts/suggested

**Current**: `equipmentRepository.getSuggestedParts(equipmentId, orgId)`
**Target**: Needs PartsRepository + ML integration
**Complexity**: HIGH - Requires ML/analytics integration
**Priority**: P3
**Dependencies**:

- Create `PartsRepository`
- Integrate with parts suggestion ML model
- Add predictive maintenance data joins

## Migration Pattern (Proven from Phase 2B)

### Step 1: Use DualWriteAdapter

```typescript
async getSensorCoverage(equipmentId: string, orgId: string) {
  return this.adapter.execute({
    operation: 'getSensorCoverage',
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.sensorConfiguration(orgId);
      return repo.getByEquipmentId(equipmentId);
    },
    legacyFn: async () => {
      return equipmentRepository.getSensorCoverage(equipmentId, orgId);
    },
  });
}
```

### Step 2: Add Feature Flag

Use existing `useTenantScopedEquipment` or create new flags:

- `useTenantScopedSensors` for sensor endpoints
- `useTenantScopedParts` for parts endpoints

### Step 3: Integration Tests

Follow pattern from `server/tests/dual-write-adapter.test.ts`:

- Test repository success path doesn't call legacy
- Test fallback preserves tenant scoping
- Test real repository integration with multi-tenant data

### Step 4: Architect Review

Get approval before marking complete

## Estimated Effort

| Endpoint         | Complexity | Effort   | Dependencies         |
| ---------------- | ---------- | -------- | -------------------- |
| sensor-coverage  | LOW        | 2 hours  | None                 |
| sensors/setup    | MEDIUM     | 4 hours  | None                 |
| parts/compatible | HIGH       | 8 hours  | PartsRepository      |
| parts/suggested  | HIGH       | 12 hours | PartsRepository + ML |

**Total**: ~26 hours (1 week sprint)

## Recommendations

1. **Defer to Phase 2C**: Current Phase 2B focuses on core equipment CRUD - defer sensor/parts to maintain focus
2. **Enable Equipment Flag First**: Validate Phase 2B in production before expanding scope
3. **Implement PartsRepository**: Create dedicated parts repository before migrating parts endpoints
4. **Gradual Rollout**: Use feature flags to enable sensor migrations first, then parts

## Success Criteria

- [ ] All sensor endpoints use SensorConfigurationRepository
- [ ] All parts endpoints use PartsRepository (TBD)
- [ ] Integration tests cover dual-write behavior
- [ ] Architect approval obtained
- [ ] Zero tenant isolation vulnerabilities
- [ ] Performance metrics show <10% overhead

## Related Files

- `server/infrastructure/TenantScopedRepository.ts` - Repository implementations
- `server/infrastructure/DualWriteAdapter.ts` - Migration adapter
- `server/domains/equipment/service.ts` - Equipment service to migrate
- `server/tests/dual-write-adapter.test.ts` - Test pattern reference
