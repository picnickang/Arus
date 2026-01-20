/**
 * EquipmentHealthCard Component
 * PURPOSE: Unified equipment card with health metrics, RUL, and status indicator
 * USED BY: Fleet Overview, Bridge View, Health Monitor, Vessel Detail
 */

import { Ship, Zap, Droplets, Wind, Compass, Anchor, Thermometer, Navigation, Gauge, type LucideIcon } from "lucide-react";
import { CompactCard, LightCard, DarkCard } from "./EquipmentCardVariants";

export type EquipmentStatus = "healthy" | "warning" | "critical" | "unknown";

export interface EquipmentHealthData {
  id: string;
  name: string;
  type?: string;
  vesselId?: string;
  vesselName?: string;
  healthScore: number;
  rul?: number | null;
  pFail30d?: number;
  status: EquipmentStatus;
  predictedDueDays?: number;
  telemetry?: Array<{ sensorType: string; value: number; unit: string }>;
}

export interface StatusConfig {
  label: string;
  color: string;
  bgLight: string;
  bgDark: string;
  indicator: string;
  badgeVariant: "secondary" | "default" | "destructive" | "outline";
}

interface EquipmentHealthCardProps {
  equipment: EquipmentHealthData;
  variant?: "light" | "dark" | "compact";
  showVessel?: boolean;
  showTelemetry?: boolean;
  onViewDetails?: (equipmentId: string) => void;
  linkTo?: string;
  highlighted?: boolean;
}

const STATUS_CONFIG: Record<EquipmentStatus, StatusConfig> = {
  healthy: { label: "Healthy", color: "text-green-600 dark:text-green-400", bgLight: "bg-green-50 dark:bg-green-950/50", bgDark: "border-green-500 bg-green-500/10", indicator: "bg-green-500", badgeVariant: "secondary" },
  warning: { label: "Warning", color: "text-yellow-600 dark:text-yellow-400", bgLight: "bg-yellow-50 dark:bg-yellow-950/50", bgDark: "border-yellow-500 bg-yellow-500/10", indicator: "bg-yellow-500", badgeVariant: "default" },
  critical: { label: "Critical", color: "text-red-600 dark:text-red-400", bgLight: "bg-red-50 dark:bg-red-950/50", bgDark: "border-red-500 bg-red-500/10 animate-pulse", indicator: "bg-red-500", badgeVariant: "destructive" },
  unknown: { label: "Unknown", color: "text-gray-600 dark:text-gray-400", bgLight: "bg-gray-50 dark:bg-gray-950/50", bgDark: "border-gray-400 bg-gray-400/10", indicator: "bg-gray-400", badgeVariant: "outline" },
};

const EQUIPMENT_ICONS: Record<string, LucideIcon> = {
  "main engine": Ship, engine: Zap, generator: Zap, pump: Droplets, compressor: Wind,
  thruster: Navigation, steering: Compass, propulsion: Anchor, hvac: Wind, cooling: Thermometer, fuel: Gauge,
};

function getEquipmentIcon(type?: string): LucideIcon {
  if (!type) {return Gauge;}
  const lowerType = type.toLowerCase();
  for (const [key, icon] of Object.entries(EQUIPMENT_ICONS)) {
    if (lowerType.includes(key)) {return icon;}
  }
  return Gauge;
}

export function EquipmentHealthCard({ equipment, variant = "light", showVessel = true, showTelemetry = false, onViewDetails, linkTo, highlighted = false }: EquipmentHealthCardProps) {
  const config = STATUS_CONFIG[equipment.status];
  const Icon = getEquipmentIcon(equipment.type);
  const detailPath = linkTo || `/pdm/equipment/${equipment.id}`;

  if (variant === "compact") {
    return <CompactCard equipment={equipment} config={config} Icon={Icon} onViewDetails={onViewDetails} highlighted={highlighted} />;
  }

  if (variant === "dark") {
    return <DarkCard equipment={equipment} config={config} Icon={Icon} detailPath={detailPath} showVessel={showVessel} showTelemetry={showTelemetry} />;
  }
  return <LightCard equipment={equipment} config={config} Icon={Icon} detailPath={detailPath} onViewDetails={onViewDetails} showVessel={showVessel} highlighted={highlighted} />;
}

export function mapToEquipmentHealthData(equipment: {
  id: string;
  name?: string;
  type?: string;
  vesselId?: string;
  vesselName?: string;
  healthScore?: number;
  healthIndex?: number;
  rul?: number | null;
  pFail30d?: number;
  status?: string;
  predictedDueDays?: number;
}): EquipmentHealthData {
  const healthScore = equipment.healthScore ?? equipment.healthIndex ?? 0;
  let status: EquipmentStatus = "unknown";
  if (equipment.status) {
    status = equipment.status as EquipmentStatus;
  } else if (healthScore >= 75) {
    status = "healthy";
  } else if (healthScore >= 50) {
    status = "warning";
  } else {
    status = "critical";
  }
  return {
    id: equipment.id,
    name: equipment.name || equipment.id,
    type: equipment.type,
    vesselId: equipment.vesselId,
    vesselName: equipment.vesselName,
    healthScore,
    rul: equipment.rul,
    pFail30d: equipment.pFail30d,
    status,
    predictedDueDays: equipment.predictedDueDays,
  };
}
