/**
 * Compliance Excel - Regulatory Compliance Report Generation
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("ComplianceExcel:RegulatoryCompliance");
import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";

import type { ComplianceDeps, ReportingPeriod, RegulatoryFramework } from "./types";
import { FRAMEWORK_STANDARDS } from "./types";
import {
  createWorkbook,
  addSheet,
  writeWorkbook,
  formatDate,
  countByStatus,
  getComplianceStatus,
  buildStandardsSheet,
} from "./utils";

export async function generateRegulatoryComplianceExcel(
  storage: ComplianceDeps,
  orgId: string,
  regulatoryFramework: RegulatoryFramework,
  equipmentIds: string[],
  period: ReportingPeriod
): Promise<Buffer> {
  logger.info(
    `[Compliance Excel] Generating regulatory compliance for framework: ${regulatoryFramework}`
  );

  const standardCodes = FRAMEWORK_STANDARDS[regulatoryFramework] || ["ABS-A1-MACHINERY"];

  const equipmentHealth = await storage.getEquipmentHealth(orgId);
  const filteredEquipment =
    equipmentIds.length > 0
      ? equipmentHealth.filter((eq) => equipmentIds.includes(eq.id))
      : equipmentHealth;
  const workOrders = await storage.getWorkOrders(undefined, orgId);

  return renderRegulatoryExcel(
    filteredEquipment,
    workOrders,
    regulatoryFramework,
    standardCodes,
    period
  );
}

function renderRegulatoryExcel(
  equipment: EquipmentHealth[],
  workOrders: WorkOrder[],
  framework: string,
  standardCodes: string[],
  period: ReportingPeriod
): Buffer {
  const workbook = createWorkbook();
  const counts = countByStatus(equipment);

  const summaryData: (string | number | boolean | Date | null | undefined)[][] = [
    [`${framework} REGULATORY COMPLIANCE REPORT`],
    [],
    ["Report Details"],
    ["Framework", framework],
    ["Generated", new Date().toISOString()],
    [],
    ["Period"],
    ["Start", formatDate(period.startDate)],
    ["End", formatDate(period.endDate)],
    [],
    ["Equipment Compliance Status"],
    ["Total Equipment", equipment.length],
    ["Healthy (Compliant)", counts.healthy],
    ["Warning (Review Required)", counts.warning],
    ["Critical (Non-Compliant)", counts.critical],
  ];

  addSheet(workbook, summaryData, "Summary");

  const matrixData: (string | number | boolean | Date | null | undefined)[][] = [
    ["COMPLIANCE MATRIX"],
    [],
    ["Equipment ID", "Name", "Type", "Status", "Health Score", "Compliance Status"],
  ];

  for (const eq of equipment) {
    matrixData.push([
      eq.id,
      eq.name ?? "",
      eq.type ?? "",
      eq.status ?? "",
      eq.healthIndex ?? 0,
      getComplianceStatus(eq.status),
    ]);
  }

  addSheet(workbook, matrixData, "Compliance Matrix");

  const woData: (string | number | boolean | Date | null | undefined)[][] = [
    ["MAINTENANCE HISTORY"],
    [],
    ["WO Number", "Equipment", "Type", "Priority", "Status", "Created", "Description"],
  ];

  for (const wo of workOrders) {
    woData.push([
      (wo as { workOrderNumber?: string }).workOrderNumber ?? wo.id,
      wo.equipmentId ?? "",
      wo.maintenanceType ?? "",
      wo.priority ?? "",
      wo.status ?? "",
      formatDate(wo.createdAt),
      wo.description ?? "",
    ]);
  }

  addSheet(workbook, woData, "Maintenance History");
  addSheet(workbook, buildStandardsSheet(standardCodes), "Standards");

  return writeWorkbook(workbook);
}
