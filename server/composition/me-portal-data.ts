/**
 * Composition - Me Portal External Data
 *
 * The me-portal BFF reads the vessel roster (vessels domain) and writes admin
 * sessions (system-admin storage) when logging a regular user in. Those
 * cross-domain accesses live here in the composition layer (outside
 * server/domains/) so the me-portal domain depends only on the injected port;
 * the provider is the constructor default for MePortalService.
 */

import {
  dbSystemAdminStorage,
  vesselService,
  dbAlertStorage,
  dbMaintenanceStorage,
  workOrderService,
} from "../repositories.js";
import type {
  IMePortalExternalData,
  IMePortalTaskSources,
} from "../domains/me-portal/domain/ports.js";

export const mePortalExternalData: IMePortalExternalData = {
  getVessels: (orgId) => vesselService.getVessels(orgId),
  createAdminSession: (session) => dbSystemAdminStorage.createAdminSession(session),
};

export const mePortalTaskSources: IMePortalTaskSources = {
  getWorkOrdersWithDetails: (filter, orgId) =>
    workOrderService.getWorkOrdersWithDetails(filter, orgId),
  getMaintenanceSchedules: (filter, orgId) =>
    dbMaintenanceStorage.getMaintenanceSchedules(filter, orgId),
  getAlertNotifications: (includeRead, orgId) =>
    dbAlertStorage.getAlertNotifications(includeRead, orgId),
};
