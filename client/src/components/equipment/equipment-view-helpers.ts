/**
 * Helper functions for EquipmentViewDialog
 * Extracted to reduce cognitive complexity (S3776) and nesting depth (S2004)
 */

export interface OperatingParam {
  id: string;
  parameterName: string;
  parameterType: string;
  unit?: string | null;
  optimalMin?: number | null;
  optimalMax?: number | null;
  criticalMin?: number | null;
  criticalMax?: number | null;
  lifeImpactDescription?: string | null;
  recommendedAction?: string | null;
}

export interface TelemetryReading {
  sensorType: string;
  value?: number;
}

export type OperatingStatus = "critical" | "warning" | "normal" | "unknown";

export interface OperatingStatusResult {
  status: OperatingStatus;
  statusMessage: string;
}

/**
 * Compute the operating status for a parameter based on current value and thresholds
 */
export function computeOperatingStatus(
  param: OperatingParam,
  currentValue: number | undefined
): OperatingStatusResult {
  if (currentValue === undefined) {
    return { status: "unknown", statusMessage: "No data" };
  }

  if (param.criticalMin !== null && currentValue < param.criticalMin) {
    return { status: "critical", statusMessage: `Below critical minimum (${param.criticalMin})` };
  }
  
  if (param.criticalMax !== null && currentValue > param.criticalMax) {
    return { status: "critical", statusMessage: `Above critical maximum (${param.criticalMax})` };
  }
  
  if (param.optimalMin !== null && currentValue < param.optimalMin) {
    return { status: "warning", statusMessage: `Below optimal minimum (${param.optimalMin})` };
  }
  
  if (param.optimalMax !== null && currentValue > param.optimalMax) {
    return { status: "warning", statusMessage: `Above optimal maximum (${param.optimalMax})` };
  }

  return { status: "normal", statusMessage: "Within optimal range" };
}

/**
 * Get the CSS classes for the status card border and background
 */
export function getStatusCardClasses(status: OperatingStatus): string {
  switch (status) {
    case "critical":
      return "border-red-300 bg-red-50 dark:bg-red-950/20";
    case "warning":
      return "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20";
    case "normal":
      return "border-green-300 bg-green-50 dark:bg-green-950/20";
    default:
      return "border-gray-300 bg-gray-50 dark:bg-gray-950/20";
  }
}

/**
 * Get the badge variant for the status
 */
export function getStatusBadgeVariant(status: OperatingStatus): "destructive" | "default" | "secondary" | "outline" {
  switch (status) {
    case "critical":
      return "destructive";
    case "warning":
      return "default";
    case "normal":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Get the text color class for the status value
 */
export function getStatusValueClass(status: OperatingStatus): string {
  switch (status) {
    case "critical":
      return "text-red-600 dark:text-red-400";
    case "warning":
      return "text-yellow-600 dark:text-yellow-400";
    default:
      return "";
  }
}

/**
 * Format the optimal range display string
 */
export function formatOptimalRange(param: OperatingParam): string {
  const unit = param.unit || "";
  if (param.optimalMin !== null && param.optimalMax !== null) {
    return `${param.optimalMin} - ${param.optimalMax} ${unit}`;
  }

  if (param.optimalMin !== null) {
    return `> ${param.optimalMin} ${unit}`;
  }
  return `< ${param.optimalMax} ${unit}`;
}

/**
 * Format the critical range display string
 */
export function formatCriticalRange(param: OperatingParam): string {
  const unit = param.unit || "";
  if (param.criticalMin !== null && param.criticalMax !== null) {
    return `${param.criticalMin} - ${param.criticalMax} ${unit}`;
  }

  if (param.criticalMin !== null) {
    return `< ${param.criticalMin} ${unit}`;
  }
  return `> ${param.criticalMax} ${unit}`;
}

/**
 * Count sensors by status from a status array
 * Only counts explicit "online" and "offline" statuses
 */
export function countSensorsByStatus(
  sensorStatus: Array<{ status: string }>
): { online: number; offline: number } {
  let online = 0;
  let offline = 0;
  for (const s of sensorStatus) {
    if (s.status === "online") {
      online++;
    } else if (s.status === "offline") {
      offline++;
    }
  }
  return { online, offline };
}

/**
 * Safely parse a numeric input value
 * Returns null for empty strings, number otherwise
 */
export function parseNumericInput(value: string): number | null {
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
