import { z } from "zod";

/**
 * Search Entity Types
 * Defines the types of entities that can be searched
 */
export const searchEntityTypes = [
  "vessel",
  "equipment",
  "alert",
  "work-order",
  "crew",
  "sensor",
] as const;

export type SearchEntityType = (typeof searchEntityTypes)[number];

/**
 * Search Result Base
 * Common fields for all search results
 */
export const searchResultBaseSchema = z.object({
  id: z.string(),
  entityType: z.enum(searchEntityTypes),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
});

export type SearchResultBase = z.infer<typeof searchResultBaseSchema>;

/**
 * Vessel Search Result
 */
export const vesselSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("vessel"),
  metadata: z
    .object({
      type: z.string().optional(),
      imo: z.string().optional(),
      flag: z.string().optional(),
      equipmentCount: z.number().optional(),
    })
    .optional(),
});

export type VesselSearchResult = z.infer<typeof vesselSearchResultSchema>;

/**
 * Equipment Search Result
 */
export const equipmentSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("equipment"),
  metadata: z
    .object({
      type: z.string().optional(),
      vesselId: z.string().optional(),
      vesselName: z.string().optional(),
      healthIndex: z.number().optional(),
    })
    .optional(),
});

export type EquipmentSearchResult = z.infer<typeof equipmentSearchResultSchema>;

/**
 * Alert Search Result
 */
export const alertSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("alert"),
  metadata: z
    .object({
      severity: z.enum(["info", "warning", "critical"]).optional(),
      equipmentId: z.string().optional(),
      equipmentName: z.string().optional(),
      acknowledged: z.boolean().optional(),
    })
    .optional(),
});

export type AlertSearchResult = z.infer<typeof alertSearchResultSchema>;

/**
 * Work Order Search Result
 */
export const workOrderSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("work-order"),
  metadata: z
    .object({
      priority: z.string().optional(),
      equipmentId: z.string().optional(),
      equipmentName: z.string().optional(),
      dueDate: z.string().optional(),
    })
    .optional(),
});

export type WorkOrderSearchResult = z.infer<typeof workOrderSearchResultSchema>;

/**
 * Crew Search Result
 */
export const crewSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("crew"),
  metadata: z
    .object({
      role: z.string().optional(),
      rank: z.string().optional(),
      vesselId: z.string().optional(),
      vesselName: z.string().optional(),
    })
    .optional(),
});

export type CrewSearchResult = z.infer<typeof crewSearchResultSchema>;

/**
 * Sensor Search Result
 */
export const sensorSearchResultSchema = searchResultBaseSchema.extend({
  entityType: z.literal("sensor"),
  metadata: z
    .object({
      equipmentId: z.string().optional(),
      equipmentName: z.string().optional(),
      sensorType: z.string().optional(),
      unit: z.string().optional(),
    })
    .optional(),
});

export type SensorSearchResult = z.infer<typeof sensorSearchResultSchema>;

/**
 * Union of all search result types
 */
export type SearchResult =
  | VesselSearchResult
  | EquipmentSearchResult
  | AlertSearchResult
  | WorkOrderSearchResult
  | CrewSearchResult
  | SensorSearchResult;

/**
 * Grouped Search Results
 * Results grouped by entity type
 */
export const searchResponseSchema = z.object({
  results: z.array(searchResultBaseSchema),
  totalCount: z.number(),
  groupedResults: z.record(z.enum(searchEntityTypes), z.array(searchResultBaseSchema)),
  query: z.string(),
  executionTime: z.number().optional(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

/**
 * Search Request
 */
export const searchRequestSchema = z.object({
  query: z.string().min(1).max(100),
  entityTypes: z.array(z.enum(searchEntityTypes)).optional(),
  limit: z.number().min(1).max(50).default(20),
  includeMetadata: z.boolean().default(true),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;
