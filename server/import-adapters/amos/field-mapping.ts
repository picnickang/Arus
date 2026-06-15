/**
 * AMOS Field Mapping Configuration
 *
 * Maps AMOS Business Suite CSV/XML export fields to ARUS schema columns.
 * AMOS exports use different field names depending on the module and version.
 *
 * Supports:
 *   - AMOS Equipment Register export (CSV/XML)
 *   - AMOS Job Orders / Work Orders export
 *   - AMOS Spare Parts / Stock export
 *   - AMOS Maintenance Plans export
 *
 * Each mapping defines:
 *   - amosField: Field name in the AMOS export
 *   - arusField: Column name in the ARUS schema
 *   - transform: Optional function to convert values
 *   - required: Whether the field must be present
 */

export interface FieldMapping {
  amosField: string;
  arusField: string;
  transform?: (value: string, row: Record<string, string>) => unknown;
  required?: boolean;
  defaultValue?: unknown;
}

// ============================================================================
// Value transformers
// ============================================================================

const parseDate = (v: string): Date | null => {
  if (!v || v === "" || v === "NULL") {
    return null;
  }
  // AMOS uses DD/MM/YYYY, DD.MM.YYYY, or YYYY-MM-DD
  const formats = [
    /^(\d{2})[\/\.](\d{2})[\/\.](\d{4})$/, // DD/MM/YYYY or DD.MM.YYYY
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
  ];
  for (const fmt of formats) {
    const m = v.match(fmt);
    if (m) {
      const d =
        m[1]!.length === 4
          ? new Date(`${m[1]}-${m[2]}-${m[3]}`)
          : new Date(`${m[3]}-${m[2]}-${m[1]}`);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const parseNumber = (v: string): number | null => {
  if (!v || v === "" || v === "NULL") {
    return null;
  }
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? null : n;
};

const parseBoolean = (v: string): boolean => {
  return ["true", "1", "yes", "y", "active", "t"].includes(v.toLowerCase().trim());
};

const cleanString = (v: string): string | null => {
  if (!v || v === "NULL" || v.trim() === "") {
    return null;
  }
  return v.trim();
};

const mapCriticality = (v: string): string => {
  const map: Record<string, string> = {
    "1": "critical",
    "2": "high",
    "3": "medium",
    "4": "low",
    A: "critical",
    B: "high",
    C: "medium",
    D: "low",
    VITAL: "critical",
    IMPORTANT: "high",
    NEEDED: "medium",
    DESIRABLE: "low",
  };
  return map[v.toUpperCase()] || "medium";
};

const mapWorkOrderStatus = (v: string): string => {
  const map: Record<string, string> = {
    OPEN: "open",
    PLANNED: "planned",
    "IN PROGRESS": "in_progress",
    "IN-PROGRESS": "in_progress",
    STARTED: "in_progress",
    COMPLETED: "completed",
    DONE: "completed",
    CLOSED: "closed",
    CANCELLED: "cancelled",
    CANCELED: "cancelled",
    OVERDUE: "overdue",
    POSTPONED: "deferred",
  };
  return map[v.toUpperCase().trim()] || "open";
};

const mapMaintenanceType = (v: string): string => {
  const map: Record<string, string> = {
    PM: "preventive",
    PREVENTIVE: "preventive",
    PLANNED: "preventive",
    CM: "corrective",
    CORRECTIVE: "corrective",
    BREAKDOWN: "corrective",
    PD: "predictive",
    PREDICTIVE: "predictive",
    CONDITION: "predictive",
    EM: "emergency",
    EMERGENCY: "emergency",
    MODIFICATION: "modification",
    MOD: "modification",
  };
  return map[v.toUpperCase().trim()] || "preventive";
};

// ============================================================================
// Equipment Register mapping
// ============================================================================

export const EQUIPMENT_FIELD_MAP: FieldMapping[] = [
  // Identity
  { amosField: "EQUIPMENT_NO", arusField: "id", required: true },
  { amosField: "DESCRIPTION", arusField: "name", required: true },
  { amosField: "LONG_DESCRIPTION", arusField: "plainLanguageName", transform: cleanString },

  // Classification
  { amosField: "SYSTEM_TYPE", arusField: "systemType", transform: cleanString },
  { amosField: "COMPONENT_TYPE", arusField: "componentType", transform: cleanString },
  { amosField: "EQUIPMENT_TYPE", arusField: "type", transform: cleanString },
  { amosField: "CRITICALITY", arusField: "criticalityLevel", transform: (v) => mapCriticality(v) },

  // Hierarchy (AMOS stores parent as PARENT_EQUIPMENT_NO)
  { amosField: "PARENT_EQUIPMENT_NO", arusField: "parentEquipmentId", transform: cleanString },
  { amosField: "VESSEL_CODE", arusField: "vesselId", transform: cleanString },
  { amosField: "LOCATION", arusField: "location", transform: cleanString },

  // Manufacturer / model
  { amosField: "MANUFACTURER", arusField: "manufacturer", transform: cleanString },
  { amosField: "MODEL", arusField: "model", transform: cleanString },
  { amosField: "SERIAL_NO", arusField: "serialNumber", transform: cleanString },

  // Dates — stored in specifications JSONB (no dedicated columns)
  {
    amosField: "INSTALL_DATE",
    arusField: "_spec_installDate",
    transform: (v) => parseDate(v)?.toISOString() ?? null,
  },
  {
    amosField: "WARRANTY_EXPIRY",
    arusField: "_spec_warrantyExpiry",
    transform: (v) => parseDate(v)?.toISOString() ?? null,
  },
  {
    amosField: "LAST_MAINTENANCE_DATE",
    arusField: "_spec_lastMaintenanceDate",
    transform: (v) => parseDate(v)?.toISOString() ?? null,
  },

  // Operating parameters — stored in specifications JSONB
  { amosField: "RUNNING_HOURS", arusField: "_spec_runningHours", transform: (v) => parseNumber(v) },
  {
    amosField: "IS_ACTIVE",
    arusField: "isActive",
    transform: (v) => parseBoolean(v),
    defaultValue: true,
  },

  // Specifications (AMOS has these as separate columns, we pack into JSONB)
  { amosField: "POWER_KW", arusField: "_spec_powerKw", transform: (v) => parseNumber(v) },
  { amosField: "RATED_RPM", arusField: "_spec_ratedRpm", transform: (v) => parseNumber(v) },
  { amosField: "WEIGHT_KG", arusField: "_spec_weightKg", transform: (v) => parseNumber(v) },
  { amosField: "DIMENSIONS", arusField: "_spec_dimensions", transform: cleanString },
];

// ============================================================================
// Work Order mapping
// ============================================================================

export const WORK_ORDER_FIELD_MAP: FieldMapping[] = [
  { amosField: "JOB_ORDER_NO", arusField: "woNumber", required: true },
  { amosField: "DESCRIPTION", arusField: "description", required: true },
  { amosField: "LONG_DESCRIPTION", arusField: "reason", transform: cleanString },
  { amosField: "EQUIPMENT_NO", arusField: "equipmentId", required: true },
  { amosField: "VESSEL_CODE", arusField: "vesselId", transform: cleanString },
  {
    amosField: "STATUS",
    arusField: "status",
    transform: (v) => mapWorkOrderStatus(v),
    defaultValue: "open",
  },
  {
    amosField: "MAINTENANCE_TYPE",
    arusField: "maintenanceType",
    transform: (v) => mapMaintenanceType(v),
    defaultValue: "preventive",
  },
  { amosField: "PRIORITY", arusField: "priority", transform: (v) => parseNumber(v) ?? 3 },
  {
    amosField: "PLANNED_START_DATE",
    arusField: "plannedStartDate",
    transform: (v) => parseDate(v),
  },
  { amosField: "PLANNED_END_DATE", arusField: "plannedEndDate", transform: (v) => parseDate(v) },
  { amosField: "ACTUAL_START_DATE", arusField: "actualStartDate", transform: (v) => parseDate(v) },
  { amosField: "ACTUAL_END_DATE", arusField: "actualEndDate", transform: (v) => parseDate(v) },
  { amosField: "PLANNED_HOURS", arusField: "estimatedHours", transform: (v) => parseNumber(v) },
  { amosField: "ACTUAL_HOURS", arusField: "actualHours", transform: (v) => parseNumber(v) },
  { amosField: "RESPONSIBLE", arusField: "assignedCrewId", transform: cleanString },
  { amosField: "REMARKS", arusField: "reason", transform: cleanString },
  { amosField: "CREATED_DATE", arusField: "createdAt", transform: (v) => parseDate(v) },
];

// ============================================================================
// Spare Parts mapping
// ============================================================================

export const PARTS_FIELD_MAP: FieldMapping[] = [
  { amosField: "PART_NO", arusField: "partNo", required: true },
  { amosField: "DESCRIPTION", arusField: "name", required: true },
  { amosField: "LONG_DESCRIPTION", arusField: "description", transform: cleanString },
  { amosField: "CATEGORY", arusField: "category", transform: cleanString },
  { amosField: "UOM", arusField: "unitOfMeasure", transform: cleanString, defaultValue: "ea" },
  { amosField: "MANUFACTURER", arusField: "_spec_manufacturer", transform: cleanString },
  { amosField: "STANDARD_COST", arusField: "standardCost", transform: (v) => parseNumber(v) ?? 0 },
  { amosField: "LEAD_TIME_DAYS", arusField: "leadTimeDays", transform: (v) => parseNumber(v) ?? 7 },
  { amosField: "CRITICALITY", arusField: "criticality", transform: (v) => mapCriticality(v) },
  { amosField: "MIN_STOCK", arusField: "minStockQty", transform: (v) => parseNumber(v) ?? 0 },
  { amosField: "MAX_STOCK", arusField: "maxStockQty", transform: (v) => parseNumber(v) ?? 0 },
  {
    amosField: "CURRENT_STOCK",
    arusField: "_stock_quantityOnHand",
    transform: (v) => parseNumber(v) ?? 0,
  },
  {
    amosField: "LOCATION",
    arusField: "_stock_location",
    transform: cleanString,
    defaultValue: "MAIN",
  },
  { amosField: "BIN_LOCATION", arusField: "_stock_binLocation", transform: cleanString },
  { amosField: "UNIT_COST", arusField: "_stock_unitCost", transform: (v) => parseNumber(v) ?? 0 },
  { amosField: "SUPPLIER_CODE", arusField: "_supplier_code", transform: cleanString },
];

// ============================================================================
// Maintenance Plan mapping
// ============================================================================

export const MAINTENANCE_PLAN_FIELD_MAP: FieldMapping[] = [
  { amosField: "PLAN_CODE", arusField: "templateCode", required: true },
  { amosField: "DESCRIPTION", arusField: "title", required: true },
  { amosField: "LONG_DESCRIPTION", arusField: "description", transform: cleanString },
  { amosField: "EQUIPMENT_NO", arusField: "equipmentId", required: true },
  { amosField: "FREQUENCY_DAYS", arusField: "frequencyDays", transform: (v) => parseNumber(v) },
  { amosField: "FREQUENCY_HOURS", arusField: "frequencyHours", transform: (v) => parseNumber(v) },
  {
    amosField: "MAINTENANCE_TYPE",
    arusField: "maintenanceType",
    transform: (v) => mapMaintenanceType(v),
  },
  { amosField: "LAST_DONE_DATE", arusField: "lastDoneDate", transform: (v) => parseDate(v) },
  { amosField: "NEXT_DUE_DATE", arusField: "nextDueDate", transform: (v) => parseDate(v) },
  { amosField: "TASK_LIST", arusField: "_tasks", transform: cleanString },
  { amosField: "REQUIRED_PARTS", arusField: "_requiredParts", transform: cleanString },
  { amosField: "REQUIRED_SKILLS", arusField: "_requiredSkills", transform: cleanString },
  { amosField: "ESTIMATED_HOURS", arusField: "estimatedHours", transform: (v) => parseNumber(v) },
];

// ============================================================================
// Helper: Apply mapping to a row
// ============================================================================

export function applyMapping(
  row: Record<string, string>,
  mapping: FieldMapping[]
): { data: Record<string, unknown>; errors: string[]; warnings: string[] } {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of mapping) {
    const rawValue = row[field.amosField] ?? row[field.amosField.toLowerCase()] ?? "";

    if (field.required && (!rawValue || rawValue.trim() === "" || rawValue === "NULL")) {
      errors.push(`Required field ${field.amosField} is missing or empty`);
      continue;
    }

    if (!rawValue || rawValue.trim() === "" || rawValue === "NULL") {
      if (field.defaultValue !== undefined) {
        data[field.arusField] = field.defaultValue;
      }
      continue;
    }

    try {
      const value = field.transform ? field.transform(rawValue, row) : rawValue.trim();
      // A transform that yields null/undefined/Invalid-Date means the raw cell
      // was present but unparseable. For a required field that must fail the
      // row rather than silently importing a null where a value is required.
      const unparseable =
        value === null || value === undefined || (value instanceof Date && isNaN(value.getTime()));
      if (field.required && unparseable) {
        errors.push(`Required field ${field.amosField}="${rawValue}" could not be parsed`);
        continue;
      }
      if (unparseable && value instanceof Date) {
        continue; // never store an Invalid Date
      }
      data[field.arusField] = value;
    } catch (err) {
      warnings.push(`Failed to transform ${field.amosField}="${rawValue}": ${err}`);
      if (field.defaultValue !== undefined) {
        data[field.arusField] = field.defaultValue;
      }
    }
  }

  return { data, errors, warnings };
}

export default {
  EQUIPMENT_FIELD_MAP,
  WORK_ORDER_FIELD_MAP,
  PARTS_FIELD_MAP,
  MAINTENANCE_PLAN_FIELD_MAP,
  applyMapping,
};
