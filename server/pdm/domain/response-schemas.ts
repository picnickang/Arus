import { z } from "zod";

const riskLevelSchema = z.enum(["critical", "high", "medium", "low"]);
const alertStatusSchema = z.enum(["new", "active", "acknowledged", "resolved"]);

const isoOrDateSchema = z.union([z.date(), z.string().datetime({ offset: true })]);

const evidenceChipSchema = z.object({
  label: z.string(),
  type: z.enum(["trend", "threshold", "anomaly", "pattern"]),
});

const rulConfidenceIntervalSchema = z.object({
  lowDays: z.number().finite(),
  highDays: z.number().finite(),
});

export const riskQueueItemSchema = z.object({
  id: z.string(),
  vesselId: z.string(),
  vesselName: z.string(),
  equipmentId: z.string(),
  equipmentName: z.string(),
  equipmentType: z.string(),
  failureMode: z.string(),
  severity: riskLevelSchema,
  rulEstimateDays: z.number().finite().nullable(),
  rulConfidenceInterval: rulConfidenceIntervalSchema.nullable().optional(),
  confidence: z.number().finite().min(0).max(100),
  recommendedAction: z.string(),
  evidenceChips: z.array(evidenceChipSchema).optional(),
  trendData: z.array(z.number().finite()).optional(),
  status: alertStatusSchema,
  detectedAt: isoOrDateSchema,
  acknowledgedAt: isoOrDateSchema.nullable().optional(),
  acknowledgedBy: z.string().nullable().optional(),
  resolvedAt: isoOrDateSchema.nullable().optional(),
  workOrderId: z.string().nullable().optional(),
});

const fleetHealthKpisSchema = z.object({
  fleetHealthScore: z.number().finite(),
  fleetHealthChange: z.number().finite(),
  fleetHealthPeriod: z.string(),
  activeAlertsTotal: z.number().int().nonnegative(),
  criticalAlertsCount: z.number().int().nonnegative(),
  assetsAtRisk: z.number().int().nonnegative(),
  assetsRulUnder14Days: z.number().int().nonnegative(),
  avoidedDowntimeHours: z.number().finite().nonnegative(),
  avoidedDowntimePeriod: z.string(),
  maintenanceForecastCost: z.number().finite().nonnegative(),
  maintenanceForecastPeriod: z.string(),
});

const telemetryCoverageSchema = z.object({
  onlineCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  delayedCount: z.number().int().nonnegative(),
  delayedEquipment: z.array(
    z.object({
      equipmentId: z.string(),
      equipmentName: z.string(),
      vesselName: z.string(),
      lastSeen: isoOrDateSchema,
      lastSeenAgo: z.string(),
    })
  ),
});

const modelHealthSchema = z.object({
  activeModelsCount: z.number().int().nonnegative(),
  driftAlertsCount: z.number().int().nonnegative(),
  lastTrainingDate: isoOrDateSchema.nullable(),
});

const maintenancePipelineSchema = z.object({
  openWorkOrdersCount: z.number().int().nonnegative(),
  awaitingApprovalCount: z.number().int().nonnegative(),
  inProgressCount: z.number().int().nonnegative(),
});

export const pdmDashboardResponseSchema = z.object({
  kpis: fleetHealthKpisSchema,
  riskQueue: z.object({
    new: z.array(riskQueueItemSchema),
    active: z.array(riskQueueItemSchema),
    resolved: z.array(riskQueueItemSchema),
  }),
  telemetryCoverage: telemetryCoverageSchema,
  modelHealth: modelHealthSchema,
  maintenancePipeline: maintenancePipelineSchema,
});

export const pdmFilterOptionsResponseSchema = z.object({
  vessels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }).passthrough()
  ),
  equipmentTypes: z.array(z.string()),
});

export const pdmRiskQueueResponseSchema = z.array(riskQueueItemSchema);

export type PdmDashboardResponse = z.infer<typeof pdmDashboardResponseSchema>;
export type PdmFilterOptionsResponse = z.infer<typeof pdmFilterOptionsResponseSchema>;
export type PdmRiskQueueResponse = z.infer<typeof pdmRiskQueueResponseSchema>;
