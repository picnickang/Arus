import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useWorkOrders } from "@/features/work-orders";
import { useCrewList } from "@/features/crew";
import { useMaintenanceSchedules } from "@/features/maintenance";

export function useVesselDetail() {
  const [match, params] = useRoute("/vessels/:id");
  const vesselId = params?.id;

  const powerSTWDateRange = useMemo(() => ({ startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date() }), []);

  const { data: vessel, isLoading: vesselLoading } = useQuery({ queryKey: ["/api/vessels", vesselId], queryFn: () => apiRequest("GET", `/api/vessels/${vesselId}`), enabled: !!vesselId });
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery({ queryKey: ["/api/vessels", vesselId, "equipment"], queryFn: () => apiRequest("GET", `/api/vessels/${vesselId}/equipment`), enabled: !!vesselId });
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrders();
  const { data: crew = [], isLoading: crewLoading } = useCrewList();
  const { data: maintenanceSchedules = [], isLoading: schedulesLoading } = useMaintenanceSchedules();

  const vesselWorkOrders = useMemo(() => workOrders.filter((wo) => { const woEquipment = equipment.find((eq) => eq.id === wo.equipmentId); return woEquipment?.vesselId === vesselId || woEquipment?.vesselName === vessel?.name; }), [workOrders, equipment, vesselId, vessel?.name]);
  const vesselCrew = useMemo(() => crew.filter((c) => c.vesselId === vesselId), [crew, vesselId]);
  const vesselMaintenanceSchedules = useMemo(() => maintenanceSchedules.filter((ms) => { const msEquipment = equipment.find((eq) => eq.id === ms.equipmentId); return msEquipment?.vesselId === vesselId; }), [maintenanceSchedules, equipment, vesselId]);
  const activeWorkOrders = useMemo(() => vesselWorkOrders.filter((wo) => wo.status === "open" || wo.status === "in_progress"), [vesselWorkOrders]);
  const completedWorkOrders = useMemo(() => vesselWorkOrders.filter((wo) => wo.status === "completed"), [vesselWorkOrders]);

  const utilizationRate = vessel?.operationDays && vessel?.downtimeDays ? ((vessel.operationDays / (vessel.operationDays + vessel.downtimeDays)) * 100).toFixed(1) : "N/A";
  const totalCost = vessel?.dayRateSgd && vessel?.operationDays ? (Number.parseFloat(vessel.dayRateSgd) * vessel.operationDays).toFixed(2) : "N/A";

  return { match, vesselId, vessel, vesselLoading, equipment, equipmentLoading, workOrdersLoading, crewLoading, schedulesLoading, vesselWorkOrders, vesselCrew, vesselMaintenanceSchedules, activeWorkOrders, completedWorkOrders, utilizationRate, totalCost, powerSTWDateRange };
}
