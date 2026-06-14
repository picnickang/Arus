/**
 * Composition - Scheduling Maintenance Data Provider
 *
 * The scheduling domain reads and writes maintenance schedules, which are owned
 * by the maintenance domain. This adapter lives in the composition layer
 * (outside server/domains/) so the scheduling domain stays free of cross-domain
 * dbMaintenanceStorage coupling; the port is injected into the scheduling routes
 * via the domain-router registry (mirrors the alerts→crew / sync→inventory seams).
 */

import { dbMaintenanceStorage } from "../db/maintenance/index.js";
import type { ISchedulingMaintenancePort } from "../domains/scheduling/domain/ports";

export const schedulingMaintenanceProvider: ISchedulingMaintenancePort = {
  getMaintenanceSchedules: (equipmentId, orgId, filters) =>
    dbMaintenanceStorage.getMaintenanceSchedules(equipmentId, orgId, filters),
  getMaintenanceSchedule: (id, orgId) => dbMaintenanceStorage.getMaintenanceSchedule(id, orgId),
  createMaintenanceSchedule: (schedule) =>
    dbMaintenanceStorage.createMaintenanceSchedule(schedule),
  updateMaintenanceSchedule: (id, updates, orgId) =>
    dbMaintenanceStorage.updateMaintenanceSchedule(id, updates, orgId),
  deleteMaintenanceSchedule: (id, orgId) =>
    dbMaintenanceStorage.deleteMaintenanceSchedule(id, orgId),
};
