import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Clock, ExternalLink } from "lucide-react";
import { useEquipmentName } from "@/hooks/use-equipment-lookup";

export interface PdmPageEquipment {
  id: string;
  name?: string;
  type?: string;
  vesselId?: string;
}

export interface PdmPageVessel {
  id: string;
  name: string;
}

export function useEquipmentTypes() {
  const { data: equipment = [] } = useQuery<PdmPageEquipment[]>({ queryKey: ["/api/equipment"] });
  const types = Array.from(new Set(equipment.map((e) => e.type).filter(Boolean))) as string[];
  return types.length > 0
    ? types
    : ["engine", "pump", "compressor", "generator", "bearing", "turbine"];
}

export function EquipmentLink({ equipmentId }: { equipmentId: string }) {
  const [, navigate] = useLocation();
  const name = useEquipmentName(equipmentId);
  return (
    <button
      data-testid={`link-equipment-${equipmentId}`}
      onClick={() => navigate(`/equipment/${equipmentId}`)}
      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
    >
      {name}
      <ExternalLink className="w-3 h-3" />
    </button>
  );
}

export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) {
    return `${diffHrs}h ago`;
  }
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function TimestampBadge({
  label,
  timestamp,
}: {
  label: string;
  timestamp?: string | Date | null | undefined;
}) {
  if (!timestamp) {
    return null;
  }
  const d = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const relative = getRelativeTime(d);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      {label}: {relative}
    </span>
  );
}
