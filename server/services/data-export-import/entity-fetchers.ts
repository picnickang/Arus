/**
 * Entity Fetchers
 *
 * Functions for fetching entity data from storage for export.
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:DataExportImport:EntityFetchers");
import {
  dbCrewStorage,
  dbCrewExtensionsStorage,
  dbAlertStorage,
  dbEquipmentStorage,
  dbDevicesStorage,
  dbUserStorage,
  dbSensorsStorage,
  dbMaintenanceStorage,
  dbInventoryStorage,
  dbSystemAdminStorage,
  dbWorkOrderStorage,
  vesselService,
  workOrderService,
  analyticsInsightsAdapter,
} from "../../repositories";
import type { ExportOptions } from "./types";

export type EntityRow = Record<string, unknown>;
type EntityFetcher = (orgId: string, options: ExportOptions) => Promise<EntityRow[]>;

/**
 * Widen typed storage rows into the export-row shape.
 *
 * Drizzle row types (e.g. `WorkOrder`, `AlertNotification`) are structurally
 * `Record<string, unknown>`-compatible at runtime — every property value is a
 * JSON-serialisable scalar/object/array — but the compiler rejects direct
 * assignment because the typed shapes lack an index signature. This helper is
 * the single, justified boundary where we widen typed rows for the export
 * pipeline (JSONL serialiser + anonymisation service, which is generic over
 * `T extends Record<string, unknown>`).
 */
function toRows<T extends object>(rows: readonly T[]): EntityRow[] {
  return rows as unknown as EntityRow[];
}

async function fetchCrewCertifications(orgId: string): Promise<EntityRow[]> {
  const crewMembers = await dbCrewStorage.getCrew(orgId);
  const certs: EntityRow[] = [];
  for (const member of crewMembers) {
    const memberCerts = await dbCrewExtensionsStorage.getCrewCertifications(member.id);
    certs.push(...toRows(memberCerts));
  }
  return certs;
}

async function fetchAlertNotifications(orgId: string): Promise<EntityRow[]> {
  const allAlerts = await dbAlertStorage.getAlertNotifications(undefined);
  const equipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
  const equipmentIds = new Set(equipment.map((e) => e.id));
  return toRows(allAlerts.filter((a) => equipmentIds.has(a.equipmentId)));
}

async function fetchPdmScoreLogs(orgId: string): Promise<EntityRow[]> {
  const allScores = await dbDevicesStorage.getPdmScores();
  const equip = await dbEquipmentStorage.getEquipmentRegistry(orgId);
  const eqIds = new Set(equip.map((e) => e.id));
  return toRows(allScores.filter((s) => eqIds.has(s.equipmentId)));
}

const entityFetchers: Record<string, EntityFetcher> = {
  organizations: async (orgId) => {
    const org = await dbUserStorage.getOrganization(orgId);
    return org ? toRows([org]) : [];
  },
  vessels: async (orgId) => toRows(await vesselService.getVessels(orgId)),
  equipment: async (orgId) => toRows(await dbEquipmentStorage.getEquipmentRegistry(orgId)),
  devices: async (orgId) => toRows(await dbDevicesStorage.getDevices(orgId)),
  users: async (orgId) => toRows(await dbUserStorage.getUsers(orgId)),
  crew: async (orgId) => toRows(await dbCrewStorage.getCrew(orgId)),
  crew_certifications: (orgId) => fetchCrewCertifications(orgId),
  crew_assignments: async (orgId) => toRows(await dbCrewStorage.getCrewAssignments(orgId)),
  sensor_configurations: async (orgId) =>
    toRows(await dbSensorsStorage.getSensorConfigurations(undefined, orgId)),
  alert_configurations: async (orgId) =>
    toRows(await dbAlertStorage.getAlertConfigurations(undefined, orgId)),
  maintenance_schedules: async (orgId) =>
    toRows(await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId)),
  work_orders: async (orgId) =>
    toRows(await workOrderService.getWorkOrdersWithDetails(undefined, orgId)),
  work_order_completions: async (orgId) =>
    toRows(await dbWorkOrderStorage.getWorkOrderCompletions({ orgId })),
  maintenance_records: async () =>
    toRows(await dbMaintenanceStorage.getMaintenanceRecords(undefined)),
  alert_notifications: (orgId) => fetchAlertNotifications(orgId),
  pdm_score_logs: (orgId) => fetchPdmScoreLogs(orgId),
  parts_inventory: async (orgId) => toRows(await dbInventoryStorage.getPartsInventory(orgId)),
  system_settings: async () => {
    const settings = await dbSystemAdminStorage.getSettings();
    return settings ? toRows([settings]) : [];
  },
  kb_docs: async (orgId, options) => {
    if (!options.includeKnowledgeBase) {
      return [];
    }
    try {
      return toRows(await analyticsInsightsAdapter.getKbDocs(orgId));
    } catch {
      return [];
    }
  },
};

/**
 * Fetch entity data from storage based on entity name
 */
export async function fetchEntityData(
  entityName: string,
  orgId: string,
  options: ExportOptions
): Promise<EntityRow[]> {
  const fetcher = entityFetchers[entityName];
  if (!fetcher) {
    logger.warn(`[DataExport] Unknown entity: ${entityName}`);
    return [];
  }
  return fetcher(orgId, options);
}
