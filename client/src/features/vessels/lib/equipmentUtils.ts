import type { Equipment } from "@shared/schema";

export interface VesselInfo {
  name: string | null;
  isLinked: boolean;
}

export interface OperatingStatus {
  status: "critical" | "warning" | "normal" | "unknown";
  message: string;
}

export interface OperatingParam {
  id: string;
  parameterName: string;
  parameterType: string;
  unit?: string;
  optimalMin: number | null;
  optimalMax: number | null;
  criticalMin: number | null;
  criticalMax: number | null;
  lifeImpactDescription?: string;
  recommendedAction?: string;
}

export interface SensorStatusInfo {
  id: string;
  equipmentId: string;
  sensorType: string;
  status: "online" | "offline";
  lastTelemetry: string | null;
  lastValue: number | null;
  enabled: boolean;
}

export function formatType(type: string | null): string {
  if (!type) {
    return "-";
  }
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatLocation(location: string | null): string {
  if (!location) {
    return "-";
  }
  return location
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getVesselInfo(equipment: Equipment): VesselInfo {
  if (equipment.vesselId && equipment.vesselId !== "unassigned") {
    return {
      name: equipment.vesselName || `Vessel ${equipment.vesselId}`,
      isLinked: true,
    };
  }

  if (equipment.vesselName) {
    return {
      name: equipment.vesselName,
      isLinked: false,
    };
  }
  return {
    name: null,
    isLinked: false,
  };
}

export function calculateOperatingStatus(
  currentValue: number | undefined,
  param: OperatingParam
): OperatingStatus {
  if (currentValue === undefined) {
    return { status: "unknown", message: "No data" };
  }

  if (param.criticalMin !== null && currentValue < param.criticalMin) {
    return { status: "critical", message: `Below critical minimum (${param.criticalMin})` };
  }

  if (param.criticalMax !== null && currentValue > param.criticalMax) {
    return { status: "critical", message: `Above critical maximum (${param.criticalMax})` };
  }

  if (param.optimalMin !== null && currentValue < param.optimalMin) {
    return { status: "warning", message: `Below optimal minimum (${param.optimalMin})` };
  }

  if (param.optimalMax !== null && currentValue > param.optimalMax) {
    return { status: "warning", message: `Above optimal maximum (${param.optimalMax})` };
  }
  return { status: "normal", message: "Within optimal range" };
}

export function getStatusBorderClass(status: OperatingStatus["status"]): string {
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

export function getStatusBadgeVariant(
  status: OperatingStatus["status"]
): "destructive" | "default" | "secondary" | "outline" {
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

export function formatOptimalRange(param: OperatingParam): string | null {
  if (param.optimalMin === null && param.optimalMax === null) {
    return null;
  }
  const unit = param.unit || "";
  if (param.optimalMin !== null && param.optimalMax !== null) {
    return `${param.optimalMin} - ${param.optimalMax} ${unit}`;
  }

  if (param.optimalMin !== null) {
    return `> ${param.optimalMin} ${unit}`;
  }
  return `< ${param.optimalMax} ${unit}`;
}

export function formatCriticalRange(param: OperatingParam): string | null {
  if (param.criticalMin === null && param.criticalMax === null) {
    return null;
  }
  const unit = param.unit || "";
  if (param.criticalMin !== null && param.criticalMax !== null) {
    return `${param.criticalMin} - ${param.criticalMax} ${unit}`;
  }

  if (param.criticalMin !== null) {
    return `< ${param.criticalMin} ${unit}`;
  }
  return `> ${param.criticalMax} ${unit}`;
}

export function countSensorStatus(sensorStatus: SensorStatusInfo[]): {
  online: number;
  offline: number;
  total: number;
} {
  return {
    online: sensorStatus.filter((s) => s.status === "online").length,
    offline: sensorStatus.filter((s) => s.status === "offline").length,
    total: sensorStatus.length,
  };
}

export function createDefaultSensorFormValues(equipmentId: string) {
  return {
    equipmentId,
    sensorType: "",
    targetUnit: "",
    gain: 1,
    offset: 0,
    enabled: true,
    notes: "",
    critHi: null,
    critLo: null,
    warnHi: null,
    warnLo: null,
  };
}

export function getLoadDistributionDateRange() {
  return {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  };
}
