/**
 * LP Optimizer - Job Loading
 */

import { storage } from "../repositories.js";
import type { MaintenanceJob } from "./types.js";
import {
  getRequiredSkillLevel,
  getRequiredSkillLevelFromPriority,
  estimateWorkOrderDuration,
  estimatePartsRequired,
  estimatePartsFromDescription,
} from "./estimation-helpers.js";

export async function getPendingMaintenanceJobs(orgId: string): Promise<MaintenanceJob[]> {
  try {
    const schedules = await storage.getMaintenanceSchedules(orgId);
    const pendingSchedules = schedules.filter((s) => s.status === "scheduled");

    const workOrders = await storage.getWorkOrders();
    const pendingOrders = workOrders.filter((wo) => wo.status === "open");

    const equipment = await storage.getEquipmentList(orgId);
    const equipmentMap = new Map(equipment.map((eq) => [eq.id, eq]));

    const partsInventory = (await storage.getPartsInventory?.(orgId)) ?? [];

    const jobs: MaintenanceJob[] = [];

    for (const schedule of pendingSchedules) {
      const equip = equipmentMap.get(schedule.equipmentId);
      if (!equip) { continue; }

      const job: MaintenanceJob = {
        id: schedule.id,
        equipmentId: schedule.equipmentId,
        equipmentName: equip.name,
        maintenanceType: schedule.maintenanceType,
        priority: schedule.priority,
        estimatedDuration: schedule.estimatedDuration || 120,
        requiredSkillLevel: getRequiredSkillLevel(schedule.maintenanceType, equip.type),
        parts: estimatePartsRequired(schedule.maintenanceType, equip.type, partsInventory),
        preferredDate: schedule.scheduledDate,
        deadline: new Date(schedule.scheduledDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      };

      jobs.push(job);
    }

    for (const workOrder of pendingOrders) {
      const equip = equipmentMap.get(workOrder.equipmentId);
      if (!equip) { continue; }

      if (pendingSchedules.some((s) => s.equipmentId === workOrder.equipmentId)) { continue; }

      const job: MaintenanceJob = {
        id: `wo-${workOrder.id}`,
        equipmentId: workOrder.equipmentId,
        equipmentName: equip.name,
        maintenanceType: "corrective",
        priority: workOrder.priority,
        estimatedDuration: estimateWorkOrderDuration(workOrder.description, workOrder.priority),
        requiredSkillLevel: getRequiredSkillLevelFromPriority(workOrder.priority),
        parts: estimatePartsFromDescription(workOrder.description, partsInventory),
        deadline: new Date(Date.now() + (workOrder.priority === 1 ? 1 : 3) * 24 * 60 * 60 * 1000),
      };

      jobs.push(job);
    }

    console.log(`[LP Optimizer] Found ${jobs.length} maintenance jobs to optimize`);
    return jobs;
  } catch (error) {
    console.error(`[LP Optimizer] Error getting maintenance jobs:`, error);
    return [];
  }
}

export async function getPartsAvailability(orgId: string): Promise<any[]> {
  try {
    return (await storage.getPartsInventory?.(orgId)) ?? [];
  } catch {
    return [];
  }
}
