export const WORK_ORDER_FILTER_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "deferred", label: "Deferred" },
] as const;

export const WORK_ORDER_FORM_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const WORK_ORDER_FILTER_PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "1", label: "Critical" },
  { value: "2", label: "High" },
  { value: "3", label: "Medium" },
  { value: "4", label: "Low" },
] as const;

export const WORK_ORDER_FORM_PRIORITY_OPTIONS = [
  { value: 1, label: "Critical", color: "text-red-600" },
  { value: 2, label: "High", color: "text-orange-500" },
  { value: 3, label: "Medium", color: "text-yellow-600" },
  { value: 4, label: "Low", color: "text-green-600" },
] as const;

export const EQUIPMENT_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "Engine", label: "Engine" },
  { value: "Generator", label: "Generator" },
  { value: "Pump", label: "Pump" },
  { value: "HVAC", label: "HVAC" },
  { value: "Navigation", label: "Navigation" },
  { value: "Electrical", label: "Electrical" },
  { value: "Hydraulics", label: "Hydraulics" },
  { value: "Other", label: "Other" },
] as const;

export const MAINTENANCE_TYPES = [
  { value: "preventive", label: "Preventive Maintenance" },
  { value: "corrective", label: "Corrective Maintenance" },
  { value: "predictive", label: "Predictive Maintenance" },
  { value: "emergency", label: "Emergency Repair" },
] as const;

export const PRIORITY_OPTIONS = WORK_ORDER_FORM_PRIORITY_OPTIONS;
export const STATUS_OPTIONS = WORK_ORDER_FORM_STATUS_OPTIONS;
