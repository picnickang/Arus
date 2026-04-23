import { VESSEL_CLASSES, VESSEL_CONDITIONS, calculateUtilization } from "@/features/vessels";
import { formatPercent } from "@/lib/formatters";
import type { Vessel } from "@shared/schema";

export const vesselClasses = VESSEL_CLASSES;
export const vesselConditions = VESSEL_CONDITIONS;

export const formatVesselClass = (vesselClass: string) =>
  vesselClass
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const Utilization = ({ vessel }: { vessel: Vessel }) => {
  const utilization = calculateUtilization(vessel);
  if (utilization === null) {
    return <>N/A</>;
  }
  return <>{formatPercent(utilization)}</>;
};
