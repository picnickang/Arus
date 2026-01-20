/**
 * Domain-Organized Schema Exports (Canonical Source)
 * 
 * Aggregates all domain schema modules. Import from this file for backward compatibility.
 */

export * from './base.js';
export * from './core.js';
export * from './sync.js';
export * from './vessels.js';
export * from './equipment.js';
export * from './work-orders.js';
export * from './alerts.js';
export * from './maintenance.js';
export * from './telemetry.js';
export * from './sensors.js';
export * from './inventory.js';
export * from './crew.js';
export * from './compliance.js';
export * from './ml-analytics.js';
export * from './iot-edge.js';
export * from './knowledge-base.js';
export * from './rag.js';
export * from './insights.js';
export * from './optimizer.js';
export * from './permissions.js';
export * from './email-templates.js';
export * from './logbooks.js';
export * from './admin.js';
export * from './costs.js';
export * from './dtc.js';
export * from './scheduling-settings.js';
export * from './purchasing.js';
export * from './stormgeo.js';

import * as core from './core.js';
import * as purchasing from './purchasing.js';
import * as sync from './sync.js';
import * as vessels from './vessels.js';
import * as equipment from './equipment.js';
import * as workOrders from './work-orders.js';
import * as alerts from './alerts.js';
import * as maintenance from './maintenance.js';
import * as telemetry from './telemetry.js';
import * as sensors from './sensors.js';
import * as inventory from './inventory.js';
import * as crew from './crew.js';
import * as compliance from './compliance.js';
import * as mlCore from './ml-analytics-core.js';
import * as mlAdvanced from './ml-analytics-advanced.js';
import * as iotEdge from './iot-edge.js';
import * as kb from './knowledge-base.js';
import * as rag from './rag.js';
import * as insights from './insights.js';
import * as optimizer from './optimizer.js';
import * as permissions from './permissions.js';
import * as telemetryMod from './telemetry.js';

export const CoreSchema = { ...core };
export const SyncSchema = { ...sync };
export const VesselsSchema = { ...vessels };
export const EquipmentSchema = { ...equipment };
export const WorkOrderSchema = { ...workOrders };
export const AlertSchema = { ...alerts };
export const MaintenanceSchema = { ...maintenance };
export const TelemetrySchema = { ...telemetry };
export const SensorSchema = { ...sensors };
export const InventorySchema = { ...inventory };
export const CrewSchema = { ...crew };
export const ComplianceSchema = { ...compliance };
export const MlAnalyticsCoreSchema = { ...mlCore };
export const MlAnalyticsAdvancedSchema = { ...mlAdvanced };
export const MlAnalyticsSchema = { ...mlCore, ...mlAdvanced };
export const IoTEdgeSchema = { ...iotEdge };
export const KnowledgeBaseSchema = { ...kb };
export const RagSchema = { ...rag };
export const InsightsSchema = { ...insights };
export const OptimizerSchema = { ...optimizer };
export const PermissionsSchema = { ...permissions };
export const PurchasingSchema = { ...purchasing };

export const MLSchema = {
  ...mlCore,
  ...mlAdvanced,
};

export const SettingsSchema = {
  systemSettings: core.systemSettings,
  metricsHistory: core.metricsHistory,
  dbSchemaVersion: core.dbSchemaVersion,
  transportSettings: iotEdge.transportSettings,
  edgeDiagnosticLogs: iotEdge.edgeDiagnosticLogs,
  transportFailovers: iotEdge.transportFailovers,
  serialPortStates: iotEdge.serialPortStates,
  telemetryRetentionPolicies: telemetryMod.telemetryRetentionPolicies,
  requestIdempotency: sync.requestIdempotency,
  insertSettingsSchema: core.insertSettingsSchema,
  insertTransportSettingsSchema: iotEdge.insertTransportSettingsSchema,
  insertEdgeDiagnosticLogSchema: iotEdge.insertEdgeDiagnosticLogSchema,
  insertTransportFailoverSchema: iotEdge.insertTransportFailoverSchema,
  insertSerialPortStateSchema: iotEdge.insertSerialPortStateSchema,
  insertTelemetryRetentionPolicySchema: telemetryMod.insertTelemetryRetentionPolicySchema,
  insertRequestIdempotencySchema: sync.insertRequestIdempotencySchema,
};

export type DomainName = 
  | 'core' | 'sync' | 'vessels' | 'equipment' | 'work-orders'
  | 'alerts' | 'maintenance' | 'telemetry' | 'sensors' | 'inventory'
  | 'crew' | 'compliance' | 'ml-analytics' | 'ml' | 'iot-edge' | 'knowledge-base'
  | 'rag' | 'insights' | 'optimizer' | 'permissions' | 'settings' | 'purchasing';

export const SchemaDomains: Record<DomainName, object> = {
  'core': CoreSchema,
  'sync': SyncSchema,
  'vessels': VesselsSchema,
  'equipment': EquipmentSchema,
  'work-orders': WorkOrderSchema,
  'alerts': AlertSchema,
  'maintenance': MaintenanceSchema,
  'telemetry': TelemetrySchema,
  'sensors': SensorSchema,
  'inventory': InventorySchema,
  'crew': CrewSchema,
  'compliance': ComplianceSchema,
  'ml-analytics': MlAnalyticsSchema,
  'ml': MLSchema,
  'iot-edge': IoTEdgeSchema,
  'knowledge-base': KnowledgeBaseSchema,
  'rag': RagSchema,
  'insights': InsightsSchema,
  'optimizer': OptimizerSchema,
  'permissions': PermissionsSchema,
  'settings': SettingsSchema,
  'purchasing': PurchasingSchema,
};
