import { z } from "zod";

export const requestIdSchema = z.string().min(1, "Request ID is required");
export const idempotencyKeySchema = z.string().min(1, "Idempotency key is required");
export const vesselIdSchema = z.string().min(1, "Vessel ID is required");
export const crewIdSchema = z.string().min(1, "Crew ID is required");

export const equipmentIdQuerySchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
});

export const optionalEquipmentIdQuerySchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID must be non-empty").optional(),
});

export const vesselQuerySchema = z.object({
  vessel_id: z.string().min(1, "Vessel ID must be non-empty").optional(),
  org_id: z.string().min(1, "Organization ID must be non-empty").optional(),
});

export const crewQuerySchema = z.object({
  crew_id: z.string().min(1, "Crew ID must be non-empty").optional(),
  vessel_id: z.string().min(1, "Vessel ID must be non-empty").optional(),
});

export const timeRangeQuerySchema = z.object({
  dateFrom: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "dateFrom must be a valid date",
    }),
  dateTo: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "dateTo must be a valid date",
    }),
  hours: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 24))
    .pipe(z.number().int().min(1).max(8760, "Hours must be between 1 and 8760 (1 year)")),
  days: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 30))
    .pipe(z.number().int().min(1).max(365, "Days must be between 1 and 365")),
  months: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 12))
    .pipe(z.number().int().min(1).max(60, "Months must be between 1 and 60")),
});

export const horQuerySchema = z.object({
  crew_id: z.string().min(1, "Crew ID is required"),
  year: z
    .string()
    .transform((val) => Number.parseInt(val))
    .pipe(z.number().int().min(2020).max(2030, "Year must be between 2020 and 2030")),
  month: z.enum([
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ]),
});

export const rangeQuerySchema = z.object({
  vesselId: z.string().min(1, "Vessel ID is required").optional(),
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "startDate must be a valid ISO date string",
    }),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "endDate must be a valid ISO date string",
    }),
  complianceFilter: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
});

export const statusQuerySchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled", "scheduled"]).optional(),
  type: z
    .enum([
      "preventive",
      "corrective",
      "predictive",
      "all",
      "fleet",
      "health",
      "maintenance",
      "workorders",
      "telemetry",
    ])
    .optional(),
  costType: z.enum(["labor", "parts", "equipment", "downtime"]).optional(),
  priority: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : undefined))
    .pipe(z.number().int().min(1).max(3, "Priority must be 1, 2, or 3").optional()),
});

export const telemetryQuerySchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required").optional(),
  sensorType: z.string().min(1, "Sensor type is required").optional(),
  hours: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 24))
    .pipe(z.number().int().min(1).max(8760, "Hours must be between 1 and 8760")),
  threshold: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseFloat(val) : 2))
    .pipe(z.number().min(0.1).max(10, "Threshold must be between 0.1 and 10")),
});

export const paginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 100))
    .pipe(z.number().int().min(1).max(1000, "Limit must be between 1 and 1000")),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 0))
    .pipe(z.number().int().min(0, "Offset must be non-negative")),
});

export const equipmentAnalyticsQuerySchema = equipmentIdQuerySchema
  .merge(timeRangeQuerySchema)
  .merge(statusQuerySchema);
export const fleetManagementQuerySchema = vesselQuerySchema
  .merge(timeRangeQuerySchema)
  .merge(paginationQuerySchema);
export const maintenanceQuerySchema = equipmentIdQuerySchema
  .merge(timeRangeQuerySchema)
  .merge(statusQuerySchema);
export const performanceQuerySchema = equipmentIdQuerySchema
  .merge(timeRangeQuerySchema)
  .merge(telemetryQuerySchema.partial());
