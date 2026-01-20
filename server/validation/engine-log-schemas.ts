import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid UUID format");
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");
const hourSchema = z.number().int().min(0).max(23);
const optionalNumber = z.number().optional().nullable();
const optionalPositiveNumber = z.number().min(0).optional().nullable();
const optionalString = z.string().optional().nullable();

export const engineLogDailyFiltersSchema = z.object({
  vesselId: uuidSchema.optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  status: z.enum(["open", "signed", "locked"]).optional(),
});

export const engineLogDailyIdSchema = z.object({
  id: uuidSchema,
});

export const vesselDateParamsSchema = z.object({
  vesselId: uuidSchema,
  logDate: isoDateSchema,
});

export const createEngineLogDailySchema = z.object({
  vesselId: uuidSchema,
  logDate: isoDateSchema,
  status: z.enum(["open", "signed", "locked"]).default("open"),
  meRunningHours: optionalPositiveNumber,
  dg1RunningHours: optionalPositiveNumber,
  dg2RunningHours: optionalPositiveNumber,
  dg3RunningHours: optionalPositiveNumber,
  hfoRob: optionalPositiveNumber,
  mdoRob: optionalPositiveNumber,
  loRob: optionalPositiveNumber,
  fwRob: optionalPositiveNumber,
  slopsRob: optionalPositiveNumber,
  bilgeRob: optionalPositiveNumber,
  hfoConsumption: optionalPositiveNumber,
  mdoConsumption: optionalPositiveNumber,
  loConsumption: optionalPositiveNumber,
  fwConsumption: optionalPositiveNumber,
  remarks: optionalString,
  weatherNotes: optionalString,
});

export const updateEngineLogDailySchema = z.object({
  status: z.enum(["open", "signed", "locked"]).optional(),
  meRunningHours: optionalPositiveNumber,
  dg1RunningHours: optionalPositiveNumber,
  dg2RunningHours: optionalPositiveNumber,
  dg3RunningHours: optionalPositiveNumber,
  hfoRob: optionalPositiveNumber,
  mdoRob: optionalPositiveNumber,
  loRob: optionalPositiveNumber,
  fwRob: optionalPositiveNumber,
  slopsRob: optionalPositiveNumber,
  bilgeRob: optionalPositiveNumber,
  hfoConsumption: optionalPositiveNumber,
  mdoConsumption: optionalPositiveNumber,
  loConsumption: optionalPositiveNumber,
  fwConsumption: optionalPositiveNumber,
  remarks: optionalString,
  weatherNotes: optionalString,
}).partial();

export const signEngineLogDailySchema = z.object({
  signedByCrewId: uuidSchema,
  signedByName: z.string().min(1, "Signer name required").max(200),
  signedByRank: z.string().min(1, "Signer rank required").max(100),
});

export const lockEngineLogDailySchema = z.object({
  lockedByUserId: z.string().min(1, "User ID required"),
  lockedByUserName: z.string().min(1, "User name required").max(200),
});

export const engineLogHourlySchema = z.object({
  dailyLogId: uuidSchema,
  hour: hourSchema,
  meRpm: optionalPositiveNumber,
  meLoad: z.number().min(0).max(150).optional().nullable(),
  meFuelRackPosition: z.number().min(0).max(100).optional().nullable(),
  meExhaustTempPort: optionalPositiveNumber,
  meExhaustTempStbd: optionalPositiveNumber,
  meScavAirPress: optionalPositiveNumber,
  meScavAirTemp: optionalPositiveNumber,
  meTurbochargerRpm: optionalPositiveNumber,
  meTurbochargerExhaustTemp: optionalPositiveNumber,
  meCoolantTempIn: optionalPositiveNumber,
  meCoolantTempOut: optionalPositiveNumber,
  meLubOilPress: optionalPositiveNumber,
  meLubOilTemp: optionalPositiveNumber,
  meFuelOilPress: optionalPositiveNumber,
  meFuelOilTemp: optionalPositiveNumber,
  meFuelOilViscosity: optionalPositiveNumber,
  seaWaterCoolingTemp: optionalPositiveNumber,
  freshWaterCoolingTemp: optionalPositiveNumber,
  airCompressorPress: optionalPositiveNumber,
  startingAirPress: optionalPositiveNumber,
  controlAirPress: optionalPositiveNumber,
  engineRoomTemp: optionalNumber,
  engineRoomHumidity: z.number().min(0).max(100).optional().nullable(),
  meRunningHours: optionalPositiveNumber,
  remarks: z.string().max(1000).optional().nullable(),
});

export const engineLogHourlyBulkSchema = z.object({
  entries: z.array(engineLogHourlySchema).min(1).max(24),
});

export const engineLogGeneratorSchema = z.object({
  dailyLogId: uuidSchema,
  generatorNumber: z.number().int().min(1).max(10),
  hour: hourSchema,
  running: z.boolean().optional(),
  loadKw: optionalPositiveNumber,
  loadPercent: z.number().min(0).max(150).optional().nullable(),
  voltage: optionalPositiveNumber,
  frequency: z.number().min(45).max(65).optional().nullable(),
  current: optionalPositiveNumber,
  powerFactor: z.number().min(0).max(1).optional().nullable(),
  exhaustTemp: optionalPositiveNumber,
  coolantTemp: optionalPositiveNumber,
  lubOilPress: optionalPositiveNumber,
  lubOilTemp: optionalPositiveNumber,
  fuelRackPosition: z.number().min(0).max(100).optional().nullable(),
  runningHours: optionalPositiveNumber,
  remarks: z.string().max(500).optional().nullable(),
});

export const engineLogGeneratorBulkSchema = z.object({
  entries: z.array(engineLogGeneratorSchema).min(1).max(100),
});

export const engineLogWatchSchema = z.object({
  dailyLogId: uuidSchema,
  watchPeriod: z.enum(["00-06", "06-12", "12-18", "18-24"]),
  crewId: uuidSchema.optional().nullable(),
  crewName: z.string().min(1).max(200),
  rank: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const engineLogEventFiltersSchema = z.object({
  eventType: z.string().optional(),
  source: z.enum(["manual", "telemetry", "system"]).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export const createEngineLogEventSchema = z.object({
  dayId: uuidSchema,
  eventType: z.enum([
    "ME_START", "ME_STOP", "DG_START", "DG_STOP", "DG_LOAD_TRANSFER",
    "FUEL_TRANSFER", "BUNKERING", "OIL_TRANSFER", "BILGE_PUMP",
    "MAINTENANCE", "INSPECTION", "REMARK", "CUSTOM"
  ]),
  eventTime: z.string().datetime(),
  description: z.string().min(1).max(2000),
  source: z.enum(["manual", "telemetry", "system"]).default("manual"),
  createdByCrewId: uuidSchema.optional().nullable(),
  createdByName: z.string().max(200).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateEngineLogEventSchema = z.object({
  eventType: z.enum([
    "ME_START", "ME_STOP", "DG_START", "DG_STOP", "DG_LOAD_TRANSFER",
    "FUEL_TRANSFER", "BUNKERING", "OIL_TRANSFER", "BILGE_PUMP",
    "MAINTENANCE", "INSPECTION", "REMARK", "CUSTOM"
  ]).optional(),
  eventTime: z.string().datetime().optional(),
  description: z.string().min(1).max(2000).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateEngineLogHourlySchema = engineLogHourlySchema
  .omit({ dailyLogId: true })
  .partial();

export const autofillRequestSchema = z.object({
  vesselId: uuidSchema,
  date: isoDateSchema,
  overwriteExisting: z.boolean().default(false),
});

export const notifyUnsignedRequestSchema = z.object({
  vesselId: uuidSchema.optional(),
  daysBack: z.number().int().min(1).max(90).optional(),
});

export const ensureDayRequestSchema = z.object({
  vesselId: uuidSchema,
  date: isoDateSchema,
});

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string; details: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: "Validation failed",
    details: result.error,
  };
}

export function formatValidationError(error: z.ZodError): { error: string; details: Record<string, string[]> } {
  return {
    error: "Validation failed",
    details: error.flatten().fieldErrors as Record<string, string[]>,
  };
}
