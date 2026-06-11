# ARUS Backend Dependency Graph

## Routes.ts Import Dependencies

### Core Framework

```
express (Express, Request)
http (createServer, Server)
express-rate-limit (rateLimit, ipKeyGenerator)
zod (z)
multer
```

### Internal Modules

```
./storage → storage interface
./sensor-routes → mountSensorRoutes
./routes/kb-routes → registerKnowledgeBaseRoutes
./routes/insights-routes → registerInsightsRoutes
./routes/equipment-context-routes → registerEquipmentContextRoutes
./websocket → TelemetryWebSocketServer
./sync-events → getSyncMetrics, processPendingEvents, recordAndPublish
./insights-engine → computeInsights, persistSnapshot, getLatestSnapshot
./logging → loggingContextMiddleware
./compliance/audit-middleware → auditMiddleware
./ml-threshold-calibrator → thresholdCalibrator
./storage-config → storageConfigService, opsDbService
./db → db
./objectStorage → ObjectStorageService, ObjectNotFoundError
./beast-mode-routes → beastModeRouter
./governance/routes → governanceRouter
./compliance/routes → complianceRouter
./routes/sensorBundles → sensorBundlesRouter
./routes/sensorTemplates → sensorTemplatesRouter
./ml-routes → mlRouter
./events/scheduler-bus → schedulerEventBus
./openai → analyzeFleetHealth, analyzeEquipmentHealth
./crew-scheduler → planShifts
./stcw-compliance → checkMonthCompliance, normalizeRestDays, RestDay
./stcw-pdf-generator → renderRestPdf, generatePdfFilename
./adaptive-training-window → *
```

### Schema Dependencies

```
@shared/schema-runtime → EquipmentTelemetry, equipmentTelemetry, etc.
drizzle-orm → eq, desc, and, isNull
```

---

## Domain Module Registration Order

```
1. registerSwaggerRoutes
2. registerKnowledgeBaseRoutes
3. registerInsightsRoutes
4. registerEquipmentContextRoutes
5. registerWorkOrderRoutes
6. registerEquipmentRoutes
7. registerVesselsRoutes
8. registerDeviceRoutes
9. registerMaintenanceRoutes
10. registerInventoryRoutes
11. registerAlertsRoutes
12. registerAlertSettingsRoutes
13. registerCrewRoutes
14. registerLogbookRoutes
15. registerTelemetryRoutes
16. registerComplianceRoutes
17. registerNotificationRoutes
18. registerAdminRoutes
19. registerIntegrationsRoutes
20. registerDtcRoutes
21. registerMlAnalyticsRoutes
22. registerCostSavingsRoutes
23. registerConditionMonitoringRoutes
24. registerSyncRoutes
25. registerSensorManagementRoutes
```

---

## Storage Method Usage in Routes.ts

### High-Frequency Methods (>5 calls)

| Method                             | Calls | Domain     |
| ---------------------------------- | ----- | ---------- |
| storage.clearTable                 | 25    | admin/dev  |
| storage.getCrewRestMonth           | 9     | crew       |
| storage.getTelemetryTrends         | 7     | telemetry  |
| storage.getEquipmentHealth         | 7     | equipment  |
| storage.getSchedulerRun            | 6     | scheduling |
| storage.getEquipmentRegistry       | 6     | equipment  |
| storage.getSettings                | 5     | settings   |
| storage.getLatestTelemetryReadings | 5     | telemetry  |

### Medium-Frequency Methods (2-4 calls)

| Method                          | Calls | Domain      |
| ------------------------------- | ----- | ----------- |
| storage.getVessel               | 4     | vessels     |
| storage.getDevice               | 4     | devices     |
| storage.getCrewRestRange        | 4     | crew        |
| storage.getCrewMember           | 4     | crew        |
| storage.getAlertNotifications   | 4     | alerts      |
| storage.getWorkOrders           | 3     | work-orders |
| storage.getVessels              | 3     | vessels     |
| storage.getMaintenanceSchedules | 3     | maintenance |

---

## Cross-Domain Dependencies

### Equipment Domain

```
equipment
├── telemetry (health calculation)
├── sensors (configuration)
├── work-orders (maintenance history)
├── maintenance (schedules)
└── alerts (notifications)
```

### Work Orders Domain

```
work-orders
├── equipment (asset reference)
├── inventory (parts consumption)
├── crew (labor assignment)
├── maintenance (schedule completion)
└── compliance (audit trail)
```

### Crew Domain

```
crew
├── vessels (assignment)
├── compliance (STCW validation)
├── scheduling (shift planning)
└── work-orders (labor tracking)
```

### Telemetry Domain

```
telemetry
├── equipment (source reference)
├── sensors (configuration)
├── alerts (threshold triggers)
├── ml (training data)
└── logbook (condition monitoring)
```

### Logbook Domain

```
logbook
├── vessels (context)
├── telemetry (fuel/emissions)
├── crew (deck/engine entries)
├── compliance (validation)
└── stormgeo (weather autofill)
```

---

## Cyclic Dependencies (Need Breaking)

### 1. Work Orders ↔ Inventory

```
Problem:
- Work orders reserve parts from inventory
- Inventory tracks parts by work order

Solution:
- Extract reservation logic to shared service
- Use event-based updates for inventory movements
```

### 2. Equipment ↔ Telemetry

```
Problem:
- Equipment health depends on telemetry
- Telemetry records reference equipment

Solution:
- Equipment stores cached health score
- Telemetry writes update health asynchronously
```

### 3. Maintenance ↔ Work Orders

```
Problem:
- Maintenance schedules generate work orders
- Work order completion updates schedules

Solution:
- Event-based schedule updates
- Unidirectional creation flow
```

### 4. Crew ↔ Vessels

```
Problem:
- Crew assigned to vessels
- Vessels reference crew counts

Solution:
- Crew owns assignment data
- Vessels query via crew service
```

---

## Shared Utilities

### Rate Limiters

```typescript
// Available in routes.ts
generalApiRateLimit; // 100 req/min
writeOperationRateLimit; // 30 req/min
criticalOperationRateLimit; // 10 req/min
crewOperationRateLimit; // 20 req/min
reportGenerationRateLimit; // 5 req/min
```

### Middleware

```typescript
requireOrgId; // Tenant isolation
requireAdminAuth; // Admin verification
auditMiddleware; // Compliance logging
loggingContextMiddleware; // Request tracking
```

### Error Handling

```typescript
// Standard error response pattern
try {
  // operation
  res.json(result);
} catch (error) {
  console.error("[Domain] Operation failed:", error);
  res.status(500).json({ message: "Operation failed" });
}
```

---

## Storage Interface Categories

### Category 1: Organizations & Users (~400 lines)

```
getOrganizations, getOrganization, createOrganization, updateOrganization, deleteOrganization
getUsers, getUser, getUserByEmail, createUser, updateUser, deleteUser
```

### Category 2: Equipment & Sensors (~1,200 lines)

```
getEquipment, getEquipmentRegistry, createEquipment, updateEquipment, deleteEquipment
getSensorConfigurations, getSensorConfiguration, createSensorConfiguration, updateSensorConfiguration
getSensorState, upsertSensorState, getLatestTelemetryForSensor
```

### Category 3: Work Orders (~1,500 lines)

```
getWorkOrders, getWorkOrdersPaginated, createWorkOrder, updateWorkOrder, deleteWorkOrder
getWorkOrderTasks, createWorkOrderTask, updateWorkOrderTask, deleteWorkOrderTask
getWorkOrderParts, addPartToWorkOrder, removePartFromWorkOrder
getWorkOrderHistory, addWorkOrderHistoryEntry
```

### Category 4: Telemetry (~800 lines)

```
getTelemetryTrends, createTelemetryReading, getTelemetryHistory
getTelemetryByEquipmentAndDateRange, getLatestTelemetryReadings
batchInsertTelemetry, getTelemetryStats
```

### Category 5: Crew & STCW (~1,500 lines)

```
getCrew, getCrewMember, createCrewMember, updateCrew, deleteCrew
getCrewCertifications, createCrewCertification, updateCrewCertification
getCrewRestSheet, getCrewRestMonth, upsertCrewRestDay
checkMonthCompliance, getSTCWViolations
```

### Category 6: Inventory (~1,000 lines)

```
getPartsInventory, getPartById, createPart, updatePart, deletePart
getWorkOrderParts, addPartToWorkOrder, reservePart
getInventoryMovements, recordInventoryMovement
```

### Category 7: Maintenance (~800 lines)

```
getMaintenanceSchedules, createMaintenanceSchedule, updateMaintenanceSchedule
getUpcomingSchedules, autoScheduleMaintenance
getMaintenanceRecords, createMaintenanceRecord
```

### Category 8: Alerts (~600 lines)

```
getAlertConfigurations, createAlertConfiguration, updateAlertConfiguration
getAlertNotifications, createAlertNotification, acknowledgeAlert
getAlertSuppressions, createAlertSuppression
```

### Category 9: Logbook (~2,000 lines)

```
getDeckLogEntries, createDeckLogEntry, updateDeckLogEntry
getEngineLogEntries, createEngineLogEntry, updateEngineLogEntry
getFuelEmissionsLog, getVesselTrackLog, getConditionMonitoringLog
```

### Category 10: Analytics & ML (~1,000 lines)

```
getPdmScores, createPdmScore, getLatestPdmScore
getMLModels, createMLModel, updateMLModel
getInsightsSnapshots, createInsightsSnapshot
```

---

## Extraction Strategy

### Step 1: Create Storage Sub-Interfaces

```typescript
// server/storage/interfaces/equipment.ts
export interface IEquipmentStorage {
  getEquipment(orgId: string, equipmentId: string): Promise<Equipment | undefined>;
  getEquipmentRegistry(orgId?: string): Promise<Equipment[]>;
  // ... etc
}
```

### Step 2: Implement Storage Modules

```typescript
// server/storage/modules/equipment-storage.ts
export class EquipmentStorage implements IEquipmentStorage {
  constructor(private db: DbClient) {}

  async getEquipment(orgId: string, equipmentId: string) {
    // Implementation
  }
}
```

### Step 3: Compose in Main Storage

```typescript
// server/storage.ts (reduced)
export class Storage implements IStorage {
  equipment: IEquipmentStorage;
  telemetry: ITelemetryStorage;
  workOrders: IWorkOrderStorage;
  // ... etc

  constructor(db: DbClient) {
    this.equipment = new EquipmentStorage(db);
    this.telemetry = new TelemetryStorage(db);
    // ... etc
  }
}
```

### Step 4: Update Domain Routes

```typescript
// Domain routes access storage via interface
const equipment = await storage.equipment.getEquipment(orgId, id);
```

---

## Risk Assessment

### Low Risk Extractions

- Settings (isolated, simple CRUD)
- Port Operations (isolated, simple CRUD)
- Error Logs (isolated, simple CRUD)
- Context Events (isolated, simple CRUD)

### Medium Risk Extractions

- Crew (cross-references vessels, compliance)
- Inventory (cross-references work orders)
- Scheduling (cross-references crew, maintenance)
- Stormgeo (cross-references logbook)

### High Risk Extractions

- Admin (large section, auth logic, org management)
- ML Training (complex algorithms, external services)
- Telemetry Ingestion (high-throughput, performance-critical)
- Equipment Health (RUL engine, cross-domain aggregation)
- Alerts Engine (real-time processing, notifications)
