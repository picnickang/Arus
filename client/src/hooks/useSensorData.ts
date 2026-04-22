/**
 * Sensor Data Hooks
 *
 * Centralized TanStack Query hooks for sensor bundles, templates, and configurations.
 * Provides strongly-typed data fetching and mutations for the sensor ecosystem.
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useCustomMutation,
} from "@/hooks/useCrudMutations";
import { apiRequest } from "@/lib/queryClient";
import type {
  SensorBundle,
  SensorTemplate,
  SensorConfiguration,
  InsertSensorTemplate,
  InsertSensorConfiguration,
} from "@shared/schema";

// Query key constants for cache invalidation
export const SENSOR_BUNDLES_QUERY_KEY = "/api/sensor-bundles";
export const SENSOR_TEMPLATES_QUERY_KEY = "/api/sensor-templates";
export const SENSOR_CONFIGS_QUERY_KEY = "/api/sensor-configs";

// ============================================================================
// Query Hooks - Data Fetching
// ============================================================================

/**
 * Fetch all sensor bundles (system + org-specific)
 * Optional filters: equipmentType
 *
 * The default query function handles query parameters in object form,
 * converting them to query strings automatically (see queryClient.ts)
 *
 * @param filters - Optional query parameters
 * @example
 * const { data: bundles, isLoading } = useSensorBundles();
 * const { data: mainEngineBundles } = useSensorBundles({ equipmentType: "main_engine" });
 */
export function useSensorBundles(filters?: {
  equipmentType?: string;
}): UseQueryResult<SensorBundle[]> {
  // Use tuple segments [baseUrl, params] for proper cache invalidation
  // The default query function will convert params to query string
  return useQuery<SensorBundle[]>({
    queryKey: filters
      ? [SENSOR_BUNDLES_QUERY_KEY, filters]
      : [SENSOR_BUNDLES_QUERY_KEY],
  });
}

/**
 * Fetch a single sensor bundle by ID
 *
 * @param id - Bundle ID
 * @example
 * const { data: bundle } = useSensorBundle("bundle-123");
 */
export function useSensorBundle(id: string | null): UseQueryResult<SensorBundle | undefined> {
  return useQuery<SensorBundle>({
    queryKey: [SENSOR_BUNDLES_QUERY_KEY, id],
    enabled: !!id, // Only run query if ID is provided
  });
}

/**
 * Fetch all sensor templates (system + org-specific)
 * Optional filters: kind, equipmentType
 *
 * The default query function handles query parameters in object form,
 * converting them to query strings automatically (see queryClient.ts)
 *
 * @param filters - Optional query parameters
 * @example
 * const { data: templates } = useSensorTemplates({ kind: "vibration" });
 */
export function useSensorTemplates(filters?: {
  kind?: string;
  equipmentType?: string;
}): UseQueryResult<SensorTemplate[]> {
  // Use tuple segments [baseUrl, params] for proper cache invalidation
  // The default query function will convert params to query string
  return useQuery<SensorTemplate[]>({
    queryKey: filters
      ? [SENSOR_TEMPLATES_QUERY_KEY, filters]
      : [SENSOR_TEMPLATES_QUERY_KEY],
  });
}

/**
 * Fetch a single sensor template by ID
 *
 * @param id - Template ID
 * @example
 * const { data: template } = useSensorTemplate("template-123");
 */
export function useSensorTemplate(id: string | null): UseQueryResult<SensorTemplate | undefined> {
  return useQuery<SensorTemplate>({
    queryKey: [SENSOR_TEMPLATES_QUERY_KEY, id],
    enabled: !!id,
  });
}

/**
 * Fetch all sensor configurations
 *
 * @example
 * const { data: configs, isLoading } = useSensorConfigs();
 */
export function useSensorConfigs(): UseQueryResult<SensorConfiguration[]> {
  return useQuery<SensorConfiguration[]>({
    queryKey: [SENSOR_CONFIGS_QUERY_KEY],
  });
}

/**
 * Fetch sensor configurations by equipment ID
 * Uses TanStack Query's select option for client-side filtering while maintaining cache coherency
 *
 * @param equipmentId - Equipment ID to filter by
 * @example
 * const { data: configs } = useSensorConfigsByEquipment("eq-123");
 */
export function useSensorConfigsByEquipment(
  equipmentId: string | null
): UseQueryResult<SensorConfiguration[]> {
  return useQuery<SensorConfiguration[], Error, SensorConfiguration[]>({
    queryKey: [SENSOR_CONFIGS_QUERY_KEY],
    select: (data) => {
      if (!equipmentId) {return [];}
      return data.filter((c) => c.equipmentId === equipmentId);
    },
    enabled: !!equipmentId,
  });
}

// ============================================================================
// Mutation Hooks - Template Management (CRUD)
// ============================================================================

/**
 * Create a new sensor template (org-specific only)
 *
 * @param options - Mutation options (onSuccess, successMessage, etc.)
 * @example
 * const createTemplate = useCreateSensorTemplate({
 *   successMessage: "Template created successfully",
 *   onSuccess: () => setDialogOpen(false)
 * });
 * createTemplate.mutate(templateData);
 */
export function useCreateSensorTemplate(options?: Parameters<typeof useCreateMutation>[1]) {
  return useCreateMutation<InsertSensorTemplate>(SENSOR_TEMPLATES_QUERY_KEY, {
    successMessage: "Sensor template created successfully",
    ...options,
  });
}

/**
 * Update an existing sensor template (org-specific only, not system templates)
 *
 * @param options - Mutation options (onSuccess, successMessage, etc.)
 * @example
 * const updateTemplate = useUpdateSensorTemplate({
 *   onSuccess: () => setDialogOpen(false)
 * });
 * updateTemplate.mutate({ id: "template-123", data: { name: "New Name" } });
 */
export function useUpdateSensorTemplate(options?: Parameters<typeof useUpdateMutation>[1]) {
  return useUpdateMutation<InsertSensorTemplate>(SENSOR_TEMPLATES_QUERY_KEY, {
    successMessage: "Sensor template updated successfully",
    ...options,
  });
}

/**
 * Delete a sensor template (org-specific only, not system templates)
 * Will fail if template is referenced by sensor bundles
 *
 * @param options - Mutation options (onSuccess, successMessage, etc.)
 * @example
 * const deleteTemplate = useDeleteSensorTemplate({
 *   successMessage: "Template deleted successfully"
 * });
 * deleteTemplate.mutate("template-id-123");
 */
export function useDeleteSensorTemplate(options?: Parameters<typeof useDeleteMutation>[1]) {
  return useDeleteMutation(SENSOR_TEMPLATES_QUERY_KEY, {
    successMessage: "Sensor template deleted successfully",
    ...options,
  });
}

/**
 * Copy an existing template (system or org-specific) to create a new org-specific template
 * Enables "save copy" flow for customizing system templates
 *
 * @param options - Mutation options (onSuccess, successMessage, etc.)
 * @example
 * const copyTemplate = useCopySensorTemplate({
 *   successMessage: "Template copied successfully",
 *   onSuccess: (newTemplate) => { void newTemplate; }
 * });
 * copyTemplate.mutate("source-template-id");
 */
export function useCopySensorTemplate(
  options?: Parameters<typeof useCustomMutation>[0] extends infer P
    ? Omit<P, "mutationFn" | "invalidateKeys">
    : never
) {
  return useCustomMutation<string, SensorTemplate>({
    mutationFn: (sourceTemplateId: string) =>
      apiRequest("POST", `${SENSOR_TEMPLATES_QUERY_KEY}/${sourceTemplateId}/copy`),
    invalidateKeys: [SENSOR_TEMPLATES_QUERY_KEY, SENSOR_CONFIGS_QUERY_KEY],
    successMessage: "Template copied successfully",
    ...options,
  });
}

// ============================================================================
// Mutation Hooks - Sensor Configuration Bulk Operations
// ============================================================================

/**
 * Payload for bulk sensor configuration creation
 */
export interface BulkSensorConfigPayload {
  equipmentId: string;
  bundleId?: string;
  configs: Omit<
    InsertSensorConfiguration,
    "equipmentId" | "orgId" | "version" | "lastModifiedBy" | "lastModifiedDevice"
  >[];
  overwriteExisting?: boolean;
}

/**
 * Bulk create sensor configurations for an equipment
 * Supports conflict resolution via overwriteExisting flag
 * Invalidates all sensor config queries to ensure cache coherency
 *
 * @param options - Mutation options (onSuccess, successMessage, etc.)
 * @example
 * const bulkCreate = useBulkCreateSensorConfigs({
 *   successMessage: "Sensors configured successfully",
 *   onSuccess: () => navigate("/equipment")
 * });
 * bulkCreate.mutate({
 *   equipmentId: "eq-123",
 *   bundleId: "main_engine",
 *   configs: [
 *     { sensorType: "vibration", enabled: true, gain: 1, offset: 0 },
 *     { sensorType: "temperature", enabled: true, gain: 1, offset: 0 }
 *   ],
 *   overwriteExisting: false
 * });
 */
export function useBulkCreateSensorConfigs(
  options?: Parameters<typeof useCustomMutation>[0] extends infer P
    ? Omit<P, "mutationFn" | "invalidateKeys">
    : never
) {
  return useCustomMutation<
    BulkSensorConfigPayload,
    {
      message: string;
      created: number;
      sensors: SensorConfiguration[];
    }
  >({
    mutationFn: (payload: BulkSensorConfigPayload) =>
      apiRequest("POST", "/api/sensor-config/bulk", payload),
    // Invalidate all sensor config queries (including equipment-scoped via select)
    // Also invalidate status endpoint which depends on sensor configs
    invalidateKeys: [SENSOR_CONFIGS_QUERY_KEY, "/api/sensor-configs/status"],
    successMessage: "Sensor configurations created successfully",
    ...options,
  });
}

/**
 * Apply a sensor bundle to equipment
 * Specialized version of useBulkCreateSensorConfigs for the Sensor Setup Wizard
 * Automatically handles cache invalidation for both global and equipment-specific queries
 *
 * @param options - Mutation options (onSuccess, successMessage, etc.)
 * @example
 * const applyBundle = useApplySensorBundle({
 *   successMessage: "Sensors configured successfully",
 *   onSuccess: () => setWizardOpen(false)
 * });
 * applyBundle.mutate({
 *   equipmentId: "eq-123",
 *   bundleId: "main_engine",
 *   configs: [...],
 *   overwriteExisting: true
 * });
 */
export function useApplySensorBundle(
  options?: Parameters<typeof useCustomMutation>[0] extends infer P
    ? Omit<P, "mutationFn" | "invalidateKeys">
    : never
) {
  return useCustomMutation<
    BulkSensorConfigPayload,
    {
      message: string;
      created: number;
      sensors: SensorConfiguration[];
    }
  >({
    mutationFn: (payload: BulkSensorConfigPayload) =>
      apiRequest("POST", "/api/sensor-config/bulk", payload),
    // Invalidate all sensor config queries to ensure cache coherency
    // Global invalidation covers equipment-specific queries (via select)
    invalidateKeys: [SENSOR_CONFIGS_QUERY_KEY, "/api/sensor-configs/status"],
    successMessage: "Sensor bundle applied successfully",
    ...options,
  });
}
