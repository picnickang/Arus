import { z } from "zod";
const searchEntityTypes = [
  "vessel",
  "equipment",
  "alert",
  "work-order",
  "crew",
  "sensor"
];
const searchResultBaseSchema = z.object({
  id: z.string(),
  entityType: z.enum(searchEntityTypes),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  relevanceScore: z.number().min(0).max(1).optional()
});
const vesselSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("vessel"),
  metadata: z.object({
    type: z.string().optional(),
    imo: z.string().optional(),
    flag: z.string().optional(),
    equipmentCount: z.number().optional()
  }).optional()
});
const equipmentSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("equipment"),
  metadata: z.object({
    type: z.string().optional(),
    vesselId: z.string().optional(),
    vesselName: z.string().optional(),
    healthIndex: z.number().optional()
  }).optional()
});
const alertSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("alert"),
  metadata: z.object({
    severity: z.enum(["info", "warning", "critical"]).optional(),
    equipmentId: z.string().optional(),
    equipmentName: z.string().optional(),
    acknowledged: z.boolean().optional()
  }).optional()
});
const workOrderSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("work-order"),
  metadata: z.object({
    priority: z.string().optional(),
    equipmentId: z.string().optional(),
    equipmentName: z.string().optional(),
    dueDate: z.string().optional()
  }).optional()
});
const crewSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("crew"),
  metadata: z.object({
    role: z.string().optional(),
    rank: z.string().optional(),
    vesselId: z.string().optional(),
    vesselName: z.string().optional()
  }).optional()
});
const sensorSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("sensor"),
  metadata: z.object({
    equipmentId: z.string().optional(),
    equipmentName: z.string().optional(),
    sensorType: z.string().optional(),
    unit: z.string().optional()
  }).optional()
});
const searchResponseSchema = z.object({
  results: z.array(searchResultBaseSchema),
  totalCount: z.number(),
  groupedResults: z.record(z.enum(searchEntityTypes), z.array(searchResultBaseSchema)),
  query: z.string(),
  executionTime: z.number().optional()
});
const searchRequestSchema = z.object({
  query: z.string().min(1).max(100),
  entityTypes: z.array(z.enum(searchEntityTypes)).optional(),
  limit: z.number().min(1).max(50).default(20),
  includeMetadata: z.boolean().default(true)
});
export {
  alertSearchResultSchema,
  crewSearchResultSchema,
  equipmentSearchResultSchema,
  searchEntityTypes,
  searchRequestSchema,
  searchResponseSchema,
  searchResultBaseSchema,
  sensorSearchResultSchema,
  vesselSearchResultSchema,
  workOrderSearchResultSchema
};
