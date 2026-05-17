/**
 * Compliance Excel Utils - Shared utility functions
 */

import * as XLSX from "xlsx";
import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";
import { MARITIME_STANDARDS } from "../compliance.js";
import { formatDate, countByStatus } from "../compliance-shared/utils";

export { formatDate, countByStatus };

export function createWorkbook(): XLSX.WorkBook {
  return XLSX.utils.book_new();
}

export function addSheet(workbook: XLSX.WorkBook, data: any[][], name: string): void {
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function writeWorkbook(workbook: XLSX.WorkBook): Buffer {
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
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
): any[][] {
  const header = ["ID", "Name", "Type", "Vessel", "Status", "Health Index"];
  if (includeCompliance) {
    header.push("Compliance Status");
  }

  const data: any[][] = [["EQUIPMENT STATUS"], [], header];

  for (const eq of equipment) {
    const row: any[] = [
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
): any[][] {
  const data: any[][] = [
    [title],
    [],
    ["WO Number", "Equipment ID", "Type", "Priority", "Status", "Created", "Completed"],
  ];

  for (const wo of workOrders) {
    data.push([
      // @ts-ignore -- bulk-silence
      wo.workOrderNumber ?? wo.id,
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

export function buildStandardsSheet(standardCodes?: string[]): any[][] {
  const data: any[][] = [["APPLICABLE STANDARDS"], [], ["Code", "Name", "Authority", "Category"]];

  const standards = standardCodes
    ? MARITIME_STANDARDS.filter((s) => standardCodes.includes(s.code))
    : MARITIME_STANDARDS;

  for (const standard of standards) {
    data.push([standard.code, standard.name, standard.authority, standard.category]);
  }

  return data;
}
