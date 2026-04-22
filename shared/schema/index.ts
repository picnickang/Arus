/**
 * Domain-Organized Schema Exports (Canonical Source)
 *
 * Aggregates all domain schema modules. Import from this file for backward compatibility.
 */

export * from "./base";
export * from "./core";
export * from "./sync";
export * from "./vessels";
export * from "./equipment";
export * from "./work-orders";
export * from "./alerts";
export * from "./maintenance";
export * from "./telemetry";
export * from "./sensors";
export * from "./inventory";
export * from "./crew";
export * from "./compliance";
export * from "./ml-analytics";
export * from "./iot-edge";
export * from "./knowledge-base";
export * from "./rag";
export * from "./insights";
export * from "./optimizer";
export * from "./permissions";
export * from "./email-templates";
export * from "./logbooks";
export * from "./admin";
export * from "./costs";
export * from "./dtc";
export * from "./scheduling-settings";
export * from "./purchasing";
export * from "./stormgeo";
export * from "./pdm-feature-store";
export * from "./digital-twin";
export * from "./agent";
export * from "./external-data-cache";
export * from "./certificates";
export * from "./diagnostic-runs";
export * from "./import-manifest";

import * as core from "./core";
import * as purchasing from "./purchasing";
import * as sync from "./sync";
import * as vessels from "./vessels";
import * as equipment from "./equipment";
import * as workOrders from "./work-orders";
import * as alerts from "./alerts";
import * as maintenance from "./maintenance";
import * as telemetry from "./telemetry";
import * as sensors from "./sensors";
import * as inventory from "./inventory";
import * as crew from "./crew";
import * as compliance from "./compliance";
import * as mlCore from "./ml-analytics-core";
import * as mlAdvanced from "./ml-analytics-advanced";
import * as pdmFeatureStore from "./pdm-feature-store";
import * as digitalTwin from "./digital-twin";
import * as iotEdge from "./iot-edge";
import * as kb from "./knowledge-base";
import * as rag from "./rag";
import * as insights from "./insights";
import * as optimizer from "./optimizer";
import * as permissions from "./permissions";
import * as telemetryMod from "./telemetry";
import * as agent from "./agent";
import * as certificates from "./certificates";

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
export const PdmFeatureStoreSchema = { ...pdmFeatureStore };
export const DigitalTwinSchema = { ...digitalTwin };
export const IoTEdgeSchema = { ...iotEdge };
export const KnowledgeBaseSchema = { ...kb };
export const RagSchema = { ...rag };
export const InsightsSchema = { ...insights };
export const OptimizerSchema = { ...optimizer };
export const PermissionsSchema = { ...permissions };
export const PurchasingSchema = { ...purchasing };
export const AgentSchema = { ...agent };
export const CertificatesSchema = { ...certificates };

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
  | "core"
  | "sync"
  | "vessels"
  | "equipment"
  | "work-orders"
  | "alerts"
  | "maintenance"
  | "telemetry"
  | "sensors"
  | "inventory"
  | "crew"
  | "compliance"
  | "ml-analytics"
  | "ml"
  | "iot-edge"
  | "knowledge-base"
  | "rag"
  | "insights"
  | "optimizer"
  | "permissions"
  | "settings"
  | "purchasing"
  | "digital-twin"
  | "agent"
  | "certificates";

export const SchemaDomains: Record<DomainName, object> = {
  core: CoreSchema,
  sync: SyncSchema,
  vessels: VesselsSchema,
  equipment: EquipmentSchema,
  "work-orders": WorkOrderSchema,
  alerts: AlertSchema,
  maintenance: MaintenanceSchema,
  telemetry: TelemetrySchema,
  sensors: SensorSchema,
  inventory: InventorySchema,
  crew: CrewSchema,
  compliance: ComplianceSchema,
  "ml-analytics": MlAnalyticsSchema,
  ml: MLSchema,
  "iot-edge": IoTEdgeSchema,
  "knowledge-base": KnowledgeBaseSchema,
  rag: RagSchema,
  insights: InsightsSchema,
  optimizer: OptimizerSchema,
  permissions: PermissionsSchema,
  settings: SettingsSchema,
  purchasing: PurchasingSchema,
  "digital-twin": DigitalTwinSchema,
  agent: AgentSchema,
  certificates: CertificatesSchema,
};
