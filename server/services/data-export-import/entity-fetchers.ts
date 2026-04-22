/**
 * Entity Fetchers
 *
 * Functions for fetching entity data from storage for export.
 */

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

type EntityFetcher = (orgId: string, options: ExportOptions) => Promise<any[]>;

async function fetchCrewCertifications(orgId: string): Promise<any[]> {
  const crewMembers = await dbCrewStorage.getCrew(orgId);
  const certs: any[] = [];
  for (const member of crewMembers) {
    const memberCerts = await dbCrewExtensionsStorage.getCrewCertifications(member.id);
    certs.push(...memberCerts);
  }
  return certs;
}

async function fetchAlertNotifications(orgId: string): Promise<any[]> {
  const allAlerts = await dbAlertStorage.getAlertNotifications(undefined);
  const equipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
  const equipmentIds = new Set(equipment.map((e) => e.id));
  return allAlerts.filter((a) => equipmentIds.has(a.equipmentId));
}

async function fetchPdmScoreLogs(orgId: string): Promise<any[]> {
  const allScores = await dbDevicesStorage.getPdmScores();
  const equip = await dbEquipmentStorage.getEquipmentRegistry(orgId);
  const eqIds = new Set(equip.map((e) => e.id));
  return allScores.filter((s) => eqIds.has(s.equipmentId));
}

const entityFetchers: Record<string, EntityFetcher> = {
  organizations: async (orgId) => {
    const org = await dbUserStorage.getOrganization(orgId);
    return org ? [org] : [];
  },
  vessels: (orgId) => vesselService.getVessels(orgId),
  equipment: (orgId) => dbEquipmentStorage.getEquipmentRegistry(orgId),
  devices: (orgId) => dbDevicesStorage.getDevices(orgId),
  users: (orgId) => dbUserStorage.getUsers(orgId),
  crew: (orgId) => dbCrewStorage.getCrew(orgId),
  crew_certifications: (orgId) => fetchCrewCertifications(orgId),
  crew_assignments: (orgId) => dbCrewStorage.getCrewAssignments(orgId),
  sensor_configurations: (orgId) => dbSensorsStorage.getSensorConfigurations(undefined, orgId),
  alert_configurations: (orgId) => dbAlertStorage.getAlertConfigurations(undefined, orgId),
  maintenance_schedules: (orgId) => dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId),
  work_orders: (orgId) => workOrderService.getWorkOrdersWithDetails(undefined, orgId),
  work_order_completions: (orgId) => dbWorkOrderStorage.getWorkOrderCompletions({ orgId }),
  maintenance_records: () => dbMaintenanceStorage.getMaintenanceRecords(undefined),
  alert_notifications: (orgId) => fetchAlertNotifications(orgId),
  pdm_score_logs: (orgId) => fetchPdmScoreLogs(orgId),
  parts_inventory: (orgId) => dbInventoryStorage.getPartsInventory(orgId),
  system_settings: async () => {
    const settings = await dbSystemAdminStorage.getSettings();
    return settings ? [settings] : [];
  },
  kb_docs: async (orgId, options) => {
    if (!options.includeKnowledgeBase) {
      return [];
    }
    try {
      return analyticsInsightsAdapter.getKbDocs(orgId);
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
): Promise<any[]> {
  const fetcher = entityFetchers[entityName];
  if (!fetcher) {
    console.warn(`[DataExport] Unknown entity: ${entityName}`);
    return [];
  }
  return fetcher(orgId, options);
}
