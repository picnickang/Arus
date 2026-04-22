/**
 * Compliance Excel - Equipment Compliance Report Generation
 */

import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";

import type { ComplianceDeps, ReportingPeriod, EquipmentComplianceOptions } from "./types";
import {
  createWorkbook,
  addSheet,
  writeWorkbook,
  formatDate,
  countByStatus,
  buildStandardsSheet,
} from "./utils";

export async function generateEquipmentComplianceExcel(
  storage: ComplianceDeps,
  orgId: string,
  equipmentIds: string[],
  standardCodes: string[],
  reportingPeriod: ReportingPeriod,
  options: EquipmentComplianceOptions
): Promise<Buffer> {
  console.log(
    `[Compliance Excel] Generating equipment compliance report for ${equipmentIds.length} units`
  );

  const equipmentHealth = await storage.getEquipmentHealth(orgId);
  const filteredEquipment =
    equipmentIds.length > 0
      ? equipmentHealth.filter((eq) => equipmentIds.includes(eq.id))
      : equipmentHealth;
  const workOrders = await storage.getWorkOrders(undefined, orgId);
  const relevantWorkOrders =
    equipmentIds.length > 0
      ? workOrders.filter((wo) => wo.equipmentId && equipmentIds.includes(wo.equipmentId))
      : workOrders;

  return renderEquipmentComplianceExcel(
    filteredEquipment,
    relevantWorkOrders,
    standardCodes,
    reportingPeriod,
    options
  );
}

function renderEquipmentComplianceExcel(
  equipment: EquipmentHealth[],
  workOrders: WorkOrder[],
  standardCodes: string[],
  period: ReportingPeriod,
  options: EquipmentComplianceOptions
): Buffer {
  const workbook = createWorkbook();
  const counts = countByStatus(equipment);

  const summaryData: any[][] = [
    ["MARITIME EQUIPMENT COMPLIANCE REPORT"],
    [],
    ["Report Details"],
    ["Report Type", options.reportType.toUpperCase()],
    ["Generated", new Date().toISOString()],
    [],
    ["Vessel Information"],
    ["Vessel Name", options.vesselName],
    ["IMO Number", options.imoNumber],
    ["Flag State", options.flag],
    [],
    ["Reporting Period"],
    ["Start Date", formatDate(period.startDate)],
    ["End Date", formatDate(period.endDate)],
    [],
    ["Equipment Summary"],
    ["Total Equipment", equipment.length],
    ["Healthy", counts.healthy],
    ["Warning", counts.warning],
    ["Critical", counts.critical],
  ];

  if (options.inspector) {
    summaryData.push([], ["Inspector", options.inspector]);
  }

  addSheet(workbook, summaryData, "Summary");

  const equipmentData: any[][] = [
    ["EQUIPMENT STATUS"],
    [],
    ["ID", "Name", "Type", "Vessel", "Status", "Health Index", "Last Maintenance"],
  ];

  for (const eq of equipment) {
    equipmentData.push([
      eq.id,
      eq.name ?? "",
      eq.type ?? "",
      eq.vessel ?? "",
      eq.status ?? "",
      eq.healthIndex ?? 0,
      formatDate(eq.lastMaintenance) ?? "N/A",
    ]);
  }

  addSheet(workbook, equipmentData, "Equipment");

  const woData: any[][] = [
    ["MAINTENANCE RECORDS"],
    [],
    ["WO Number", "Equipment ID", "Type", "Priority", "Status", "Created", "Completed"],
  ];

  for (const wo of workOrders) {
    woData.push([
      wo.workOrderNumber ?? wo.id,
      wo.equipmentId ?? "",
      wo.maintenanceType ?? "",
      wo.priority ?? "",
      wo.status ?? "",
      formatDate(wo.createdAt),
      formatDate(wo.actualEndDate),
    ]);
  }

  addSheet(workbook, woData, "Maintenance");
  addSheet(workbook, buildStandardsSheet(standardCodes), "Standards");

  return writeWorkbook(workbook);
}
