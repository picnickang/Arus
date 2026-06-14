/**
 * Schema Equipment - Equipment Registry, Devices, and Lifecycle
 *
 * Central equipment catalog, edge devices, and lifecycle tracking.
 */

import { createInsertSchema, z } from "./base";
import {
  devices,
  edgeHeartbeats,
  equipment,
  equipmentDecommissionEvents,
  equipmentLifecycle,
  pdmScoreLogs,
  performanceMetrics,
} from "./equipment/core";
import {
  downtimeEvents,
  industryBenchmarks,
  operatingConditionAlerts,
  operatingParameters,
  partFailureHistory,
} from "./equipment/analytics";

export * from "./equipment/core";
export * from "./equipment/analytics";

// Insert schemas
export const insertEquipmentSchema = createInsertSchema(equipment)
  .omit({ id: true, createdAt: true, updatedAt: true, hierarchyLevel: true, hierarchyPath: true })
  .extend({
    vesselId: z.string().uuid().optional(),
    vesselName: z.string().optional(),
  });

export const insertDeviceSchema = createInsertSchema(devices).omit({ updatedAt: true });
export const insertHeartbeatSchema = createInsertSchema(edgeHeartbeats).omit({ ts: true });
export const insertPdmScoreSchema = createInsertSchema(pdmScoreLogs).omit({ id: true, ts: true });

export const insertEquipmentLifecycleSchema = createInsertSchema(equipmentLifecycle).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceMetricSchema = createInsertSchema(performanceMetrics)
  .omit({ id: true, createdAt: true })
  .extend({
    metricType: z.enum(["efficiency", "reliability", "availability", "mtbf", "mttr"]),
  });

export const decommissionReasonEnum = z.enum([
  "sold",
  "scrapped",
  "replaced",
  "end_of_life",
  "transferred",
  "damaged_beyond_repair",
]);

export const decommissionStatusEnum = z.enum([
  "active",
  "pending_decommission",
  "decommissioned",
  "disposed",
  "sold",
]);

export const saleDetailsSchema = z.object({
  salePrice: z.number().optional(),
  currency: z.string().optional(),
  buyerName: z.string().optional(),
  buyerContact: z.string().optional(),
  saleDate: z.string().optional(),
  invoiceRef: z.string().optional(),
});

export const disposalDetailsSchema = z.object({
  method: z.string().optional(),
  vendor: z.string().optional(),
  cost: z.number().optional(),
  environmentalNotes: z.string().optional(),
  certificationRef: z.string().optional(),
});

export const insertDecommissionEventSchema = createInsertSchema(equipmentDecommissionEvents)
  .omit({ id: true, createdAt: true })
  .extend({
    reason: decommissionReasonEnum,
    saleDetails: saleDetailsSchema.optional(),
    disposalDetails: disposalDetailsSchema.optional(),
    documentationRefs: z.array(z.string()).optional(),
  });

// Equipment analytics insert schemas
export const insertDowntimeEventSchema = createInsertSchema(downtimeEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartFailureHistorySchema = createInsertSchema(partFailureHistory).omit({
  id: true,
  createdAt: true,
});

export const insertIndustryBenchmarkSchema = createInsertSchema(industryBenchmarks).omit({
  id: true,
  createdAt: true,
});

export const insertOperatingParameterSchema = createInsertSchema(operatingParameters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOperatingConditionAlertSchema = createInsertSchema(
  operatingConditionAlerts
).omit({ id: true, alertedAt: true });

// Types
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type EdgeHeartbeat = typeof edgeHeartbeats.$inferSelect;
export type InsertEdgeHeartbeat = z.infer<typeof insertHeartbeatSchema>;
export type PdmScoreLog = typeof pdmScoreLogs.$inferSelect;
export type InsertPdmScoreLog = z.infer<typeof insertPdmScoreSchema>;
export type EquipmentLifecycle = typeof equipmentLifecycle.$inferSelect;
export type InsertEquipmentLifecycle = z.infer<typeof insertEquipmentLifecycleSchema>;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = z.infer<typeof insertPerformanceMetricSchema>;
export type EquipmentDecommissionEvent = typeof equipmentDecommissionEvents.$inferSelect;
export type InsertDecommissionEvent = z.infer<typeof insertDecommissionEventSchema>;
export type DecommissionReason = z.infer<typeof decommissionReasonEnum>;
export type DecommissionStatus = z.infer<typeof decommissionStatusEnum>;
export type SaleDetails = z.infer<typeof saleDetailsSchema>;
export type DisposalDetails = z.infer<typeof disposalDetailsSchema>;

// Equipment analytics types
export type DowntimeEvent = typeof downtimeEvents.$inferSelect;
export type InsertDowntimeEvent = z.infer<typeof insertDowntimeEventSchema>;
export type PartFailureHistory = typeof partFailureHistory.$inferSelect;
export type InsertPartFailureHistory = z.infer<typeof insertPartFailureHistorySchema>;
export type IndustryBenchmark = typeof industryBenchmarks.$inferSelect;
export type InsertIndustryBenchmark = z.infer<typeof insertIndustryBenchmarkSchema>;
export type OperatingParameter = typeof operatingParameters.$inferSelect;
export type InsertOperatingParameter = z.infer<typeof insertOperatingParameterSchema>;
export type OperatingConditionAlert = typeof operatingConditionAlerts.$inferSelect;
export type InsertOperatingConditionAlert = z.infer<typeof insertOperatingConditionAlertSchema>;
