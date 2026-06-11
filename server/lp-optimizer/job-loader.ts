/**
 * LP Optimizer - Job Loading
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("LpOptimizer:JobLoader");
import {
  dbMaintenanceStorage,
  dbEquipmentStorage,
  dbInventoryStorage,
  workOrderService,
} from "../repositories.js";
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
    const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId);
    const pendingSchedules = schedules.filter((s) => s.status === "scheduled");

    const workOrders = await workOrderService.getWorkOrdersWithDetails();
    const pendingOrders = workOrders.filter((wo) => wo.status === "open");

    const equipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
    const equipmentMap = new Map(equipment.map((eq) => [eq.id, eq]));

    const partsInventory = (await dbInventoryStorage.getPartsInventory(undefined, orgId)) ?? [];

    const jobs: MaintenanceJob[] = [];

    for (const schedule of pendingSchedules) {
      const equip = equipmentMap.get(schedule.equipmentId);
      if (!equip) {
        continue;
      }

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
      if (!equip) {
        continue;
      }

      if (pendingSchedules.some((s) => s.equipmentId === workOrder.equipmentId)) {
        continue;
      }

      const job: MaintenanceJob = {
        id: `wo-${workOrder.id}`,
        equipmentId: workOrder.equipmentId,
        equipmentName: equip.name,
        maintenanceType: "corrective",
        priority: workOrder.priority,
        estimatedDuration: estimateWorkOrderDuration(
          workOrder.description ?? "",
          workOrder.priority
        ),
        requiredSkillLevel: getRequiredSkillLevelFromPriority(workOrder.priority),
        parts: estimatePartsFromDescription(workOrder.description ?? "", partsInventory),
        deadline: new Date(Date.now() + (workOrder.priority === 1 ? 1 : 3) * 24 * 60 * 60 * 1000),
      };

      jobs.push(job);
    }

    logger.info(`[LP Optimizer] Found ${jobs.length} maintenance jobs to optimize`);
    return jobs;
  } catch (error) {
    logger.error(`[LP Optimizer] Error getting maintenance jobs:`, undefined, error);
    return [];
  }
}

export async function getPartsAvailability(
  orgId: string
): Promise<import("./lp-formulation").LpPartRow[]> {
  try {
    const rows = (await dbInventoryStorage.getPartsInventory(undefined, orgId)) ?? [];
    return rows.map((r) => ({ id: r.id, quantity: r.quantityOnHand }));
  } catch {
    return [];
  }
}
