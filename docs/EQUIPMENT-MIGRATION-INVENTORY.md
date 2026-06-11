# Equipment Domain Migration Inventory

## Phase 2 - Detailed Endpoint and Storage Analysis

**Migration Target**: Equipment domain to Tenant-Scoped Repository pattern  
**Feature Flag**: `useTenantScopedEquipment`  
**Priority**: High (first domain migration)

---

## Equipment API Endpoints

### Core CRUD Operations

| Endpoint         | Method | Route                | Storage Method                   | Priority |
| ---------------- | ------ | -------------------- | -------------------------------- | -------- |
| List Equipment   | GET    | `/api/equipment`     | `storage.getEquipmentRegistry()` | P0       |
| Get Equipment    | GET    | `/api/equipment/:id` | `storage.getEquipmentById()`     | P0       |
| Create Equipment | POST   | `/api/equipment`     | `storage.createEquipment()`      | P0       |
| Update Equipment | PUT    | `/api/equipment/:id` | `storage.updateEquipment()`      | P0       |
| Delete Equipment | DELETE | `/api/equipment/:id` | `storage.deleteEquipment()`      | P0       |

### Health & Analytics

| Endpoint         | Method | Route                                | Storage Method                                  | Priority |
| ---------------- | ------ | ------------------------------------ | ----------------------------------------------- | -------- |
| Equipment Health | GET    | `/api/equipment/health`              | `storage.getEquipmentRegistry()` + calculations | P1       |
| Sensor Coverage  | GET    | `/api/equipment/:id/sensor-coverage` | `storage.getSensorConfigurations()`             | P1       |
| Setup Sensors    | POST   | `/api/equipment/:id/setup-sensors`   | `storage.createSensorConfiguration()`           | P1       |

### Predictive Maintenance

| Endpoint           | Method | Route                            | Storage Method                        | Priority |
| ------------------ | ------ | -------------------------------- | ------------------------------------- | -------- |
| RUL Prediction     | GET    | `/api/equipment/:id/rul`         | `storage.getLatestTelemetry()` + ML   | P1       |
| Batch RUL          | POST   | `/api/equipment/rul/batch`       | `storage.getEquipmentRegistry()` + ML | P1       |
| Record Degradation | POST   | `/api/equipment/:id/degradation` | `storage.createPerformanceMetric()`   | P1       |

### DTC (Diagnostic Trouble Codes)

| Endpoint       | Method | Route                                   | Storage Method                           | Priority |
| -------------- | ------ | --------------------------------------- | ---------------------------------------- | -------- |
| Active DTCs    | GET    | `/api/equipment/:id/dtc/active`         | `storage.getActiveDtcs()`                | P2       |
| DTC History    | GET    | `/api/equipment/:id/dtc/history`        | `storage.getDtcHistory()`                | P2       |
| Health Impact  | GET    | `/api/equipment/:id/dtc/health-impact`  | `storage.getActiveDtcs()` + calculations | P2       |
| Report Summary | GET    | `/api/equipment/:id/dtc/report-summary` | `storage.getActiveDtcs()`                | P2       |

### Parts & Inventory

| Endpoint         | Method | Route                                          | Storage Method                   | Priority |
| ---------------- | ------ | ---------------------------------------------- | -------------------------------- | -------- |
| Compatible Parts | GET    | `/api/equipment/:equipmentId/compatible-parts` | `storage.getPartsForEquipment()` | P2       |
| Suggested Parts  | GET    | `/api/equipment/:equipmentId/suggested-parts`  | `storage.getPartsForEquipment()` | P2       |
| Sensor Issues    | GET    | `/api/equipment/sensor-issues`                 | `storage.getSensorStates()`      | P2       |

### Vessel Association

| Endpoint            | Method | Route                                    | Storage Method                              | Priority |
| ------------------- | ------ | ---------------------------------------- | ------------------------------------------- | -------- |
| Disassociate Vessel | DELETE | `/api/equipment/:id/disassociate-vessel` | `storage.disassociateEquipmentFromVessel()` | P2       |

---

## Storage Interface Methods Requiring Migration

### Primary Equipment Methods

```typescript
// Priority 0 - Core CRUD
getEquipmentRegistry(orgId?: string): Promise<Equipment[]>
getEquipmentById(id: string, orgId?: string): Promise<Equipment | undefined>
createEquipment(data: InsertEquipment): Promise<Equipment>
updateEquipment(id: string, data: Partial<InsertEquipment>, orgId?: string): Promise<Equipment>
deleteEquipment(id: string, orgId?: string): Promise<void>
disassociateEquipmentFromVessel(equipmentId: string, orgId?: string): Promise<void>

// Priority 1 - Related Data
getRelatedEquipment(equipmentId: string, orgId?: string): Promise<Equipment[]>
getWorkOrderHistory(equipmentId: string, days?: number, orgId?: string): Promise<WorkOrder[]>
getMaintenanceHistory(equipmentId: string, days?: number, orgId?: string): Promise<any[]>
```

### Sensor Configuration Methods

```typescript
getSensorConfigurations(orgId?: string, equipmentId?: string, sensorType?: string): Promise<SensorConfiguration[]>
getSensorConfiguration(equipmentId: string, sensorType: string, orgId?: string): Promise<SensorConfiguration | undefined>
createSensorConfiguration(config: InsertSensorConfiguration): Promise<SensorConfiguration>
updateSensorConfiguration(equipmentId: string, sensorType: string, config: Partial<InsertSensorConfiguration>, orgId?: string): Promise<SensorConfiguration>
deleteSensorConfiguration(equipmentId: string, sensorType: string, orgId?: string): Promise<void>
```

### Sensor State Methods

```typescript
getSensorStates(orgId?: string, equipmentId?: string, sensorType?: string): Promise<SensorState[]>
getSensorState(equipmentId: string, sensorType: string, orgId?: string): Promise<SensorState | undefined>
```

---

## Repository Implementation Plan

### EquipmentRepository Methods

```typescript
export class EquipmentRepository extends TenantScopedRepository {
  // Core CRUD
  async getAll(): Promise<Equipment[]>;
  async getById(equipmentId: string): Promise<Equipment | undefined>;
  async create(data: Omit<InsertEquipment, "id" | "orgId">): Promise<Equipment>;
  async update(equipmentId: string, data: Partial<InsertEquipment>): Promise<Equipment>;
  async delete(equipmentId: string): Promise<void>;
  async disassociateFromVessel(equipmentId: string): Promise<void>;

  // Related data
  async getRelated(equipmentId: string): Promise<Equipment[]>;
  async getWorkOrderHistory(equipmentId: string, days?: number): Promise<WorkOrder[]>;
  async getMaintenanceHistory(equipmentId: string, days?: number): Promise<any[]>;

  // Analytics
  async getHealthMetrics(vesselId?: string): Promise<EquipmentHealth[]>;
}
```

### SensorConfigurationRepository Methods

```typescript
export class SensorConfigurationRepository extends TenantScopedRepository {
  async getAll(filters?: {
    equipmentId?: string;
    sensorType?: string;
  }): Promise<SensorConfiguration[]>;
  async getByEquipmentAndType(
    equipmentId: string,
    sensorType: string
  ): Promise<SensorConfiguration | undefined>;
  async create(data: Omit<InsertSensorConfiguration, "id" | "orgId">): Promise<SensorConfiguration>;
  async update(
    equipmentId: string,
    sensorType: string,
    data: Partial<InsertSensorConfiguration>
  ): Promise<SensorConfiguration>;
  async delete(equipmentId: string, sensorType: string): Promise<void>;
}
```

### SensorStateRepository Methods

```typescript
export class SensorStateRepository extends TenantScopedRepository {
  async getAll(filters?: { equipmentId?: string; sensorType?: string }): Promise<SensorState[]>;
  async getByEquipmentAndType(
    equipmentId: string,
    sensorType: string
  ): Promise<SensorState | undefined>;
  async create(data: Omit<InsertSensorState, "id" | "orgId">): Promise<SensorState>;
  async update(
    equipmentId: string,
    sensorType: string,
    data: Partial<InsertSensorState>
  ): Promise<SensorState>;
}
```

---

## Migration Strategy

### Phase 2A: Core Equipment CRUD (Week 1)

**Scope**: `/api/equipment` GET/POST/PUT/DELETE endpoints

**Steps**:

1. Complete `EquipmentRepository` implementation
2. Add dual-write adapter integration in routes
3. Feature flag: `useTenantScopedEquipment` (default: false)
4. Monitoring: Track dual-write consistency, fallbacks
5. Testing: Integration tests for both code paths
6. Validation: Cross-tenant isolation tests

**Success Criteria**:

- All CRUD operations work with repository
- Dual-write consistency validated
- No cross-tenant access violations
- Performance within 10% of legacy

### Phase 2B: Health & Analytics (Week 2)

**Scope**: Equipment health, sensor coverage, RUL prediction

**Steps**:

1. Implement `SensorConfigurationRepository`
2. Implement `SensorStateRepository`
3. Migrate health calculation endpoints
4. Add analytics-specific tests
5. Monitor ML pipeline compatibility

**Success Criteria**:

- Health metrics match legacy calculations
- RUL predictions consistent
- Sensor coverage analysis accurate

### Phase 2C: DTC & Parts Integration (Week 3)

**Scope**: DTC endpoints, parts compatibility

**Steps**:

1. Validate DTC queries use correct org context
2. Ensure parts linkage maintains tenant isolation
3. Add regression tests for cross-domain queries
4. Monitor for any data leakage

**Success Criteria**:

- DTC queries properly filtered
- Parts suggestions tenant-scoped
- No cross-tenant data in results

### Phase 2D: Full Cutover (Week 4)

**Scope**: Remove legacy code path, enable flag globally

**Steps**:

1. Monitor telemetry for 1 week with dual-write
2. Validate consistency between repository and legacy
3. Enable `useTenantScopedEquipment` globally
4. Remove legacy equipment storage methods
5. Archive old code for rollback

**Success Criteria**:

- Zero tenant isolation violations
- Performance acceptable
- All tests passing
- No reported issues from users

---

## Risk Assessment

### High Risk Areas

1. **RUL Prediction Endpoints**: Complex ML integration, ensure tensor data properly scoped
2. **Sensor Coverage Analysis**: Cross-table joins, validate all queries include org filter
3. **DTC Health Impact**: Aggregations across multiple tables, ensure no data leakage
4. **Batch Operations**: `POST /api/equipment/rul/batch` processes multiple equipment IDs

### Mitigation Strategies

1. **Comprehensive Integration Tests**: Test both dual-write paths
2. **Cross-tenant Validation**: Automated tests attempting to access other org's equipment
3. **Performance Benchmarks**: Compare repository vs legacy response times
4. **Gradual Rollout**: Start with low-traffic hours, monitor closely
5. **Quick Rollback**: Feature flag allows instant disable if issues detected

---

## Monitoring Checklist

### Metrics to Track

- [ ] `tenant_repository_operations{domain=equipment,operation=getAll,status=success}`
- [ ] `tenant_repository_operations{domain=equipment,operation=create,status=success}`
- [ ] Dual-write fallback count (should be zero after stabilization)
- [ ] Cross-tenant violation attempts (should remain zero)
- [ ] Average response time delta (repository vs legacy)
- [ ] Error rate comparison

### Alerts to Configure

- **Critical**: Cross-tenant access violation detected
- **Warning**: Dual-write fallback count > 10 in 5 minutes
- **Warning**: Repository error rate > 1% for 10 minutes
- **Info**: Feature flag state change (enable/disable)

### Dashboards

1. Equipment Migration Health
   - Dual-write consistency rate
   - Fallback frequency
   - Error rates by operation
2. Tenant Isolation Compliance
   - Violation attempts (should be zero)
   - Success/failure by org
   - Cross-tenant query blocks

3. Performance Comparison
   - Response time: repository vs legacy
   - Throughput comparison
   - Resource utilization

---

## Rollback Procedure

### Emergency Rollback (< 5 minutes)

1. Set `USE_TENANT_SCOPED_EQUIPMENT=false` in environment
2. Restart application
3. Verify legacy code path active
4. Monitor for stability

### Graceful Rollback (< 30 minutes)

1. Disable feature flag via admin panel
2. Drain in-flight requests
3. Verify dual-write adapter routing to legacy
4. Analyze logs for root cause
5. Fix issues in development
6. Re-enable after validation

### Data Consistency Check

```sql
-- Verify no data loss during dual-write
SELECT COUNT(*) FROM equipment WHERE org_id = 'org-123';

-- Compare with legacy storage state
-- Should match exactly
```

---

## Test Coverage Requirements

### Unit Tests

- [ ] EquipmentRepository: All CRUD methods
- [ ] SensorConfigurationRepository: All methods
- [ ] SensorStateRepository: All methods
- [ ] Cross-tenant isolation validation
- [ ] Column validation (orgId exists)

### Integration Tests

- [ ] Dual-write adapter consistency
- [ ] Fallback behavior on repository error
- [ ] Feature flag toggle behavior
- [ ] Legacy storage compatibility

### End-to-End Tests

- [ ] Complete equipment lifecycle (create → update → delete)
- [ ] Multi-equipment operations (batch RUL)
- [ ] Cross-domain workflows (equipment → work orders)
- [ ] User authentication with org context

---

## Success Metrics

### Technical Goals

- ✅ Zero cross-tenant access violations
- ✅ 100% dual-write consistency during migration
- ✅ < 10% performance degradation
- ✅ All automated tests passing

### Business Goals

- ✅ No user-reported tenant isolation issues
- ✅ No data loss during migration
- ✅ Seamless rollout with zero downtime
- ✅ Improved security posture

---

_Document Status_: Phase 2 Planning Complete  
_Next Step_: Implement EquipmentRepository methods  
_Estimated Completion_: 4 weeks for full migration
