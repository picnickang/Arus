/**
 * SHIPMATE Field Mapping Configuration
 *
 * Maps SBN Technologics SHIPMATE ERP export data to ARUS schema.
 *
 * SHIPMATE modules mapped:
 *   - PMS (Planned Maintenance System) — Equipment register, job schedules,
 *     completed maintenance history, running hours
 *   - SPS (Stores & Procurement System) — Spare parts, stock levels,
 *     purchase requisitions, supplier data
 *   - CMS (Crew Management System) — Crew list, certifications,
 *     work/rest hours records
 *   - HSEQ (Quality & Safety Management) — Safety incidents,
 *     NCR (Non-Conformity Reports), audit findings
 *
 * SHIPMATE doesn't have a public API, so the integration path is:
 *   1. Export from SHIPMATE via its built-in export/report functions (CSV)
 *   2. Or query SHIPMATE's database directly if co-located on vessel server
 *   3. Or use SHIPMATE's ship-to-shore replication files
 *
 * SHIPMATE CSV conventions (observed from deployed installations):
 *   - Usually comma-delimited (configurable per installation)
 *   - Date format: DD-MMM-YYYY (e.g., "15-Jan-2024") or DD/MM/YYYY
 *   - Boolean: "Yes"/"No" or "Y"/"N"
 *   - Hierarchy uses Component Number with dot notation: "1.2.3.1"
 *   - Running hours tracked as decimal: "4523.5"
 *   - Job numbers: alphanumeric, vessel-prefixed (e.g., "GB-PM-0001")
 */

import type { FieldMapping } from "../amos/field-mapping";
import {
  clean,
  extractParentComponentNo,
  mapCriticality,
  mapJobStatus,
  mapMaintType,
  parseBool,
  parseNum,
  parseShipmateDate,
} from "./field-mapping-transforms";

export { normalizeShipmateHeaders } from "./header-normalization";

// ============================================================================
// PMS Equipment Register
// ============================================================================

export const SHIPMATE_EQUIPMENT_MAP: FieldMapping[] = [
  // Identity (alternative headers — only first marked required)
  { amosField: "Component No", arusField: "id", required: true },
  { amosField: "Component Number", arusField: "id" },
  { amosField: "Component Name", arusField: "name", required: true },
  { amosField: "Description", arusField: "description", transform: clean },

  // Hierarchy (dot notation: parent of "1.2.3" is "1.2")
  {
    amosField: "Component No",
    arusField: "parentEquipmentId",
    transform: (v) => extractParentComponentNo(v),
  },
  {
    amosField: "Component Number",
    arusField: "parentEquipmentId",
    transform: (v) => extractParentComponentNo(v),
  },

  // Classification
  { amosField: "System", arusField: "systemType", transform: clean },
  { amosField: "System Name", arusField: "systemType", transform: clean },
  { amosField: "Equipment Type", arusField: "type", transform: clean },
  { amosField: "Component Type", arusField: "componentType", transform: clean },
  { amosField: "Criticality", arusField: "criticalityLevel", transform: (v) => mapCriticality(v) },
  {
    amosField: "Class Criticality",
    arusField: "criticalityLevel",
    transform: (v) => mapCriticality(v),
  },

  // Vessel / location
  { amosField: "Vessel", arusField: "_vesselName", transform: clean },
  { amosField: "Vessel Name", arusField: "_vesselName", transform: clean },
  { amosField: "Vessel Code", arusField: "vesselId", transform: clean },
  { amosField: "Location", arusField: "location", transform: clean },
  { amosField: "Deck/Location", arusField: "location", transform: clean },

  // Manufacturer / model
  { amosField: "Maker", arusField: "manufacturer", transform: clean },
  { amosField: "Manufacturer", arusField: "manufacturer", transform: clean },
  { amosField: "Model", arusField: "model", transform: clean },
  { amosField: "Model No", arusField: "model", transform: clean },
  { amosField: "Serial No", arusField: "serialNumber", transform: clean },
  { amosField: "Serial Number", arusField: "serialNumber", transform: clean },

  // Dates
  { amosField: "Install Date", arusField: "installDate", transform: (v) => parseShipmateDate(v) },
  {
    amosField: "Installation Date",
    arusField: "installDate",
    transform: (v) => parseShipmateDate(v),
  },
  {
    amosField: "Last Maintenance Date",
    arusField: "lastMaintenanceDate",
    transform: (v) => parseShipmateDate(v),
  },
  {
    amosField: "Last Done Date",
    arusField: "lastMaintenanceDate",
    transform: (v) => parseShipmateDate(v),
  },

  // Running hours
  { amosField: "Running Hours", arusField: "runningHours", transform: (v) => parseNum(v) },
  { amosField: "Current Hours", arusField: "runningHours", transform: (v) => parseNum(v) },
  { amosField: "Total Running Hours", arusField: "runningHours", transform: (v) => parseNum(v) },

  // Status
  {
    amosField: "Status",
    arusField: "isActive",
    transform: (v) => parseBool(v),
    defaultValue: true,
  },
  {
    amosField: "Active",
    arusField: "isActive",
    transform: (v) => parseBool(v),
    defaultValue: true,
  },

  // Specs (packed into JSONB)
  { amosField: "Power (kW)", arusField: "_spec_powerKw", transform: (v) => parseNum(v) },
  { amosField: "Rated RPM", arusField: "_spec_ratedRpm", transform: (v) => parseNum(v) },
  { amosField: "Capacity", arusField: "_spec_capacity", transform: clean },
  { amosField: "Weight (kg)", arusField: "_spec_weightKg", transform: (v) => parseNum(v) },
  { amosField: "Class No", arusField: "_spec_classNo", transform: clean },
  { amosField: "Drawing No", arusField: "_spec_drawingNo", transform: clean },
];

// ============================================================================
// PMS Job History (Completed maintenance / Work Orders)
// ============================================================================

export const SHIPMATE_JOB_MAP: FieldMapping[] = [
  { amosField: "Job No", arusField: "woNumber", required: true },
  { amosField: "Job Number", arusField: "woNumber" },
  { amosField: "Job Name", arusField: "title", required: true },
  { amosField: "Job Description", arusField: "description", transform: clean },
  { amosField: "Long Description", arusField: "description", transform: clean },

  // Equipment link (alternative headers — only first marked required)
  { amosField: "Component No", arusField: "equipmentId", required: true },
  { amosField: "Component Number", arusField: "equipmentId" },
  { amosField: "Component Name", arusField: "_equipmentName", transform: clean },

  // Classification
  { amosField: "Job Type", arusField: "maintenanceType", transform: (v) => mapMaintType(v) },
  {
    amosField: "Maintenance Type",
    arusField: "maintenanceType",
    transform: (v) => mapMaintType(v),
  },
  { amosField: "Job Status", arusField: "status", transform: (v) => mapJobStatus(v) },
  { amosField: "Status", arusField: "status", transform: (v) => mapJobStatus(v) },
  { amosField: "Priority", arusField: "priority", transform: (v) => parseNum(v) ?? 3 },

  // Dates
  {
    amosField: "Planned Date",
    arusField: "plannedStartDate",
    transform: (v) => parseShipmateDate(v),
  },
  { amosField: "Due Date", arusField: "dueDate", transform: (v) => parseShipmateDate(v) },
  { amosField: "Next Due Date", arusField: "dueDate", transform: (v) => parseShipmateDate(v) },
  { amosField: "Done Date", arusField: "completedAt", transform: (v) => parseShipmateDate(v) },
  { amosField: "Completed Date", arusField: "completedAt", transform: (v) => parseShipmateDate(v) },
  { amosField: "Created Date", arusField: "createdAt", transform: (v) => parseShipmateDate(v) },

  // Hours
  { amosField: "Estimated Hours", arusField: "estimatedHours", transform: (v) => parseNum(v) },
  { amosField: "Actual Hours", arusField: "actualHours", transform: (v) => parseNum(v) },
  { amosField: "Man Hours", arusField: "actualHours", transform: (v) => parseNum(v) },

  // Running hours at time of job
  { amosField: "Running Hours", arusField: "_runningHoursAtJob", transform: (v) => parseNum(v) },
  { amosField: "Done At Hours", arusField: "_runningHoursAtJob", transform: (v) => parseNum(v) },

  // Interval (for recurring jobs)
  { amosField: "Interval (Days)", arusField: "_intervalDays", transform: (v) => parseNum(v) },
  { amosField: "Interval (Hours)", arusField: "_intervalHours", transform: (v) => parseNum(v) },
  { amosField: "Frequency", arusField: "_frequency", transform: clean },

  // Personnel
  { amosField: "Responsible", arusField: "assignedTo", transform: clean },
  { amosField: "Assigned To", arusField: "assignedTo", transform: clean },
  { amosField: "Rank", arusField: "_responsibleRank", transform: clean },

  // Remarks
  { amosField: "Remarks", arusField: "notes", transform: clean },
  { amosField: "Comments", arusField: "notes", transform: clean },
  { amosField: "Findings", arusField: "_findings", transform: clean },

  // Vessel
  { amosField: "Vessel", arusField: "_vesselName", transform: clean },
  { amosField: "Vessel Code", arusField: "vesselId", transform: clean },
];

// ============================================================================
// SPS Spare Parts / Stores
// ============================================================================

export const SHIPMATE_STORES_MAP: FieldMapping[] = [
  { amosField: "Part No", arusField: "partNo", required: true },
  { amosField: "Part Number", arusField: "partNo" },
  { amosField: "Item Code", arusField: "partNo" },
  { amosField: "Part Name", arusField: "name", required: true },
  { amosField: "Description", arusField: "description", transform: clean },

  // Classification
  { amosField: "Category", arusField: "category", transform: clean },
  { amosField: "Group", arusField: "category", transform: clean },
  { amosField: "Sub Category", arusField: "_subCategory", transform: clean },
  { amosField: "UOM", arusField: "unitOfMeasure", transform: clean, defaultValue: "ea" },
  { amosField: "Unit", arusField: "unitOfMeasure", transform: clean, defaultValue: "ea" },

  // Maker / model
  { amosField: "Maker", arusField: "manufacturer", transform: clean },
  { amosField: "Manufacturer", arusField: "manufacturer", transform: clean },
  { amosField: "Maker Part No", arusField: "_makerPartNo", transform: clean },
  { amosField: "Drawing No", arusField: "_drawingNo", transform: clean },

  // Stock & cost
  { amosField: "ROB", arusField: "_stock_quantityOnHand", transform: (v) => parseNum(v) ?? 0 },
  {
    amosField: "Remaining On Board",
    arusField: "_stock_quantityOnHand",
    transform: (v) => parseNum(v) ?? 0,
  },
  {
    amosField: "Qty On Hand",
    arusField: "_stock_quantityOnHand",
    transform: (v) => parseNum(v) ?? 0,
  },
  { amosField: "Min Stock", arusField: "minStockQty", transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Minimum Stock", arusField: "minStockQty", transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Max Stock", arusField: "maxStockQty", transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Unit Price", arusField: "_stock_unitCost", transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Cost", arusField: "standardCost", transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Lead Time", arusField: "leadTimeDays", transform: (v) => parseNum(v) ?? 7 },
  { amosField: "Lead Time (Days)", arusField: "leadTimeDays", transform: (v) => parseNum(v) ?? 7 },

  // Location
  { amosField: "Location", arusField: "_stock_location", transform: clean, defaultValue: "MAIN" },
  {
    amosField: "Store Location",
    arusField: "_stock_location",
    transform: clean,
    defaultValue: "MAIN",
  },
  { amosField: "Bin", arusField: "_stock_binLocation", transform: clean },
  { amosField: "Bin Location", arusField: "_stock_binLocation", transform: clean },

  // Equipment link (SHIPMATE stores are linked to components)
  { amosField: "Component No", arusField: "_equipmentId", transform: clean },
  { amosField: "Component Number", arusField: "_equipmentId", transform: clean },

  // Criticality
  { amosField: "Criticality", arusField: "criticality", transform: (v) => mapCriticality(v) },

  // Supplier
  { amosField: "Supplier", arusField: "_supplier_name", transform: clean },
  { amosField: "Supplier Code", arusField: "_supplier_code", transform: clean },

  // Hazmat (SHIPMATE may include these)
  { amosField: "IMDG Class", arusField: "imoDgClass", transform: clean },
  { amosField: "UN Number", arusField: "unNumber", transform: clean },
  {
    amosField: "Hazmat",
    arusField: "isHazmat",
    transform: (v) => parseBool(v),
    defaultValue: false,
  },

  // Vessel
  { amosField: "Vessel", arusField: "_vesselName", transform: clean },
  { amosField: "Vessel Code", arusField: "_vesselCode", transform: clean },
];

// ============================================================================
// CMS Crew Certificates (for STCW compliance tracking)
// ============================================================================

export const SHIPMATE_CREW_CERT_MAP: FieldMapping[] = [
  { amosField: "Employee No", arusField: "employeeId", required: true },
  { amosField: "Seafarer ID", arusField: "employeeId" },
  { amosField: "Name", arusField: "employeeName", required: true },
  { amosField: "Rank", arusField: "rank", transform: clean },
  { amosField: "Certificate Name", arusField: "certificateName", required: true },
  { amosField: "Certificate Type", arusField: "certificateType", transform: clean },
  { amosField: "Certificate No", arusField: "certificateNumber", transform: clean },
  { amosField: "Issuing Authority", arusField: "issuingAuthority", transform: clean },
  { amosField: "Issue Date", arusField: "issueDate", transform: (v) => parseShipmateDate(v) },
  { amosField: "Expiry Date", arusField: "expiryDate", transform: (v) => parseShipmateDate(v) },
  { amosField: "Vessel", arusField: "_vesselName", transform: clean },
];

// ============================================================================
// Work & Rest Hours
// ============================================================================

export const SHIPMATE_REST_HOURS_MAP: FieldMapping[] = [
  { amosField: "Employee No", arusField: "employeeId", required: true },
  { amosField: "Name", arusField: "employeeName", required: true },
  { amosField: "Rank", arusField: "rank", transform: clean },
  { amosField: "Date", arusField: "date", transform: (v) => parseShipmateDate(v), required: true },
  { amosField: "Work Hours", arusField: "workHours", transform: (v) => parseNum(v) },
  { amosField: "Rest Hours", arusField: "restHours", transform: (v) => parseNum(v) },
  {
    amosField: "Violation",
    arusField: "hasViolation",
    transform: (v) => parseBool(v),
    defaultValue: false,
  },
  { amosField: "Violation Type", arusField: "violationType", transform: clean },
  { amosField: "Comments", arusField: "notes", transform: clean },
  { amosField: "Vessel", arusField: "_vesselName", transform: clean },
];

// ============================================================================
// Export mapping selector
// ============================================================================

export type ShipmateModuleType =
  | "pms_equipment"
  | "pms_jobs"
  | "sps_stores"
  | "cms_crew_certs"
  | "cms_rest_hours";

export function getShipmateMapping(moduleType: ShipmateModuleType): FieldMapping[] {
  switch (moduleType) {
    case "pms_equipment":
      return SHIPMATE_EQUIPMENT_MAP;
    case "pms_jobs":
      return SHIPMATE_JOB_MAP;
    case "sps_stores":
      return SHIPMATE_STORES_MAP;
    case "cms_crew_certs":
      return SHIPMATE_CREW_CERT_MAP;
    case "cms_rest_hours":
      return SHIPMATE_REST_HOURS_MAP;
    default:
      throw new Error(`Unknown SHIPMATE module: ${moduleType}`);
  }
}
