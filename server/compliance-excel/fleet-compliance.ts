/**
 * Compliance Excel - Fleet Compliance Overview Report Generation
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("ComplianceExcel:FleetCompliance");
import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";

import type { ComplianceDeps, ReportingPeriod } from "./types";
import {
  createWorkbook,
  addSheet,
  writeWorkbook,
  formatDate,
  countByStatus,
  getComplianceStatus,
  buildStandardsSheet,
} from "./utils";

export async function generateFleetComplianceOverviewExcel(
  storage: ComplianceDeps,
  orgId: string,
  period: ReportingPeriod
): Promise<Buffer> {
  logger.info(`[Compliance Excel] Generating fleet compliance overview for org: ${orgId}`);

  const equipmentHealth = await storage.getEquipmentHealth(orgId);
  const workOrders = await storage.getWorkOrders(undefined, orgId);

  return renderFleetOverviewExcel(equipmentHealth, workOrders, period);
}

function renderFleetOverviewExcel(
  equipment: EquipmentHealth[],
  workOrders: WorkOrder[],
  period: ReportingPeriod
): Buffer {
  const workbook = createWorkbook();
  const counts = countByStatus(equipment);
  const complianceRate =
    equipment.length > 0 ? ((counts.healthy / equipment.length) * 100).toFixed(1) : "N/A";

  const summaryData: (string | number | boolean | Date | null | undefined)[][] = [
    ["FLEET COMPLIANCE OVERVIEW"],
    [],
    ["Report Details"],
    ["Generated", new Date().toISOString()],
    ["Report Type", "FLEET AUDIT"],
    [],
    ["Period"],
    ["Start Date", formatDate(period.startDate)],
    ["End Date", formatDate(period.endDate)],
    [],
    ["Fleet Statistics"],
    ["Total Equipment", equipment.length],
    ["Healthy (Compliant)", counts.healthy],
    ["Warning (Review Required)", counts.warning],
    ["Critical (Non-Compliant)", counts.critical],
    ["Compliance Rate (%)", complianceRate],
    [],
    ["Work Order Statistics"],
    ["Total Work Orders", workOrders.length],
    ["Completed", workOrders.filter((wo) => wo.status === "completed").length],
    ["Open", workOrders.filter((wo) => wo.status === "open").length],
    ["In Progress", workOrders.filter((wo) => wo.status === "in_progress").length],
  ];

  addSheet(workbook, summaryData, "Summary");

  const equipmentData: (string | number | boolean | Date | null | undefined)[][] = [
    ["FLEET EQUIPMENT STATUS"],
    [],
    ["ID", "Name", "Type", "Vessel", "Status", "Health Index", "Risk Score", "Compliance Status"],
  ];

  for (const eq of equipment) {
    equipmentData.push([
      eq.id,
      eq.name ?? "",
      eq.type ?? "",
      eq.vesselId ?? "",
      eq.status ?? "",
      eq.healthIndex ?? 0,
      eq.riskScore ?? 0,
      getComplianceStatus(eq.status),
    ]);
  }

  addSheet(workbook, equipmentData, "Equipment");

  const woData: (string | number | boolean | Date | null | undefined)[][] = [
    ["FLEET MAINTENANCE OVERVIEW"],
    [],
    [
      "WO Number",
      "Equipment",
      "Vessel",
      "Type",
      "Priority",
      "Status",
      "Created",
      "Scheduled Start",
      "Description",
    ],
  ];

  for (const wo of workOrders) {
    woData.push([
      (wo as { workOrderNumber?: string }).workOrderNumber ?? wo.id,
      wo.equipmentId ?? "",
      wo.vesselId ?? "",
      wo.maintenanceType ?? "",
      wo.priority ?? "",
      wo.status ?? "",
      formatDate(wo.createdAt),
      formatDate(wo.plannedStartDate),
      wo.description ?? "",
    ]);
  }

  addSheet(workbook, woData, "Maintenance");
  addSheet(workbook, buildStandardsSheet(), "Standards");

  return writeWorkbook(workbook);
}
