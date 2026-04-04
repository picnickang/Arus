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

// ============================================================================
// Value transformers (SHIPMATE-specific date/value formats)
// ============================================================================

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Parse SHIPMATE dates: DD-MMM-YYYY, DD/MM/YYYY, YYYY-MM-DD
 */
const parseShipmateDate = (v: string): Date | null => {
  if (!v || v === "" || v.toLowerCase() === "n/a") return null;
  const trimmed = v.trim();

  // DD-MMM-YYYY (e.g., "15-Jan-2024")
  const dmy = trimmed.match(/^(\d{1,2})-(\w{3})-(\d{4})$/);
  if (dmy) {
    const month = MONTH_MAP[dmy[2].toLowerCase()];
    if (month) return new Date(`${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`);
  }

  // DD/MM/YYYY
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return new Date(`${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`);

  // ISO YYYY-MM-DD
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(trimmed);

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
};

const parseNum = (v: string): number | null => {
  if (!v || v === "" || v.toLowerCase() === "n/a") return null;
  const n = Number(v.replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const parseBool = (v: string): boolean => {
  return ["yes", "y", "true", "1", "active"].includes(v.toLowerCase().trim());
};

const clean = (v: string): string | null => {
  if (!v || v.trim() === "" || v.toLowerCase() === "n/a") return null;
  return v.trim();
};

/**
 * SHIPMATE uses a criticality system: Critical/Essential/Important/General
 * Map to ARUS 4-level: critical/high/medium/low
 */
const mapCriticality = (v: string): string => {
  const map: Record<string, string> = {
    critical: "critical",
    essential: "high",
    important: "medium",
    general: "low",
    "class critical": "critical",
    "class essential": "high",
    a: "critical", b: "high", c: "medium", d: "low",
    "1": "critical", "2": "high", "3": "medium", "4": "low",
  };
  return map[v.toLowerCase().trim()] || "medium";
};

/**
 * SHIPMATE job status mapping
 */
const mapJobStatus = (v: string): string => {
  const map: Record<string, string> = {
    planned: "planned",
    "in progress": "in_progress",
    "in-progress": "in_progress",
    active: "in_progress",
    done: "completed",
    completed: "completed",
    closed: "closed",
    "closed out": "closed",
    overdue: "overdue",
    deferred: "deferred",
    postponed: "deferred",
    cancelled: "cancelled",
  };
  return map[v.toLowerCase().trim()] || "open";
};

/**
 * SHIPMATE maintenance type: Preventive/Corrective/Condition-Based/Class Requirement
 */
const mapMaintType = (v: string): string => {
  const map: Record<string, string> = {
    preventive: "preventive",
    pm: "preventive",
    "planned maintenance": "preventive",
    corrective: "corrective",
    cm: "corrective",
    breakdown: "corrective",
    "condition-based": "predictive",
    "condition based": "predictive",
    cbm: "predictive",
    "class requirement": "preventive",
    "class req": "preventive",
    modification: "modification",
    "dry dock": "drydock",
    drydock: "drydock",
  };
  return map[v.toLowerCase().trim()] || "preventive";
};

/**
 * SHIPMATE component numbers use dot notation for hierarchy: "1.2.3"
 * Extract the parent by removing the last segment
 */
const extractParentComponentNo = (v: string): string | null => {
  if (!v || !v.includes(".")) return null;
  const parts = v.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
};

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
  { amosField: "Component No", arusField: "parentEquipmentId",
    transform: (v) => extractParentComponentNo(v) },
  { amosField: "Component Number", arusField: "parentEquipmentId",
    transform: (v) => extractParentComponentNo(v) },

  // Classification
  { amosField: "System", arusField: "systemType", transform: clean },
  { amosField: "System Name", arusField: "systemType", transform: clean },
  { amosField: "Equipment Type", arusField: "type", transform: clean },
  { amosField: "Component Type", arusField: "componentType", transform: clean },
  { amosField: "Criticality", arusField: "criticalityLevel",
    transform: (v) => mapCriticality(v) },
  { amosField: "Class Criticality", arusField: "criticalityLevel",
    transform: (v) => mapCriticality(v) },

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
  { amosField: "Install Date", arusField: "installDate",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Installation Date", arusField: "installDate",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Last Maintenance Date", arusField: "lastMaintenanceDate",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Last Done Date", arusField: "lastMaintenanceDate",
    transform: (v) => parseShipmateDate(v) },

  // Running hours
  { amosField: "Running Hours", arusField: "runningHours",
    transform: (v) => parseNum(v) },
  { amosField: "Current Hours", arusField: "runningHours",
    transform: (v) => parseNum(v) },
  { amosField: "Total Running Hours", arusField: "runningHours",
    transform: (v) => parseNum(v) },

  // Status
  { amosField: "Status", arusField: "isActive",
    transform: (v) => parseBool(v), defaultValue: true },
  { amosField: "Active", arusField: "isActive",
    transform: (v) => parseBool(v), defaultValue: true },

  // Specs (packed into JSONB)
  { amosField: "Power (kW)", arusField: "_spec_powerKw",
    transform: (v) => parseNum(v) },
  { amosField: "Rated RPM", arusField: "_spec_ratedRpm",
    transform: (v) => parseNum(v) },
  { amosField: "Capacity", arusField: "_spec_capacity", transform: clean },
  { amosField: "Weight (kg)", arusField: "_spec_weightKg",
    transform: (v) => parseNum(v) },
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
  { amosField: "Job Type", arusField: "maintenanceType",
    transform: (v) => mapMaintType(v) },
  { amosField: "Maintenance Type", arusField: "maintenanceType",
    transform: (v) => mapMaintType(v) },
  { amosField: "Job Status", arusField: "status",
    transform: (v) => mapJobStatus(v) },
  { amosField: "Status", arusField: "status",
    transform: (v) => mapJobStatus(v) },
  { amosField: "Priority", arusField: "priority",
    transform: (v) => parseNum(v) ?? 3 },

  // Dates
  { amosField: "Planned Date", arusField: "plannedStartDate",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Due Date", arusField: "dueDate",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Next Due Date", arusField: "dueDate",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Done Date", arusField: "completedAt",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Completed Date", arusField: "completedAt",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Created Date", arusField: "createdAt",
    transform: (v) => parseShipmateDate(v) },

  // Hours
  { amosField: "Estimated Hours", arusField: "estimatedHours",
    transform: (v) => parseNum(v) },
  { amosField: "Actual Hours", arusField: "actualHours",
    transform: (v) => parseNum(v) },
  { amosField: "Man Hours", arusField: "actualHours",
    transform: (v) => parseNum(v) },

  // Running hours at time of job
  { amosField: "Running Hours", arusField: "_runningHoursAtJob",
    transform: (v) => parseNum(v) },
  { amosField: "Done At Hours", arusField: "_runningHoursAtJob",
    transform: (v) => parseNum(v) },

  // Interval (for recurring jobs)
  { amosField: "Interval (Days)", arusField: "_intervalDays",
    transform: (v) => parseNum(v) },
  { amosField: "Interval (Hours)", arusField: "_intervalHours",
    transform: (v) => parseNum(v) },
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
  { amosField: "ROB", arusField: "_stock_quantityOnHand",
    transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Remaining On Board", arusField: "_stock_quantityOnHand",
    transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Qty On Hand", arusField: "_stock_quantityOnHand",
    transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Min Stock", arusField: "minStockQty",
    transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Minimum Stock", arusField: "minStockQty",
    transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Max Stock", arusField: "maxStockQty",
    transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Unit Price", arusField: "_stock_unitCost",
    transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Cost", arusField: "standardCost",
    transform: (v) => parseNum(v) ?? 0 },
  { amosField: "Lead Time", arusField: "leadTimeDays",
    transform: (v) => parseNum(v) ?? 7 },
  { amosField: "Lead Time (Days)", arusField: "leadTimeDays",
    transform: (v) => parseNum(v) ?? 7 },

  // Location
  { amosField: "Location", arusField: "_stock_location",
    transform: clean, defaultValue: "MAIN" },
  { amosField: "Store Location", arusField: "_stock_location",
    transform: clean, defaultValue: "MAIN" },
  { amosField: "Bin", arusField: "_stock_binLocation", transform: clean },
  { amosField: "Bin Location", arusField: "_stock_binLocation", transform: clean },

  // Equipment link (SHIPMATE stores are linked to components)
  { amosField: "Component No", arusField: "_equipmentId", transform: clean },
  { amosField: "Component Number", arusField: "_equipmentId", transform: clean },

  // Criticality
  { amosField: "Criticality", arusField: "criticality",
    transform: (v) => mapCriticality(v) },

  // Supplier
  { amosField: "Supplier", arusField: "_supplier_name", transform: clean },
  { amosField: "Supplier Code", arusField: "_supplier_code", transform: clean },

  // Hazmat (SHIPMATE may include these)
  { amosField: "IMDG Class", arusField: "imoDgClass", transform: clean },
  { amosField: "UN Number", arusField: "unNumber", transform: clean },
  { amosField: "Hazmat", arusField: "isHazmat",
    transform: (v) => parseBool(v), defaultValue: false },

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
  { amosField: "Issue Date", arusField: "issueDate",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Expiry Date", arusField: "expiryDate",
    transform: (v) => parseShipmateDate(v) },
  { amosField: "Vessel", arusField: "_vesselName", transform: clean },
];

// ============================================================================
// Work & Rest Hours
// ============================================================================

export const SHIPMATE_REST_HOURS_MAP: FieldMapping[] = [
  { amosField: "Employee No", arusField: "employeeId", required: true },
  { amosField: "Name", arusField: "employeeName", required: true },
  { amosField: "Rank", arusField: "rank", transform: clean },
  { amosField: "Date", arusField: "date",
    transform: (v) => parseShipmateDate(v), required: true },
  { amosField: "Work Hours", arusField: "workHours",
    transform: (v) => parseNum(v) },
  { amosField: "Rest Hours", arusField: "restHours",
    transform: (v) => parseNum(v) },
  { amosField: "Violation", arusField: "hasViolation",
    transform: (v) => parseBool(v), defaultValue: false },
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
    case "pms_equipment": return SHIPMATE_EQUIPMENT_MAP;
    case "pms_jobs": return SHIPMATE_JOB_MAP;
    case "sps_stores": return SHIPMATE_STORES_MAP;
    case "cms_crew_certs": return SHIPMATE_CREW_CERT_MAP;
    case "cms_rest_hours": return SHIPMATE_REST_HOURS_MAP;
    default: throw new Error(`Unknown SHIPMATE module: ${moduleType}`);
  }
}

/**
 * SHIPMATE CSV headers are sometimes inconsistent across installations.
 * This function normalizes common header variations before mapping.
 */
export function normalizeShipmateHeaders(headers: string[]): string[] {
  const normMap: Record<string, string> = {
    "comp no": "Component No",
    "comp. no": "Component No",
    "component no": "Component No",
    "component no.": "Component No",
    "component number": "Component Number",
    "comp name": "Component Name",
    "comp. name": "Component Name",
    "component name": "Component Name",
    "job no": "Job No",
    "job no.": "Job No",
    "job number": "Job Number",
    "job name": "Job Name",
    "work order no": "Job No",
    "part no": "Part No",
    "part no.": "Part No",
    "part number": "Part Number",
    "item no": "Part No",
    "item code": "Part No",
    "part name": "Part Name",
    "item name": "Part Name",
    "item description": "Part Name",
    "r.o.b": "ROB",
    "r.o.b.": "ROB",
    "rob": "ROB",
    "qty on board": "ROB",
    "remaining on board": "Remaining On Board",
    "maker": "Maker",
    "maker name": "Maker",
    "manufacturer": "Manufacturer",
    "mfr": "Manufacturer",
    "model": "Model",
    "model no": "Model No",
    "serial no": "Serial No",
    "serial number": "Serial Number",
    "system": "System",
    "system name": "System Name",
    "criticality": "Criticality",
    "running hours": "Running Hours",
    "running hrs": "Running Hours",
    "run hrs": "Running Hours",
    "current hours": "Current Hours",
    "total running hours": "Total Running Hours",
    "status": "Status",
    "active": "Active",
    "location": "Location",
    "description": "Description",
    "install date": "Install Date",
    "installation date": "Installation Date",
    "job type": "Job Type",
    "maintenance type": "Maintenance Type",
    "job status": "Job Status",
    "priority": "Priority",
    "planned date": "Planned Date",
    "due date": "Due Date",
    "next due date": "Next Due Date",
    "done date": "Done Date",
    "completed date": "Completed Date",
    "completion date": "Completed Date",
    "created date": "Created Date",
    "estimated hours": "Estimated Hours",
    "actual hours": "Actual Hours",
    "man hours": "Man Hours",
    "done at hours": "Done At Hours",
    "remarks": "Remarks",
    "comments": "Comments",
    "findings": "Findings",
    "category": "Category",
    "group": "Group",
    "uom": "UOM",
    "unit": "Unit",
    "min stock": "Min Stock",
    "minimum stock": "Minimum Stock",
    "max stock": "Max Stock",
    "unit price": "Unit Price",
    "cost": "Cost",
    "lead time": "Lead Time",
    "lead time (days)": "Lead Time (Days)",
    "bin": "Bin",
    "bin location": "Bin Location",
    "store location": "Store Location",
    "supplier": "Supplier",
    "supplier code": "Supplier Code",
    "imdg class": "IMDG Class",
    "un number": "UN Number",
    "hazmat": "Hazmat",
    "vessel": "Vessel",
    "vessel name": "Vessel Name",
    "vessel code": "Vessel Code",
    "employee no": "Employee No",
    "seafarer id": "Seafarer ID",
    "name": "Name",
    "rank": "Rank",
    "certificate name": "Certificate Name",
    "certificate type": "Certificate Type",
    "certificate no": "Certificate No",
    "issuing authority": "Issuing Authority",
    "issue date": "Issue Date",
    "expiry date": "Expiry Date",
    "date": "Date",
    "work hours": "Work Hours",
    "rest hours": "Rest Hours",
    "violation": "Violation",
    "violation type": "Violation Type",
    "responsible": "Responsible",
    "assigned to": "Assigned To",
    "power (kw)": "Power (kW)",
    "rated rpm": "Rated RPM",
    "capacity": "Capacity",
    "weight (kg)": "Weight (kg)",
    "class no": "Class No",
    "drawing no": "Drawing No",
    "sub category": "Sub Category",
    "maker part no": "Maker Part No",
    "qty on hand": "Qty On Hand",
    "deck/location": "Deck/Location",
    "equipment type": "Equipment Type",
    "component type": "Component Type",
    "class criticality": "Class Criticality",
    "last maintenance date": "Last Maintenance Date",
    "last done date": "Last Done Date",
    "long description": "Long Description",
    "interval (days)": "Interval (Days)",
    "interval (hours)": "Interval (Hours)",
    "frequency": "Frequency",
  };

  return headers.map((h) => {
    const lower = h.toLowerCase().trim();
    return normMap[lower] || h.trim();
  });
}
