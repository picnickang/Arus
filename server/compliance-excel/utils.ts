/**
 * Compliance Excel Utils - Shared utility functions
 */

import ExcelJS from "exceljs";
import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";
import { MARITIME_STANDARDS } from "../compliance.js";
import { formatDate, countByStatus } from "../compliance-shared/utils";

export { formatDate, countByStatus };

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRows = CellValue[][];

export function createWorkbook(): ExcelJS.Workbook {
  return new ExcelJS.Workbook();
}

export function addSheet(workbook: ExcelJS.Workbook, data: SheetRows, name: string): void {
  const sheet = workbook.addWorksheet(name);
  sheet.addRows(data);
}

export async function writeWorkbook(workbook: ExcelJS.Workbook): Promise<Buffer> {
  // exceljs writes asynchronously; both callers already run in async builders.
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function getComplianceStatus(status: string | undefined): string {
  if (status === "healthy") {
    return "COMPLIANT";
  }
  if (status === "warning") {
    return "REVIEW REQUIRED";
  }
  return "NON-COMPLIANT";
}

export function buildEquipmentSheet(
  equipment: EquipmentHealth[],
  includeCompliance = false
): SheetRows {
  const header = ["ID", "Name", "Type", "Vessel", "Status", "Health Index"];
  if (includeCompliance) {
    header.push("Compliance Status");
  }

  const data: SheetRows = [["EQUIPMENT STATUS"], [], header];

  for (const eq of equipment) {
    const row: CellValue[] = [
      eq.id,
      eq.name ?? "",
      eq.type ?? "",
      eq.vesselId ?? "",
      eq.status ?? "",
      eq.healthIndex ?? 0,
    ];
    if (includeCompliance) {
      row.push(getComplianceStatus(eq.status));
    }
    data.push(row);
  }

  return data;
}

export function buildWorkOrderSheet(
  workOrders: WorkOrder[],
  title: string = "MAINTENANCE RECORDS"
): SheetRows {
  const data: SheetRows = [
    [title],
    [],
    ["WO Number", "Equipment ID", "Type", "Priority", "Status", "Created", "Completed"],
  ];

  for (const wo of workOrders) {
    const woNumber = (wo as { workOrderNumber?: string }).workOrderNumber;
    data.push([
      woNumber ?? wo.id,
      wo.equipmentId ?? "",
      wo.maintenanceType ?? "",
      wo.priority ?? "",
      wo.status ?? "",
      formatDate(wo.createdAt),
      formatDate(wo.actualEndDate),
    ]);
  }

  return data;
}

export function buildStandardsSheet(standardCodes?: string[]): SheetRows {
  const data: SheetRows = [["APPLICABLE STANDARDS"], [], ["Code", "Name", "Authority", "Category"]];

  const standards = standardCodes
    ? MARITIME_STANDARDS.filter((s) => standardCodes.includes(s.code))
    : MARITIME_STANDARDS;

  for (const standard of standards) {
    data.push([standard.code, standard.name, standard.authority, standard.category]);
  }

  return data;
}
