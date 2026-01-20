/**
 * Entity Fetchers
 * 
 * Functions for fetching entity data from storage for export.
 */

import { storage } from "../../storage";
import type { ExportOptions } from "./types";

type EntityFetcher = (orgId: string, options: ExportOptions) => Promise<any[]>;

async function fetchCrewCertifications(orgId: string): Promise<any[]> {
  const crewMembers = await storage.getCrew(orgId);
  const certs: any[] = [];
  for (const member of crewMembers) {
    const memberCerts = await storage.getCrewCertifications(member.id, orgId);
    certs.push(...memberCerts);
  }
  return certs;
}

async function fetchAlertNotifications(orgId: string): Promise<any[]> {
  const allAlerts = await storage.getAlertNotifications(undefined);
  const equipment = await storage.getEquipmentRegistry(orgId);
  const equipmentIds = new Set(equipment.map((e) => e.id));
  return allAlerts.filter((a) => equipmentIds.has(a.equipmentId));
}

async function fetchPdmScoreLogs(orgId: string): Promise<any[]> {
  const allScores = await storage.getPdmScores();
  const equip = await storage.getEquipmentRegistry(orgId);
  const eqIds = new Set(equip.map((e) => e.id));
  return allScores.filter((s) => eqIds.has(s.equipmentId));
}

const entityFetchers: Record<string, EntityFetcher> = {
  organizations: async (orgId) => { const org = await storage.getOrganization(orgId); return org ? [org] : []; },
  vessels: (orgId) => storage.getVessels(orgId),
  equipment: (orgId) => storage.getEquipmentRegistry(orgId),
  devices: (orgId) => storage.getDevices(orgId),
  users: (orgId) => storage.getUsers(orgId),
  crew: (orgId) => storage.getCrew(orgId),
  crew_certifications: (orgId) => fetchCrewCertifications(orgId),
  crew_assignments: (orgId) => storage.getCrewAssignments(orgId),
  sensor_configurations: (orgId) => storage.getSensorConfigurations(undefined, orgId),
  alert_configurations: (orgId) => storage.getAlertConfigurations(undefined, orgId),
  maintenance_schedules: (orgId) => storage.getMaintenanceSchedules(undefined, orgId),
  work_orders: (orgId) => storage.getWorkOrders(undefined, orgId),
  work_order_completions: (orgId) => storage.getWorkOrderCompletions({ orgId }),
  maintenance_records: () => storage.getMaintenanceRecords(undefined),
  alert_notifications: (orgId) => fetchAlertNotifications(orgId),
  pdm_score_logs: (orgId) => fetchPdmScoreLogs(orgId),
  parts_inventory: (orgId) => storage.getPartsInventory(orgId),
  system_settings: async () => { const settings = await storage.getSettings(); return settings ? [settings] : []; },
  kb_docs: async (orgId, options) => {
    if (!options.includeKnowledgeBase) {return [];}
    try { return storage.getKbDocs(orgId); } catch { return []; }
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
