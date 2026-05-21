import type { Vessel } from "@shared/schema";

export const VESSEL_CLASSES = [
  "tugboat",
  "anchor_handling_tug",
  "platform_supply_vessel",
  "pilot_boat",
  "work_boat",
  "dynamic_positioning_dive",
  "fast_ferry",
  "landing_craft",
  "seismic_surveillance",
  "standby",
] as const;

export const VESSEL_CONDITIONS = ["excellent", "good", "fair", "poor", "critical"] as const;

export type VesselClass = (typeof VESSEL_CLASSES)[number];
export type VesselCondition = (typeof VESSEL_CONDITIONS)[number];

export function formatVesselClass(className: string): string {
  return className
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function calculateUtilization(vessel: Vessel): number | null {
  const opDays = Number.parseFloat(vessel.operationDays || "0");
  const downDays = Number.parseFloat(vessel.downtimeDays || "0");
  const total = opDays + downDays;
  if (total <= 0) {
    return null;
  }
  return (opDays / total) * 100;
}

export function getConditionColor(condition: string): string {
  switch (condition) {
    case "excellent":
      return "bg-green-500";
    case "good":
      return "bg-blue-500";
    case "fair":
      return "bg-yellow-500";
    case "poor":
      return "bg-orange-500";
    case "critical":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

export function getConditionBadgeVariant(
  condition: string
): "default" | "destructive" | "secondary" | "outline" {
  switch (condition) {
    case "excellent":
    case "good":
      return "default";
    case "fair":
      return "secondary";
    case "poor":
      return "outline";
    case "critical":
      return "destructive";
    default:
      return "outline";
  }
}

export function getVesselHealthScore(
  equipmentHealth: Array<{ vesselId?: string; healthScore?: number }>,
  vesselId: string
): number | null {
  const vesselEquipment = equipmentHealth.filter((e) => e.vesselId === vesselId);
  if (vesselEquipment.length === 0) {
    return null;
  }
  const scores = vesselEquipment.map((e) => e.healthScore || 0);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function getActiveWorkOrderCount(
  workOrders: Array<{ vesselId?: string; status?: string }>,
  vesselId: string
): number {
  return workOrders.filter(
    (wo) => wo.vesselId === vesselId && wo.status !== "completed" && wo.status !== "cancelled"
  ).length;
}

export function formatVesselExportData(vessels: Vessel[]) {
  return vessels.map((v) => ({
    name: v.name,
    imo: v.imo || "",
    mmsi: (v as { mmsi?: string }).mmsi || "",
    class: (v as { class?: string }).class || "",
    condition: v.condition || "",
    operationDays: v.operationDays || "0",
    downtimeDays: v.downtimeDays || "0",
  }));
}
