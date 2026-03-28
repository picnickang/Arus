# ARUS Bounded-Context Analysis & Microservices Migration Roadmap

> **Version**: 1.0  
> **Date**: 2026-03-28  
> **Status**: Reference — approved for Task #8 (Inventory consolidation) and Task #9 (Fleet Registry extraction)

---

## 1. Executive Summary

The ARUS monolith contains **22+ Drizzle schema files** declaring **~120 PostgreSQL tables**. This document maps every table to one of **8 bounded contexts**, catalogues all cross-boundary foreign-key references, identifies the single known schema duplication (Inventory), and proposes a phased extraction order for a future microservices migration.

---

## 2. Bounded Contexts

### BC-1: Fleet Registry

**Purpose**: Organization, user, vessel, and system configuration management.

| Schema File | Tables |
|---|---|
| `core.ts` | `organizations`, `users`, `systemSettings`, `emailSettings`, `metricsHistory`, `dbSchemaVersion` |
| `vessels.ts` | `vessels`, `weatherCache`, `portCall`, `drydockWindow` |
| `stormgeo.ts` | `stormgeoSettings`, `stormgeoSnapshots`, `stormgeoImportHistory` |

**Internal FKs**: `vessels.orgId → organizations.id`, `users.orgId → organizations.id`, `weatherCache.vesselId → vessels.id`, `portCall.vesselId → vessels.id`, `drydockWindow.vesselId → vessels.id`, `stormgeoSettings.vesselId → vessels.id`, `stormgeoSnapshots.vesselId → vessels.id`

**Outbound FKs**: None — this context has no foreign keys pointing to tables in other bounded contexts. It is the root dependency: many other contexts reference `organizations.id` and `vessels.id`.

**Inbound FK consumers**: Every other bounded context references `organizations.id`; contexts BC-2 through BC-8 reference `vessels.id`.

---

### BC-2: Asset & Maintenance

**Purpose**: Equipment lifecycle, work orders, maintenance scheduling/records/templates/costs, condition monitoring (oil analysis, wear particle, vibration), and downtime tracking.

| Schema File | Tables |
|---|---|
| `equipment.ts` | `equipment`, `devices`, `edgeHeartbeats`, `pdmScoreLogs`, `equipmentLifecycle`, `performanceMetrics`, `equipmentDecommissionEvents`, `downtimeEvents`, `partFailureHistory`, `industryBenchmarks`, `operatingParameters`, `operatingConditionAlerts` |
| `work-orders.ts` | `workOrders`, `workOrderChecklists`, `workOrderWorklogs`, `workOrderTasks`, `workOrderHistory`, `workOrderParts`, `workOrderEquipment`, `workOrderCompletions` |
| `maintenance.ts` | `maintenanceSchedules`, `maintenanceRecords`, `maintenanceCosts`, `maintenanceTemplates`, `maintenanceChecklistItems`, `maintenanceChecklistCompletions`, `oilAnalysis`, `wearParticleAnalysis`, `conditionMonitoring`, `oilChangeRecords` |
| `costs.ts` | `laborRates`, `expenses`, `costModel`, `costSavings` |
| `dtc.ts` | `dtcDefinitions`, `dtcFaults` |

**Key internal FKs**: `equipment.vesselId → vessels.id` (cross-boundary to BC-1), `workOrders.equipmentId → equipment.id`, `maintenanceSchedules.equipmentId → equipment.id`, `conditionMonitoring.lastOilAnalysisId → oilAnalysis.id`, `oilChangeRecords.workOrderId → workOrders.id`, `costSavings.equipmentId → equipment.id`, `dtcFaults.equipmentId → equipment.id`, `dtcFaults.deviceId → devices.id`

**Cross-boundary FKs**:
- → BC-1: `equipment.orgId`, `equipment.vesselId`, `workOrders.orgId`, `maintenanceSchedules.vesselId`
- → BC-7 (ML): `costSavings.predictionId → failurePredictions.id`

**Logical dependencies** (no FK constraint):
- → BC-5 (Inventory): `workOrderParts.partId` stores a part identifier but has no `.references()` FK constraint; `workOrderParts.supplierId` is also a plain `varchar`

---

### BC-3: Telemetry & Sensing

**Purpose**: Real-time and historical telemetry ingestion, retention, rollups, sensor management, J1939 CAN bus, and equipment heartbeat tracking.

| Schema File | Tables |
|---|---|
| `telemetry.ts` | `equipmentTelemetry`, `telemetryDeadLetter`, `rawTelemetry`, `telemetryRetentionPolicies`, `telemetryRollups`, `telemetryAggregates`, `j1939Configurations`, `dailyMetricRollups`, `engineerOverrides`, `rawTelemetryArchive`, `equipmentHeartbeat`, `telemetryBatchAck`, `telemetrySchemaRegistry` |
| `sensors.ts` | `sensorTypes`, `sensorMapping`, `discoveredSignals`, `sensorConfigurations`, `sensorStates`, `sensorTemplates`, `sensorBundles`, `sensorThresholds` |
| `iot-edge.ts` | `mqttDevices`, `deviceRegistry`, `transportSettings`, `edgeDiagnosticLogs`, `transportFailovers`, `serialPortStates`, `calibrationCache`, `calibrationCurves`, `dataQualityMetrics` |

**Cross-boundary FKs**:
- → BC-1: `equipmentTelemetry.orgId`, `rawTelemetry.orgId`, `dailyMetricRollups.vesselId → vessels.id`, `j1939Configurations.orgId`
- → BC-2: `equipmentTelemetry.equipmentId → equipment.id`, `j1939Configurations.deviceId → devices.id`, `sensorThresholds.deviceId → devices.id`, `equipmentHeartbeat.equipmentId → equipment.id`, `engineerOverrides.equipmentId → equipment.id`

---

### BC-4: Crew & Compliance

**Purpose**: Crew management, certifications, rest hours, leave, shift scheduling, STCW compliance, logbooks, and compliance rules engine.

| Schema File | Tables |
|---|---|
| `crew.ts` | `crew`, `crewEmploymentHistory`, `crewNotificationSettings`, `skills`, `crewSkill`, `crewLeave`, `shiftTemplate`, `crewAssignment`, `crewCertification`, `crewDocuments`, `crewRestSheet`, `crewRestDay` |
| `compliance.ts` | `complianceAuditLog`, `complianceBundles`, `immutableAuditTrail`, `complianceDocs`, `complianceFindings`, `complianceRules` |
| `logbooks.ts` | `deckLogDaily`, `deckLogHourly`, `deckLogWatch`, `deckLogEvents`, `engineLogDaily`, `engineLogHourly`, `engineLogGenerator`, `engineLogWatch`, `engineLogEvents`, `deckLogHourlyAutoFill`, `fuelEmissionsLog`, `vesselTrackLog`, `conditionLogSummary` |
| `scheduling-settings.ts` | `schedulingSettings` |

**Cross-boundary FKs**:
- → BC-1: `crew.orgId`, `crew.vesselId → vessels.id`, `complianceDocs.vesselId → vessels.id`, `complianceFindings.vesselId → vessels.id`

---

### BC-5: Inventory & Procurement

**Purpose**: Parts catalog, stock levels, supplier management, purchase requests, and inventory movements.

| Schema File | Tables |
|---|---|
| `inventory.ts` | `suppliers`, `parts`, `partsInventory`, `partsInventorySuppliers`, `stock`, `partSubstitutions`, `inventoryMovements`, `inventoryParts` |
| `purchasing.ts` | `reservations`, `purchaseOrders`, `purchaseOrderItems`, `purchaseOrderEvents`, `purchaseRequests`, `purchaseRequestItems`, `purchaseRequestEvents`, `itemSuppliers`, `serviceOrders`, `serviceOrderEvents` |

**Cross-boundary FKs**:
- → BC-1: `suppliers.orgId`, `parts.orgId`, `stock.orgId`, `inventoryParts.orgId`, `inventoryMovements.orgId`
- → BC-2: `inventoryMovements.workOrderId → workOrders.id` (FK constraint on `workOrders.id`)

**Logical dependencies** (no FK constraint, but data-coupled):
- `stock.partId → parts.id` (internal), `inventoryMovements.partId → partsInventory.id` (internal)

**Schema Duplication Issue** (see Section 4):
Three overlapping part/stock table families exist:
1. `parts` + `stock` — original parts catalog with stock levels
2. `partsInventory` + `partsInventorySuppliers` — newer inventory with multi-supplier support
3. `inventoryParts` — simplified join table linking parts to work orders

Task #8 targets consolidation of these three families.

---

### BC-6: Alerts & Notifications

**Purpose**: Alert configuration, threshold management, notification dispatch, email logging, cooldowns, suppressions, and crew-specific alert settings.

| Schema File | Tables |
|---|---|
| `alerts.ts` | `alertConfigurations`, `alertNotifications`, `alertSuppressions`, `alertComments`, `actionableInsights`, `alertSettings`, `alertSettingsVessel`, `alertThresholds`, `alertEmailLog`, `crewAlertSettings`, `alertCooldown` |

**Cross-boundary FKs**:
- → BC-1: `alertConfigurations.orgId`, `alertSettingsVessel.vesselId → vessels.id`, `alertEmailLog.vesselId → vessels.id`, `crewAlertSettings.vesselId → vessels.id`
- → BC-2: `alertConfigurations.equipmentId → equipment.id`, `alertNotifications.equipmentId → equipment.id`, `actionableInsights.equipmentId → equipment.id`, `actionableInsights.workOrderId → workOrders.id`

---

### BC-7: ML & Digital Twin

**Purpose**: ML model lifecycle, failure predictions, anomaly detection, digital twins, simulation, feature store, fleet baselines, training pipeline, and model registry.

| Schema File | Tables |
|---|---|
| `ml-analytics-core.ts` | `mlModelsLegacy`, `mlModels`, `modelVersions`, `modelMetrics`, `anomalyDetections`, `failurePredictions`, `thresholdOptimizations`, `componentDegradation`, `failureHistory` |
| `ml-analytics-advanced.ts` | `modelPerformanceValidations`, `predictionFeedback`, `vibrationFeatures`, `rulModels`, `rulFitHistory`, `vibrationAnalysis`, `weibullEstimates`, `pdmBaseline`, `pdmAlerts`, `realTimePredictions`, `featureImportances`, `sensorFusionSnapshots`, `acousticEvents`, `modelDeployments`, `llmBudgetConfigs`, `retrainingTriggers`, `mlModelAccuracyHistory`, `predictionDataQuality`, `inferenceRuns`, `predictionExplanations`, `modelDriftMetrics` |
| `ml-training-pipeline.ts` | `trainingDatasets`, `modelArtifacts`, `trainingRuns` |
| `pdm-feature-store.ts` | `equipmentFeatures`, `fleetBaselines` |
| `digital-twin.ts` | `digitalTwins`, `twinSimulations`, `visualizationAssets`, `arMaintenanceProcedures`, `modelRegistry` |
| `optimizer.ts` | `optimizerConfigurations`, `resourceConstraints`, `optimizationResults`, `scheduleOptimizations`, `schedulerRuns`, `scheduleAssignments`, `scheduleUnfilled` |
| `insights.ts` | `insightSnapshots`, `insightReports`, `llmCostTracking` |
| `knowledge-base.ts` | `knowledgeBaseItems`, `ragSearchQueries`, `contentSources` |
| `rag.ts` | `kbDocs`, `kbChunks`, `kbDocVersions`, `kbEmbeddingCache`, `ragConversations`, `ragMessages`, `ragFeedback`, `ragSemanticCache` |

**Cross-boundary FKs**:
- → BC-1: `mlModels.orgId`, `mlModelsLegacy.orgId`, `digitalTwins.vesselId → vessels.id`, `fleetBaselines.orgId`, `thresholdOptimizations.orgId`, `componentDegradation.orgId`, `failureHistory.orgId`
- → BC-2: `failurePredictions.equipmentId → equipment.id`, `anomalyDetections.equipmentId → equipment.id`, `anomalyDetections.resolvedByWorkOrderId → workOrders.id`, `failurePredictions.resolvedByWorkOrderId → workOrders.id`, `failureHistory.equipmentId → equipment.id`, `failureHistory.workOrderId → workOrders.id`, `componentDegradation.equipmentId → equipment.id`, `equipmentFeatures.equipmentId → equipment.id`, `arMaintenanceProcedures.equipmentId → equipment.id`
- → BC-2 (inbound): `costSavings.predictionId → failurePredictions.id`

---

### BC-8: Platform & Admin

**Purpose**: Admin audit, sessions, RBAC, error logs, software patches, sync/idempotency, email queue, notification queue, and system health.

| Schema File | Tables |
|---|---|
| `admin.ts` | `adminAuditEvents`, `adminSessions`, `adminSystemSettings`, `integrationConfigs`, `maintenanceWindows`, `systemPerformanceMetrics`, `systemHealthChecks`, `configAuditLog`, `emailQueue`, `notificationSettings`, `notificationQueue`, `auditRuns`, `auditWebhookSubscriptions`, `errorLogs`, `softwarePatches`, `updateSettings`, `fleetUpdateStatus`, `patchDownloads`, `entityOffsets`, `contextEvents`, `userSessions`, `loginEvents` |
| `permissions.ts` | `roles`, `permissionResources`, `permissionActions`, `resourceActions`, `permissionGrants`, `roleTemplates`, `permissionAuditLog`, `userRoleAssignments` |
| `sync.ts` | `syncJournal`, `syncOutbox`, `requestIdempotency`, `idempotencyLog`, `replayIncoming`, `sheetLock`, `sheetVersion` |
| `email-templates.ts` | `emailTemplates` |
| `scheduled-reports.ts` | `reportSchedules`, `generatedReports` |

**Cross-boundary FKs**:
- → BC-1: `adminAuditEvents.orgId`, `adminAuditEvents.userId → users.id`, `adminSessions.userId → users.id`, `softwarePatches.appliedBy → users.id`, `contextEvents.vesselId → vessels.id`, `userSessions.userId → users.id`, `fleetUpdateStatus.vesselId → vessels.id`
- → BC-2: `contextEvents.equipmentId → equipment.id`, `fleetUpdateStatus.deviceId → devices.id`
- → BC-5: `emailQueue.supplierId → suppliers.id`, `emailQueue.prId → purchaseRequests.id`

---

## 3. Cross-Boundary FK Matrix

This matrix shows which contexts hold foreign keys **to** other contexts (rows reference columns).

| From ↓ \ To → | BC-1 Fleet | BC-2 Asset | BC-3 Telemetry | BC-4 Crew | BC-5 Inventory | BC-6 Alerts | BC-7 ML | BC-8 Platform |
|---|---|---|---|---|---|---|---|---|
| **BC-1 Fleet** | internal | — | — | — | — | — | — | — |
| **BC-2 Asset** | `orgId`, `vesselId` | internal | — | — | — (logical only) | — | `predictionId` | — |
| **BC-3 Telemetry** | `orgId`, `vesselId` | `equipmentId`, `deviceId` | internal | — | — | — | — | — |
| **BC-4 Crew** | `orgId`, `vesselId` | — | — | internal | — | — | — | — |
| **BC-5 Inventory** | `orgId` | `workOrderId` | — | — | internal | — | — | — |
| **BC-6 Alerts** | `orgId`, `vesselId` | `equipmentId`, `workOrderId` | — | — | — | internal | — | — |
| **BC-7 ML** | `orgId`, `vesselId` | `equipmentId`, `workOrderId` | — | — | — | — | internal | — |
| **BC-8 Platform** | `orgId`, `userId`, `vesselId` | `equipmentId`, `deviceId` | — | — | `supplierId`, `prId` | — | — | internal |

**Key observation**: BC-1 (Fleet Registry) is referenced by every other context. BC-2 (Asset & Maintenance) is the second most referenced. These must be extracted first.

---

## 4. Schema Duplication: Inventory Parts

Three overlapping table families exist within BC-5:

| Family | Tables | Purpose | Multi-Supplier? | Stock Tracking? |
|---|---|---|---|---|
| **Original** | `parts`, `stock` | Basic parts catalog + quantity tracking | No (`primarySupplierId` single FK) | Yes (separate `stock` table) |
| **Modernized** | `partsInventory`, `partsInventorySuppliers` | Full inventory with multi-supplier pricing | Yes (join table) | Yes (inline `quantityInStock`) |
| **Simplified** | `inventoryParts` | Links parts to work orders | No | No |

**Recommendation (Task #8)**: Consolidate into the `partsInventory` + `partsInventorySuppliers` family as the canonical model. Migrate data from `parts`/`stock`, update all references, then drop the legacy tables. `inventoryParts` should become a view or be merged into `workOrderParts`.

---

## 5. Migration Roadmap

### Phase 0: Prerequisites
- [Task #7] This document
- [Task #8] Inventory schema consolidation (merge 3 duplicate part table families)
- [Task #9] Fleet Registry hexagonal module extraction

### Phase 1: Fleet Registry Module (Task #9)

**Extract to**: `server/modules/fleet-registry/`

**Pattern**: Follow existing hexagonal architecture in `server/routes/equipment-context/`

**Structure**:
```
server/modules/fleet-registry/
├── domain/
│   ├── entities/          # Organization, Vessel, User value objects
│   └── ports/             # Repository interfaces
├── application/
│   └── services/          # OrganizationService, VesselService
├── infrastructure/
│   └── repositories/      # Drizzle implementations
└── interfaces/
    └── http/              # Express route handlers
```

**Tables moved**: `organizations`, `users`, `systemSettings`, `emailSettings`, `metricsHistory`, `dbSchemaVersion`, `vessels`, `weatherCache`, `portCall`, `drydockWindow`, `stormgeoSettings`, `stormgeoSnapshots`, `stormgeoImportHistory`

**API surface**: All routes currently under `/api/organizations/*`, `/api/vessels/*`, `/api/weather/*`, `/api/port-calls/*`, `/api/drydock/*`, `/api/stormgeo/*`

**Why first**: BC-1 has no outbound FKs to other contexts — it only _receives_ references. Every other context depends on `organizations.id` and `vessels.id`, so extracting BC-1 first and establishing stable interfaces de-risks all subsequent extractions.

### Phase 2: Crew & Compliance

**Extract to**: `server/modules/crew-compliance/`

**Dependencies**: BC-1 (Fleet Registry) must be stable.

**Tables**: All `crew*` tables, `skills`, `crewSkill`, `shiftTemplate`, `crewAssignment`, all `compliance*` tables, logbook tables, `schedulingSettings`.

**Cross-boundary contract**: Needs `organizationId` and `vesselId` lookups from Fleet Registry. No other context depends on Crew tables (alerts reference crew indirectly through vessel-scoped settings).

### Phase 3: Inventory & Procurement

**Prerequisites**: Task #8 (schema consolidation) must be complete.

**Extract to**: `server/modules/inventory/`

**Tables**: Consolidated `partsInventory` family, `suppliers`, `partSubstitutions`, `inventoryMovements`, purchasing tables.

**Cross-boundary contract**: Needs `organizationId` from Fleet Registry. Provides parts data to Asset & Maintenance (work order parts).

### Phase 4: Telemetry & Sensing

**Extract to**: `server/modules/telemetry/`

**Tables**: All `equipmentTelemetry*`, `rawTelemetry*`, `telemetryRetention*`, `telemetryRollups`, `telemetryAggregates`, `j1939Configurations`, `dailyMetricRollups`, `engineerOverrides`, all `sensor*` tables, `equipmentHeartbeat`, `telemetryBatchAck`, `telemetrySchemaRegistry`.

**Cross-boundary contract**: Needs `equipmentId` and `deviceId` from Asset context, `vesselId` from Fleet Registry. Publishes telemetry events consumed by Alerts and ML contexts.

**Note**: This is the highest-volume context (TimescaleDB hypertables). Consider dedicated connection pool and async event publishing.

### Phase 5: Asset & Maintenance

**Extract to**: `server/modules/asset-maintenance/`

**Tables**: All `equipment*`, `devices`, `workOrders*`, `maintenance*`, `oilAnalysis`, `wearParticleAnalysis`, `conditionMonitoring`, `oilChangeRecords`, `downtimeEvents`, `partFailureHistory`, `operatingParameters`, `costs*`, `dtc*`.

**Cross-boundary contract**: Core domain — most other contexts reference equipment. Establish stable Equipment ID resolution service. Publishes work order lifecycle events.

**Why not earlier**: This is the largest context with the most inbound references. Extracting it before its consumers are decoupled would create excessive coupling.

### Phase 6: ML & Digital Twin

**Extract to**: `server/modules/ml-twin/`

**Tables**: All `mlModels*`, `modelVersions`, `anomalyDetections`, `failurePredictions`, `conditionDegradation`, `digitalTwins`, `twinSimulations`, training pipeline tables, feature store tables, optimizer tables.

**Cross-boundary contract**: Consumes telemetry events and equipment state. Publishes predictions and anomaly alerts. The `costSavings.predictionId` FK from BC-2 should be replaced with an event-driven pattern.

### Phase 7: Platform & Admin

**Extract to**: `server/modules/platform/`

**Tables**: All `admin*` tables, `roles`, `permission*` tables, `sync*` tables, `emailQueue`, `notificationQueue`, `errorLogs`, `softwarePatches`, `userSessions`, `loginEvents`, `emailTemplates`, `reportSchedules`, `generatedReports`.

**Note**: This is a cross-cutting concern. Many tables here (audit, RBAC, sync) serve as infrastructure for all other contexts. Consider keeping as a shared library rather than a standalone service, or split into Auth/RBAC service + Observability service.

### Phase 8: Alerts & Notifications (Last)

**Extract to**: `server/modules/alerts/`

**Tables**: All `alert*` tables, `crewAlertSettings`, `actionableInsights`.

**Why last**: Alerts is a pure consumer — it references equipment, vessels, work orders, and predictions from every other context. It must be extracted last, only after all upstream contexts have stable event interfaces and anti-corruption layers in place.

---

## 6. Extraction Principles

1. **Schema stays in `shared/schema/`** during module extraction. Only route handlers, services, and repository implementations move into `server/modules/`.
2. **Domain events over shared DB**: As modules stabilize, replace cross-boundary FKs with domain events (e.g., `EquipmentCreated`, `WorkOrderCompleted`, `PredictionGenerated`).
3. **Anti-corruption layers**: Each module's infrastructure layer should expose typed repository interfaces that hide Drizzle implementation details.
4. **Existing patterns**: Follow the hexagonal structure already established in `server/routes/equipment-context/` and `server/domain/scheduling/`.
5. **Incremental**: Each phase is independently deployable within the monolith. True service extraction (separate processes/containers) is a future phase.

---

## 7. Appendix: Complete Table-to-Context Mapping

| Table | Context | Schema File |
|---|---|---|
| `organizations` | BC-1 Fleet Registry | `core.ts` |
| `users` | BC-1 Fleet Registry | `core.ts` |
| `systemSettings` | BC-1 Fleet Registry | `core.ts` |
| `emailSettings` | BC-1 Fleet Registry | `core.ts` |
| `metricsHistory` | BC-1 Fleet Registry | `core.ts` |
| `dbSchemaVersion` | BC-1 Fleet Registry | `core.ts` |
| `vessels` | BC-1 Fleet Registry | `vessels.ts` |
| `weatherCache` | BC-1 Fleet Registry | `vessels.ts` |
| `portCall` | BC-1 Fleet Registry | `vessels.ts` |
| `drydockWindow` | BC-1 Fleet Registry | `vessels.ts` |
| `stormgeoSettings` | BC-1 Fleet Registry | `stormgeo.ts` |
| `stormgeoSnapshots` | BC-1 Fleet Registry | `stormgeo.ts` |
| `stormgeoImportHistory` | BC-1 Fleet Registry | `stormgeo.ts` |
| `equipment` | BC-2 Asset & Maintenance | `equipment.ts` |
| `devices` | BC-2 Asset & Maintenance | `equipment.ts` |
| `edgeHeartbeats` | BC-2 Asset & Maintenance | `equipment.ts` |
| `pdmScoreLogs` | BC-2 Asset & Maintenance | `equipment.ts` |
| `equipmentLifecycle` | BC-2 Asset & Maintenance | `equipment.ts` |
| `performanceMetrics` | BC-2 Asset & Maintenance | `equipment.ts` |
| `equipmentDecommissionEvents` | BC-2 Asset & Maintenance | `equipment.ts` |
| `downtimeEvents` | BC-2 Asset & Maintenance | `equipment.ts` |
| `partFailureHistory` | BC-2 Asset & Maintenance | `equipment.ts` |
| `industryBenchmarks` | BC-2 Asset & Maintenance | `equipment.ts` |
| `operatingParameters` | BC-2 Asset & Maintenance | `equipment.ts` |
| `operatingConditionAlerts` | BC-2 Asset & Maintenance | `equipment.ts` |
| `workOrders` | BC-2 Asset & Maintenance | `work-orders.ts` |
| `workOrderChecklists` | BC-2 Asset & Maintenance | `work-orders.ts` |
| `workOrderWorklogs` | BC-2 Asset & Maintenance | `work-orders.ts` |
| `workOrderTasks` | BC-2 Asset & Maintenance | `work-orders.ts` |
| `workOrderHistory` | BC-2 Asset & Maintenance | `work-orders.ts` |
| `workOrderParts` | BC-2 Asset & Maintenance | `work-orders.ts` |
| `workOrderEquipment` | BC-2 Asset & Maintenance | `work-orders.ts` |
| `workOrderCompletions` | BC-2 Asset & Maintenance | `work-orders.ts` |
| `maintenanceSchedules` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `maintenanceRecords` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `maintenanceCosts` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `maintenanceTemplates` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `maintenanceChecklistItems` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `maintenanceChecklistCompletions` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `oilAnalysis` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `wearParticleAnalysis` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `conditionMonitoring` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `oilChangeRecords` | BC-2 Asset & Maintenance | `maintenance.ts` |
| `laborRates` | BC-2 Asset & Maintenance | `costs.ts` |
| `expenses` | BC-2 Asset & Maintenance | `costs.ts` |
| `costModel` | BC-2 Asset & Maintenance | `costs.ts` |
| `costSavings` | BC-2 Asset & Maintenance | `costs.ts` |
| `dtcDefinitions` | BC-2 Asset & Maintenance | `dtc.ts` |
| `dtcFaults` | BC-2 Asset & Maintenance | `dtc.ts` |
| `equipmentTelemetry` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `telemetryDeadLetter` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `rawTelemetry` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `telemetryRetentionPolicies` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `telemetryRollups` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `telemetryAggregates` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `j1939Configurations` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `dailyMetricRollups` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `engineerOverrides` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `rawTelemetryArchive` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `equipmentHeartbeat` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `telemetryBatchAck` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `telemetrySchemaRegistry` | BC-3 Telemetry & Sensing | `telemetry.ts` |
| `sensorTypes` | BC-3 Telemetry & Sensing | `sensors.ts` |
| `sensorMapping` | BC-3 Telemetry & Sensing | `sensors.ts` |
| `discoveredSignals` | BC-3 Telemetry & Sensing | `sensors.ts` |
| `sensorConfigurations` | BC-3 Telemetry & Sensing | `sensors.ts` |
| `sensorStates` | BC-3 Telemetry & Sensing | `sensors.ts` |
| `sensorTemplates` | BC-3 Telemetry & Sensing | `sensors.ts` |
| `sensorBundles` | BC-3 Telemetry & Sensing | `sensors.ts` |
| `sensorThresholds` | BC-3 Telemetry & Sensing | `sensors.ts` |
| `mqttDevices` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `deviceRegistry` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `transportSettings` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `edgeDiagnosticLogs` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `transportFailovers` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `serialPortStates` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `calibrationCache` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `calibrationCurves` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `dataQualityMetrics` | BC-3 Telemetry & Sensing | `iot-edge.ts` |
| `crew` | BC-4 Crew & Compliance | `crew.ts` |
| `crewEmploymentHistory` | BC-4 Crew & Compliance | `crew.ts` |
| `crewNotificationSettings` | BC-4 Crew & Compliance | `crew.ts` |
| `skills` | BC-4 Crew & Compliance | `crew.ts` |
| `crewSkill` | BC-4 Crew & Compliance | `crew.ts` |
| `crewLeave` | BC-4 Crew & Compliance | `crew.ts` |
| `shiftTemplate` | BC-4 Crew & Compliance | `crew.ts` |
| `crewAssignment` | BC-4 Crew & Compliance | `crew.ts` |
| `crewCertification` | BC-4 Crew & Compliance | `crew.ts` |
| `crewDocuments` | BC-4 Crew & Compliance | `crew.ts` |
| `crewRestSheet` | BC-4 Crew & Compliance | `crew.ts` |
| `crewRestDay` | BC-4 Crew & Compliance | `crew.ts` |
| `complianceAuditLog` | BC-4 Crew & Compliance | `compliance.ts` |
| `complianceBundles` | BC-4 Crew & Compliance | `compliance.ts` |
| `immutableAuditTrail` | BC-4 Crew & Compliance | `compliance.ts` |
| `complianceDocs` | BC-4 Crew & Compliance | `compliance.ts` |
| `complianceFindings` | BC-4 Crew & Compliance | `compliance.ts` |
| `complianceRules` | BC-4 Crew & Compliance | `compliance.ts` |
| `schedulingSettings` | BC-4 Crew & Compliance | `scheduling-settings.ts` |
| `deckLogDaily` | BC-4 Crew & Compliance | `logbooks.ts` |
| `deckLogHourly` | BC-4 Crew & Compliance | `logbooks.ts` |
| `deckLogWatch` | BC-4 Crew & Compliance | `logbooks.ts` |
| `deckLogEvents` | BC-4 Crew & Compliance | `logbooks.ts` |
| `engineLogDaily` | BC-4 Crew & Compliance | `logbooks.ts` |
| `engineLogHourly` | BC-4 Crew & Compliance | `logbooks.ts` |
| `engineLogGenerator` | BC-4 Crew & Compliance | `logbooks.ts` |
| `engineLogWatch` | BC-4 Crew & Compliance | `logbooks.ts` |
| `engineLogEvents` | BC-4 Crew & Compliance | `logbooks.ts` |
| `deckLogHourlyAutoFill` | BC-4 Crew & Compliance | `logbooks.ts` |
| `fuelEmissionsLog` | BC-4 Crew & Compliance | `logbooks.ts` |
| `vesselTrackLog` | BC-4 Crew & Compliance | `logbooks.ts` |
| `conditionLogSummary` | BC-4 Crew & Compliance | `logbooks.ts` |
| `suppliers` | BC-5 Inventory & Procurement | `inventory.ts` |
| `parts` | BC-5 Inventory & Procurement | `inventory.ts` |
| `partsInventory` | BC-5 Inventory & Procurement | `inventory.ts` |
| `partsInventorySuppliers` | BC-5 Inventory & Procurement | `inventory.ts` |
| `stock` | BC-5 Inventory & Procurement | `inventory.ts` |
| `partSubstitutions` | BC-5 Inventory & Procurement | `inventory.ts` |
| `inventoryMovements` | BC-5 Inventory & Procurement | `inventory.ts` |
| `inventoryParts` | BC-5 Inventory & Procurement | `inventory.ts` |
| `reservations` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `purchaseOrders` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `purchaseOrderItems` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `purchaseOrderEvents` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `purchaseRequests` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `purchaseRequestItems` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `purchaseRequestEvents` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `itemSuppliers` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `serviceOrders` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `serviceOrderEvents` | BC-5 Inventory & Procurement | `purchasing.ts` |
| `alertConfigurations` | BC-6 Alerts & Notifications | `alerts.ts` |
| `alertNotifications` | BC-6 Alerts & Notifications | `alerts.ts` |
| `alertSuppressions` | BC-6 Alerts & Notifications | `alerts.ts` |
| `alertComments` | BC-6 Alerts & Notifications | `alerts.ts` |
| `actionableInsights` | BC-6 Alerts & Notifications | `alerts.ts` |
| `alertSettings` | BC-6 Alerts & Notifications | `alerts.ts` |
| `alertSettingsVessel` | BC-6 Alerts & Notifications | `alerts.ts` |
| `alertThresholds` | BC-6 Alerts & Notifications | `alerts.ts` |
| `alertEmailLog` | BC-6 Alerts & Notifications | `alerts.ts` |
| `crewAlertSettings` | BC-6 Alerts & Notifications | `alerts.ts` |
| `alertCooldown` | BC-6 Alerts & Notifications | `alerts.ts` |
| `mlModelsLegacy` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `mlModels` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `modelVersions` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `modelMetrics` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `anomalyDetections` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `failurePredictions` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `thresholdOptimizations` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `componentDegradation` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `failureHistory` | BC-7 ML & Digital Twin | `ml-analytics-core.ts` |
| `trainingDatasets` | BC-7 ML & Digital Twin | `ml-training-pipeline.ts` |
| `modelArtifacts` | BC-7 ML & Digital Twin | `ml-training-pipeline.ts` |
| `trainingRuns` | BC-7 ML & Digital Twin | `ml-training-pipeline.ts` |
| `equipmentFeatures` | BC-7 ML & Digital Twin | `pdm-feature-store.ts` |
| `fleetBaselines` | BC-7 ML & Digital Twin | `pdm-feature-store.ts` |
| `digitalTwins` | BC-7 ML & Digital Twin | `digital-twin.ts` |
| `twinSimulations` | BC-7 ML & Digital Twin | `digital-twin.ts` |
| `modelRegistry` | BC-7 ML & Digital Twin | `digital-twin.ts` |
| `visualizationAssets` | BC-7 ML & Digital Twin | `digital-twin.ts` |
| `arMaintenanceProcedures` | BC-7 ML & Digital Twin | `digital-twin.ts` |
| `modelPerformanceValidations` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `predictionFeedback` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `vibrationFeatures` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `rulModels` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `rulFitHistory` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `vibrationAnalysis` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `weibullEstimates` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `pdmBaseline` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `pdmAlerts` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `realTimePredictions` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `featureImportances` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `sensorFusionSnapshots` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `acousticEvents` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `modelDeployments` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `llmBudgetConfigs` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `retrainingTriggers` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `mlModelAccuracyHistory` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `predictionDataQuality` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `inferenceRuns` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `predictionExplanations` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `modelDriftMetrics` | BC-7 ML & Digital Twin | `ml-analytics-advanced.ts` |
| `optimizerConfigurations` | BC-7 ML & Digital Twin | `optimizer.ts` |
| `resourceConstraints` | BC-7 ML & Digital Twin | `optimizer.ts` |
| `optimizationResults` | BC-7 ML & Digital Twin | `optimizer.ts` |
| `scheduleOptimizations` | BC-7 ML & Digital Twin | `optimizer.ts` |
| `schedulerRuns` | BC-7 ML & Digital Twin | `optimizer.ts` |
| `scheduleAssignments` | BC-7 ML & Digital Twin | `optimizer.ts` |
| `scheduleUnfilled` | BC-7 ML & Digital Twin | `optimizer.ts` |
| `insightSnapshots` | BC-7 ML & Digital Twin | `insights.ts` |
| `insightReports` | BC-7 ML & Digital Twin | `insights.ts` |
| `llmCostTracking` | BC-7 ML & Digital Twin | `insights.ts` |
| `knowledgeBaseItems` | BC-7 ML & Digital Twin | `knowledge-base.ts` |
| `ragSearchQueries` | BC-7 ML & Digital Twin | `knowledge-base.ts` |
| `contentSources` | BC-7 ML & Digital Twin | `knowledge-base.ts` |
| `kbDocs` | BC-7 ML & Digital Twin | `rag.ts` |
| `kbChunks` | BC-7 ML & Digital Twin | `rag.ts` |
| `kbDocVersions` | BC-7 ML & Digital Twin | `rag.ts` |
| `kbEmbeddingCache` | BC-7 ML & Digital Twin | `rag.ts` |
| `ragConversations` | BC-7 ML & Digital Twin | `rag.ts` |
| `ragMessages` | BC-7 ML & Digital Twin | `rag.ts` |
| `ragFeedback` | BC-7 ML & Digital Twin | `rag.ts` |
| `ragSemanticCache` | BC-7 ML & Digital Twin | `rag.ts` |
| `adminAuditEvents` | BC-8 Platform & Admin | `admin.ts` |
| `adminSessions` | BC-8 Platform & Admin | `admin.ts` |
| `adminSystemSettings` | BC-8 Platform & Admin | `admin.ts` |
| `integrationConfigs` | BC-8 Platform & Admin | `admin.ts` |
| `maintenanceWindows` | BC-8 Platform & Admin | `admin.ts` |
| `systemPerformanceMetrics` | BC-8 Platform & Admin | `admin.ts` |
| `systemHealthChecks` | BC-8 Platform & Admin | `admin.ts` |
| `configAuditLog` | BC-8 Platform & Admin | `admin.ts` |
| `emailQueue` | BC-8 Platform & Admin | `admin.ts` |
| `notificationSettings` | BC-8 Platform & Admin | `admin.ts` |
| `notificationQueue` | BC-8 Platform & Admin | `admin.ts` |
| `auditRuns` | BC-8 Platform & Admin | `admin.ts` |
| `auditWebhookSubscriptions` | BC-8 Platform & Admin | `admin.ts` |
| `errorLogs` | BC-8 Platform & Admin | `admin.ts` |
| `softwarePatches` | BC-8 Platform & Admin | `admin.ts` |
| `updateSettings` | BC-8 Platform & Admin | `admin.ts` |
| `fleetUpdateStatus` | BC-8 Platform & Admin | `admin.ts` |
| `patchDownloads` | BC-8 Platform & Admin | `admin.ts` |
| `entityOffsets` | BC-8 Platform & Admin | `admin.ts` |
| `contextEvents` | BC-8 Platform & Admin | `admin.ts` |
| `userSessions` | BC-8 Platform & Admin | `admin.ts` |
| `loginEvents` | BC-8 Platform & Admin | `admin.ts` |
| `roles` | BC-8 Platform & Admin | `permissions.ts` |
| `permissionResources` | BC-8 Platform & Admin | `permissions.ts` |
| `permissionActions` | BC-8 Platform & Admin | `permissions.ts` |
| `resourceActions` | BC-8 Platform & Admin | `permissions.ts` |
| `permissionGrants` | BC-8 Platform & Admin | `permissions.ts` |
| `roleTemplates` | BC-8 Platform & Admin | `permissions.ts` |
| `permissionAuditLog` | BC-8 Platform & Admin | `permissions.ts` |
| `userRoleAssignments` | BC-8 Platform & Admin | `permissions.ts` |
| `syncJournal` | BC-8 Platform & Admin | `sync.ts` |
| `syncOutbox` | BC-8 Platform & Admin | `sync.ts` |
| `requestIdempotency` | BC-8 Platform & Admin | `sync.ts` |
| `idempotencyLog` | BC-8 Platform & Admin | `sync.ts` |
| `replayIncoming` | BC-8 Platform & Admin | `sync.ts` |
| `sheetLock` | BC-8 Platform & Admin | `sync.ts` |
| `sheetVersion` | BC-8 Platform & Admin | `sync.ts` |
| `emailTemplates` | BC-8 Platform & Admin | `email-templates.ts` |
| `reportSchedules` | BC-8 Platform & Admin | `scheduled-reports.ts` |
| `generatedReports` | BC-8 Platform & Admin | `scheduled-reports.ts` |
