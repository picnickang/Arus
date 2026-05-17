// @ts-nocheck
/**
 * Compliance Excel - Maintenance Compliance Report Generation
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("ComplianceExcel:MaintenanceCompliance");
import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";

import type { ComplianceDeps, ReportingPeriod, MaintenanceComplianceOptions } from "./types";
import { createWorkbook, addSheet, writeWorkbook, formatDate } from "./utils";

export async function generateMaintenanceComplianceExcel(
  storage: ComplianceDeps,
  orgId: string,
  vesselId: string,
  period: ReportingPeriod,
  options: MaintenanceComplianceOptions
): Promise<Buffer> {
  logger.info(`[Compliance Excel] Generating maintenance compliance report for vessel: ${vesselId}`);

  const workOrders = await storage.getWorkOrders(undefined, orgId);
  const equipmentHealth = await storage.getEquipmentHealth(orgId);

  const vesselEquipment = equipmentHealth.filter(
    (eq) => eq.vesselId === vesselId || eq.vesselId?.includes(vesselId)
  );
  const vesselEquipmentIds = new Set(vesselEquipment.map((eq) => eq.id));

  const vesselWorkOrders = workOrders.filter(
    (wo) =>
      wo.equipmentId &&
      vesselEquipmentIds.has(wo.equipmentId) &&
      wo.createdAt >= period.startDate &&
      wo.createdAt <= period.endDate
  );

  return renderMaintenanceComplianceExcel(vesselWorkOrders, vesselEquipment, period, options);
}

function renderMaintenanceComplianceExcel(
  workOrders: WorkOrder[],
  equipmentHealth: EquipmentHealth[],
  period: ReportingPeriod,
  options: MaintenanceComplianceOptions
): Buffer {
  const workbook = createWorkbook();

  const completedWOs = workOrders.filter((wo) => wo.status === "completed");
  const preventiveWOs = workOrders.filter((wo) => wo.maintenanceType === "preventive");
  const correctiveWOs = workOrders.filter((wo) => wo.maintenanceType === "corrective");

  const summaryData: any[][] = [
    ["MAINTENANCE COMPLIANCE REPORT"],
    [],
    ["Vessel", options.vesselName],
    ["Period", `${formatDate(period.startDate)} to ${formatDate(period.endDate)}`],
    ["Generated", new Date().toISOString()],
    [],
    ["Work Order Summary"],
    ["Total Work Orders", workOrders.length],
    ["Completed", completedWOs.length],
    [
      "Completion Rate (%)",
      workOrders.length > 0 ? ((completedWOs.length / workOrders.length) * 100).toFixed(1) : "N/A",
    ],
    [],
    ["Maintenance Type Distribution"],
    ["Preventive Maintenance", preventiveWOs.length],
    ["Corrective Maintenance", correctiveWOs.length],
    [
      "Preventive Ratio (%)",
      workOrders.length > 0 ? ((preventiveWOs.length / workOrders.length) * 100).toFixed(1) : "N/A",
    ],
  ];

  addSheet(workbook, summaryData, "Summary");

  if (options.includeWorkOrders) {
    const woData: any[][] = [
      ["WORK ORDER DETAILS"],
      [],
      [
        "WO Number",
        "Equipment ID",
        "Maintenance Type",
        "Priority",
        "Status",
        "Created Date",
        "Planned Start",
        "Planned End",
        "Actual Hours",
        "Description",
      ],
    ];

    for (const wo of workOrders) {
      woData.push([
        wo.workOrderNumber ?? wo.id,
        wo.equipmentId ?? "",
        wo.maintenanceType ?? "",
        wo.priority ?? "",
        wo.status ?? "",
        formatDate(wo.createdAt),
        formatDate(wo.plannedStartDate),
        formatDate(wo.plannedEndDate),
        wo.actualHours ?? "",
        wo.description ?? "",
      ]);
    }

    addSheet(workbook, woData, "Work Orders");
  }

  if (options.includeHealthMetrics) {
    const healthData: any[][] = [
      ["EQUIPMENT HEALTH METRICS"],
      [],
      ["Equipment ID", "Name", "Status", "Health Index", "Last Maintenance", "Critical Alerts"],
    ];

    for (const eq of equipmentHealth) {
      healthData.push([
        eq.id,
        eq.name ?? "",
        eq.status ?? "",
        eq.healthIndex ?? "",
        formatDate(eq.lastMaintenance),
        eq.criticalAlerts ?? 0,
      ]);
    }

    addSheet(workbook, healthData, "Equipment Health");
  }

  return writeWorkbook(workbook);
}
