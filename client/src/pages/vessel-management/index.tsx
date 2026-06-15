import { Badge } from "@/components/ui/badge";
import { Vessel } from "@shared/schema";
import { Wifi, WifiOff } from "lucide-react";
import { useVesselManagementData } from "@/features/vessels";
import { VesselEquipmentSheet } from "./VesselEquipmentSheet";
import { VesselManagementActions, VesselManagementDialogs } from "./VesselManagementDialogs";
import { VesselFleetOverview } from "./VesselManagementFleetTable";

export default function VesselManagement() {
  const v = useVesselManagementData();

  const getStatusBadge = (vessel: Vessel) => {
    const offlineForWO = v.hasActiveDowntime(vessel.name, vessel.id);
    const offline = offlineForWO || vessel.onlineStatus === "offline";
    return offline ? (
      <Badge variant="secondary" className="bg-red-500 text-white">
        <WifiOff className="w-3 h-3 mr-1" />
        Offline
      </Badge>
    ) : (
      <Badge variant="default" className="bg-green-500">
        <Wifi className="w-3 h-3 mr-1" />
        Online
      </Badge>
    );
  };

  const getConditionBadge = (vessel: Vessel) => {
    const all = v.getVesselEquipment(vessel.name);
    if (!all || all.length === 0) {
      const condition = vessel.condition || "good";
      const colors: Record<string, string> = {
        excellent: "bg-green-500",
        good: "bg-blue-500",
        fair: "bg-yellow-500",
        poor: "bg-orange-500",
        critical: "bg-red-500",
      };
      return <Badge className={colors[condition] ?? "bg-gray-500"}>{condition}</Badge>;
    }
    const valid = all.filter((eq) => typeof eq.healthIndex === "number");
    if (valid.length === 0) {
      return <Badge className="bg-gray-500">unknown</Badge>;
    }
    const avg = valid.reduce((s, eq) => s + (eq.healthIndex as number), 0) / valid.length;
    const hasCritical = all.some((eq) => eq.status === "critical");
    const hasWarnings = all.some((eq) => eq.status === "warning");
    const urgent = all.some((eq) => (eq.predictedDueDays ?? Infinity) <= 7);
    if (hasCritical || avg < 50) {
      return <Badge className="bg-red-500">critical</Badge>;
    }
    if (hasWarnings || avg < 75 || urgent) {
      return <Badge className="bg-orange-500">poor</Badge>;
    }
    if (avg < 85) {
      return <Badge className="bg-yellow-500">fair</Badge>;
    }
    if (avg < 95) {
      return <Badge className="bg-blue-500">good</Badge>;
    }
    return <Badge className="bg-green-500">excellent</Badge>;
  };

  if (v.isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading vessels...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <VesselManagementActions model={v} />
      <VesselFleetOverview
        model={v}
        getConditionBadge={getConditionBadge}
        getStatusBadge={getStatusBadge}
      />
      <VesselEquipmentSheet
        vessel={v.selectedVessel}
        open={v.isViewDialogOpen}
        onOpenChange={v.setIsViewDialogOpen}
        getConditionBadge={getConditionBadge}
        getStatusBadge={getStatusBadge}
      />
      <VesselManagementDialogs model={v} />
    </div>
  );
}
