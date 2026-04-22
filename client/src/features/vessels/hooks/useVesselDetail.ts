import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useWorkOrders } from "@/features/work-orders";
import { useCrewList } from "@/features/crew";
import { useMaintenanceSchedules } from "@/features/maintenance";
import type { Vessel, Equipment, WorkOrder, Crew, MaintenanceSchedule } from "@shared/schema";

export interface UseVesselDetailReturn {
  match: boolean;
  vesselId: string | undefined;
  vessel: Vessel | undefined;
  vesselLoading: boolean;
  equipment: Equipment[];
  equipmentLoading: boolean;
  workOrdersLoading: boolean;
  crewLoading: boolean;
  schedulesLoading: boolean;
  vesselWorkOrders: WorkOrder[];
  vesselCrew: Crew[];
  vesselMaintenanceSchedules: MaintenanceSchedule[];
  activeWorkOrders: WorkOrder[];
  completedWorkOrders: WorkOrder[];
  utilizationRate: string;
  totalCost: string;
  powerSTWDateRange: { startDate: Date; endDate: Date };
}

export function useVesselDetail(): UseVesselDetailReturn {
  const [match, params] = useRoute("/vessels/:id");
  const vesselId = params?.id;

  const powerSTWDateRange = useMemo(() => ({ startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date() }), []);

  const { data: vessel, isLoading: vesselLoading } = useQuery<Vessel>({ queryKey: ["/api/vessels", vesselId], queryFn: () => apiRequest("GET", `/api/vessels/${vesselId}`), enabled: !!vesselId });
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery<Equipment[]>({ queryKey: ["/api/vessels", vesselId, "equipment"], queryFn: () => apiRequest("GET", `/api/vessels/${vesselId}/equipment`), enabled: !!vesselId });
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrders();
  const { data: crew = [], isLoading: crewLoading } = useCrewList();
  const { data: maintenanceSchedules = [], isLoading: schedulesLoading } = useMaintenanceSchedules();

  const vesselWorkOrders = useMemo(() => workOrders.filter((wo: WorkOrder) => { const woEquipment = equipment.find((eq: Equipment) => eq.id === wo.equipmentId); return woEquipment?.vesselId === vesselId || (woEquipment as Equipment & { vesselName?: string })?.vesselName === vessel?.name; }), [workOrders, equipment, vesselId, vessel?.name]);
  const vesselCrew = useMemo(() => crew.filter((c: Crew) => c.vesselId === vesselId), [crew, vesselId]);
  const vesselMaintenanceSchedules = useMemo(() => maintenanceSchedules.filter((ms: MaintenanceSchedule) => { const msEquipment = equipment.find((eq: Equipment) => eq.id === ms.equipmentId); return msEquipment?.vesselId === vesselId; }), [maintenanceSchedules, equipment, vesselId]);
  const activeWorkOrders = useMemo(() => vesselWorkOrders.filter((wo: WorkOrder) => wo.status === "open" || wo.status === "in_progress"), [vesselWorkOrders]);
  const completedWorkOrders = useMemo(() => vesselWorkOrders.filter((wo: WorkOrder) => wo.status === "completed"), [vesselWorkOrders]);

  const utilizationRate = vessel?.operationDays && vessel?.downtimeDays ? ((vessel.operationDays / (vessel.operationDays + vessel.downtimeDays)) * 100).toFixed(1) : "N/A";
  const totalCost = vessel?.dayRateSgd && vessel?.operationDays ? (Number.parseFloat(vessel.dayRateSgd) * vessel.operationDays).toFixed(2) : "N/A";

  return { match: !!match, vesselId, vessel, vesselLoading, equipment, equipmentLoading, workOrdersLoading, crewLoading, schedulesLoading, vesselWorkOrders, vesselCrew, vesselMaintenanceSchedules, activeWorkOrders, completedWorkOrders, utilizationRate, totalCost, powerSTWDateRange };
}
