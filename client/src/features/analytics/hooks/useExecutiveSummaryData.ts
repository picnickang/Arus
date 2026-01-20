import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSeverityFromHealth } from "@/lib/severity-utils";

interface DashboardData {
  fleetHealth?: number;
  trends?: {
    openWorkOrders?: { direction: string; percentChange: number };
    fleetHealth?: { direction: string; percentChange: number };
  };
}

interface EquipmentHealth {
  id: string;
  name?: string;
  health: number;
}

interface Prediction {
  id: string;
  equipmentId: string;
  riskLevel?: string;
  probability: number;
  estimatedTimeToFailure?: number;
}

interface Anomaly {
  id: string;
  acknowledgedAt?: string;
}

interface WorkOrder {
  id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  targetCompletionDate?: string;
}

export interface UseExecutiveSummaryDataReturn {
  dashboard: DashboardData | undefined;
  equipment: EquipmentHealth[] | undefined;
  predictions: Prediction[] | undefined;
  anomalies: Anomaly[] | undefined;
  workOrders: WorkOrder[] | undefined;
  criticalEquipment: EquipmentHealth[];
  highRiskPredictions: Prediction[];
  pendingAnomalies: Anomaly[];
  openWorkOrders: WorkOrder[];
  overdueWorkOrders: WorkOrder[];
  topCriticalEquipment: EquipmentHealth[];
  topPredictions: Prediction[];
  maintenanceEfficiency: number;
  avgResponseTime: string;
}

export function useExecutiveSummaryData(): UseExecutiveSummaryDataReturn {
  const { data: dashboard } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });
  const { data: equipment } = useQuery<EquipmentHealth[]>({ queryKey: ["/api/equipment/health"] });
  const { data: predictions } = useQuery<Prediction[]>({ queryKey: ["/api/predictions/failures"] });
  const { data: anomalies } = useQuery<Anomaly[]>({ queryKey: ["/api/predictions/anomalies"] });
  const { data: workOrders } = useQuery<WorkOrder[]>({ queryKey: ["/api/work-orders"] });

  const criticalEquipment = useMemo(() => {
    return (equipment ?? []).filter((e) => getSeverityFromHealth(e.health) === "critical");
  }, [equipment]);

  const highRiskPredictions = useMemo(() => {
    return (predictions ?? []).filter((p) => p.riskLevel === "high" || p.probability > 0.7);
  }, [predictions]);

  const pendingAnomalies = useMemo(() => {
    return (anomalies ?? []).filter((a) => !a.acknowledgedAt);
  }, [anomalies]);

  const openWorkOrders = useMemo(() => {
    return (workOrders ?? []).filter((wo) => wo.status !== "completed");
  }, [workOrders]);

  const overdueWorkOrders = useMemo(() => {
    return openWorkOrders.filter((wo) => wo.targetCompletionDate && new Date(wo.targetCompletionDate) < new Date());
  }, [openWorkOrders]);

  const topCriticalEquipment = useMemo(() => criticalEquipment.slice(0, 3), [criticalEquipment]);
  const topPredictions = useMemo(() => highRiskPredictions.slice(0, 3), [highRiskPredictions]);

  const maintenanceEfficiency = useMemo(() => {
    if (!workOrders?.length) {return 0;}
    return Math.round((workOrders.filter((wo) => wo.status === "completed").length / workOrders.length) * 100);
  }, [workOrders]);

  const avgResponseTime = useMemo(() => {
    if (!workOrders?.length) {return "N/A";}
    const totalHours = workOrders.reduce((acc, wo) => {
      const start = new Date(wo.createdAt);
      const end = wo.completedAt ? new Date(wo.completedAt) : new Date();
      return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);
    return `${Math.round(totalHours / workOrders.length)}h`;
  }, [workOrders]);

  return {
    dashboard,
    equipment,
    predictions,
    anomalies,
    workOrders,
    criticalEquipment,
    highRiskPredictions,
    pendingAnomalies,
    openWorkOrders,
    overdueWorkOrders,
    topCriticalEquipment,
    topPredictions,
    maintenanceEfficiency,
    avgResponseTime,
  };
}
