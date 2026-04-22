import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const orgIdSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required"),
});

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const equipmentIdParamSchema = z.object({
  equipmentId: uuidSchema,
});

export const vesselIdParamSchema = z.object({
  vesselId: uuidSchema,
});

export const workOrderIdParamSchema = z.object({
  workOrderId: uuidSchema,
});

export const sensorTypeSchema = z.string().min(1).max(100);

export const prioritySchema = z.enum(["critical", "high", "medium", "low", "minimal"]);

export const statusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);

export const sortOrderSchema = z.enum(["asc", "desc"]).optional().default("desc");

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeValidateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export const commonQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema,
  ...paginationSchema.shape,
});

export const equipmentQuerySchema = z.object({
  vesselId: uuidSchema.optional(),
  type: z.string().optional(),
  status: z.enum(["active", "inactive", "maintenance"]).optional(),
  ...commonQuerySchema.shape,
});

export const workOrderQuerySchema = z.object({
  equipmentId: uuidSchema.optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  assignedTo: uuidSchema.optional(),
  ...dateRangeSchema.shape,
  ...commonQuerySchema.shape,
});

export const crewQuerySchema = z.object({
  vesselId: uuidSchema.optional(),
  role: z.string().optional(),
  status: z.enum(["active", "inactive", "on_leave"]).optional(),
  ...commonQuerySchema.shape,
});

export const inventoryQuerySchema = z.object({
  category: z.string().optional(),
  lowStock: z.coerce.boolean().optional(),
  equipmentId: uuidSchema.optional(),
  ...commonQuerySchema.shape,
});

export const alertQuerySchema = z.object({
  equipmentId: uuidSchema.optional(),
  severity: z.enum(["critical", "warning", "info"]).optional(),
  acknowledged: z.coerce.boolean().optional(),
  ...dateRangeSchema.shape,
  ...commonQuerySchema.shape,
});

export const telemetryQuerySchema = z.object({
  equipmentId: uuidSchema.optional(),
  sensorType: z.string().optional(),
  hours: z.coerce.number().min(1).max(720).optional().default(24),
  ...dateRangeSchema.shape,
});

export const booleanToggleSchema = z.union([
  z.boolean(),
  z.string().transform((val) => val === "true" || val === "1"),
]);

export const datePresetSchema = z.enum([
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "custom",
]);

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  direction: z.enum(["forward", "backward"]).optional().default("forward"),
});

export const maintenanceScheduleBodySchema = z.object({
  equipmentId: uuidSchema,
  scheduledDate: z.coerce.date(),
  type: z.string().min(1),
  description: z.string().optional(),
  priority: prioritySchema.optional(),
  estimatedDuration: z.number().positive().optional(),
  assignedTo: uuidSchema.optional(),
});

export const mlJobBodySchema = z.object({
  equipmentId: uuidSchema.optional(),
  modelType: z.enum(["lstm", "xgboost", "random_forest", "ensemble"]),
  windowDays: z.number().min(1).max(365).optional().default(30),
  features: z.array(z.string()).optional(),
  hyperparameters: z.record(z.unknown()).optional(),
});

export const workOrderCreateSchema = z.object({
  equipmentId: uuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: prioritySchema,
  status: statusSchema.optional().default("pending"),
  assignedTo: uuidSchema.optional(),
  dueDate: z.coerce.date().optional(),
  estimatedHours: z.number().positive().optional(),
  templateId: uuidSchema.optional(),
});

export const alertConfigSchema = z.object({
  equipmentId: uuidSchema,
  sensorType: z.string().min(1),
  alertType: z.enum(["threshold", "rate_of_change", "pattern", "anomaly"]),
  severity: z.enum(["critical", "warning", "info"]),
  enabled: z.boolean().default(true),
  thresholdMin: z.number().optional(),
  thresholdMax: z.number().optional(),
  cooldownMinutes: z.number().min(0).max(1440).optional().default(15),
  notificationChannels: z.array(z.enum(["email", "sms", "push", "webhook"])).optional(),
});

export const crewMemberSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(50),
  vesselId: uuidSchema.optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "on_leave"]).optional().default("active"),
});

export const logbookEntrySchema = z.object({
  vesselId: uuidSchema,
  entryType: z.string().min(1),
  timestamp: z.coerce.date(),
  shift: z.enum(["morning", "afternoon", "night"]).optional(),
  content: z.string().min(1),
  weather: z
    .object({
      windSpeed: z.number().optional(),
      windDirection: z.string().optional(),
      seaState: z.string().optional(),
      visibility: z.string().optional(),
      temperature: z.number().optional(),
    })
    .optional(),
  position: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

export const multiFieldFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains", "startsWith"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

export const advancedQuerySchema = z.object({
  filters: z.array(multiFieldFilterSchema).optional(),
  sort: z
    .array(
      z.object({
        field: z.string(),
        order: z.enum(["asc", "desc"]),
      })
    )
    .optional(),
  ...paginationSchema.shape,
});

type DatePresetCalculator = (now: Date, endDate: Date) => { startDate: Date; endDate: Date };

const datePresetCalculators: Record<string, DatePresetCalculator> = {
  today: (now, endDate) => ({
    startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    endDate,
  }),
  yesterday: (now) => {
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 1);
    return { startDate, endDate };
  },
  last7days: (now, endDate) => ({
    startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    endDate,
  }),
  last30days: (now, endDate) => ({
    startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    endDate,
  }),
  thisMonth: (now, endDate) => ({
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate,
  }),
  lastMonth: (now) => {
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now);
    endDate.setDate(0);
    return { startDate, endDate };
  },
  thisYear: (now, endDate) => ({ startDate: new Date(now.getFullYear(), 0, 1), endDate }),
};

export function parseDatePreset(preset: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  const calculator = datePresetCalculators[preset];
  if (calculator) {
    return calculator(now, endDate);
  }
  return { startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), endDate };
}

export const compoundCursorSchema = z.object({
  timestamp: z.coerce.date(),
  id: uuidSchema,
});

export const multiDimensionalPaginationSchema = z.object({
  cursor: z
    .object({
      primary: z.string(),
      secondary: z.string().optional(),
    })
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  direction: z.enum(["forward", "backward"]).default("forward"),
  sortFields: z
    .array(
      z.object({
        field: z.string(),
        order: z.enum(["asc", "desc"]),
      })
    )
    .optional(),
});

export const alertSeverityEnum = z.enum(["critical", "warning", "info"]);
export const alertTypeEnum = z.enum([
  "threshold",
  "rate_of_change",
  "pattern",
  "anomaly",
  "predictive",
]);
export const telemetryModeEnum = z.enum(["realtime", "batch", "simulation", "replay"]);
export const operatingModeEnum = z.enum([
  "underway",
  "maneuvering",
  "anchored",
  "moored",
  "standby",
  "off",
]);

export const mlThresholdPayloadSchema = z.object({
  equipmentId: uuidSchema,
  sensorType: z.string().min(1),
  thresholds: z.object({
    warning: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }),
    critical: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }),
  }),
  confidenceLevel: z.number().min(0).max(1).optional().default(0.95),
  calibrationData: z.record(z.unknown()).optional(),
});

export const stcwRestDaySchema = z.object({
  crewId: uuidSchema,
  date: z.coerce.date(),
  hours: z
    .array(
      z.object({
        start: z.number().min(0).max(23),
        end: z.number().min(1).max(24),
        type: z.enum(["work", "rest"]),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

export const stcwSubmissionSchema = z.object({
  crewId: uuidSchema,
  month: z.string().regex(/^\d{4}-\d{2}$/, "Must be in YYYY-MM format"),
  restDays: z.array(stcwRestDaySchema),
  submittedBy: z.string().optional(),
  attestation: z.boolean().default(false),
});

export const crewCertificationSubmitSchema = z.object({
  crewId: uuidSchema,
  certificationType: z.string().min(1),
  certificateNumber: z.string().optional(),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  issuingAuthority: z.string().optional(),
  documentUrl: z.string().url().optional(),
});

export const telemetryIngestionSchema = z.object({
  equipmentId: uuidSchema,
  sensorType: z.string().min(1),
  value: z.number(),
  timestamp: z.coerce.date().optional(),
  unit: z.string().optional(),
  quality: z.number().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const batchTelemetrySchema = z.object({
  readings: z.array(telemetryIngestionSchema).min(1).max(10000),
  deviceId: z.string().optional(),
  batchId: z.string().optional(),
});

export const notificationCreateSchema = z.object({
  type: z.enum(["email", "sms", "push", "webhook"]),
  recipient: z.string().min(1),
  subject: z.string().optional(),
  content: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  templateId: z.string().optional(),
  variables: z.record(z.string()).optional(),
});

export const complianceFindingSchema = z.object({
  ruleId: z.string().min(1),
  entityType: z.enum(["vessel", "equipment", "crew", "document", "procedure"]),
  entityId: uuidSchema,
  severity: z.enum(["critical", "major", "minor"]),
  description: z.string().min(1),
  evidence: z.array(z.string()).optional(),
  remediation: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

export const costSavingsRecordSchema = z.object({
  category: z.enum([
    "preventive_maintenance",
    "fuel_efficiency",
    "downtime_prevention",
    "labor_optimization",
    "parts_optimization",
    "compliance",
  ]),
  amount: z.number().positive(),
  description: z.string().min(1),
  equipmentId: uuidSchema.optional(),
  workOrderId: uuidSchema.optional(),
  calculationMethod: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export function createValidatedHandler<TBody, TQuery, TParams>(
  bodySchema?: z.ZodSchema<TBody>,
  querySchema?: z.ZodSchema<TQuery>,
  paramsSchema?: z.ZodSchema<TParams>
) {
  return function validateRequest(req: { body?: unknown; query?: unknown; params?: unknown }): {
    body?: TBody;
    query?: TQuery;
    params?: TParams;
  } {
    return {
      body: bodySchema ? bodySchema.parse(req.body) : undefined,
      query: querySchema ? querySchema.parse(req.query) : undefined,
      params: paramsSchema ? paramsSchema.parse(req.params) : undefined,
    };
  };
}
