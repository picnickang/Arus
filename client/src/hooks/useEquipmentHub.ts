import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface WorkOrderSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}
export interface ServiceOrderSummary {
  id: string;
  title: string;
  status: string;
  vendorName: string | null;
  eta: string | null;
  createdAt: string;
}
export interface DiagnosticRunSummary {
  id: string;
  analysisType: string;
  status: string;
  summary: string | null;
  createdAt: string;
}
export interface ActivityTimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
  severity?: string;
}
export interface NeedsActionItem {
  id: string;
  type: string;
  title: string;
  urgency: string;
  link: string;
}
export interface OperationalContext {
  vesselStatus: string;
  nextPort: string | null;
  nextPortEta: string | null;
  partsAvailability: string;
  maintenanceWindow: string | null;
}
export interface EquipmentHubData {
  id: string;
  name: string;
  vessel: string;
  vesselId: string;
  type: string;
  health: number;
  rul: number;
  risk: "critical" | "warning" | "low";
  confidence: number;
  prediction: string;
  trend: string;
  signals: string[];
  telemetry: number[];
  lastService: string | null;
  nextDue: string | null;
  dataAvailability: string;
  assessment: string;
  recommendedAction: string;
  operationalContext: OperationalContext;
  needsAction: NeedsActionItem[];
  workOrders: WorkOrderSummary[];
  serviceOrders: ServiceOrderSummary[];
  diagnosticRuns: DiagnosticRunSummary[];
  activityTimeline: ActivityTimelineEvent[];
}

export function useEquipmentHub(equipmentId: string) {
  const { toast } = useToast();

  const query = useQuery<EquipmentHubData>({
    queryKey: ["/api/equipment-intelligence/hub", equipmentId],
    enabled: !!equipmentId,
  });

  const diagnosticMutation = useMutation({
    mutationFn: async (analysisType: string) => {
      return apiRequest("POST", `/api/equipment-intelligence/diagnostics/${equipmentId}/run`, {
        analysisType,
      });
    },
    onSuccess: () => {
      toast({ title: "Diagnostic complete" });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-intelligence/hub", equipmentId] });
    },
    onError: () => {
      toast({ title: "Diagnostic failed", variant: "destructive" });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    runDiagnostic: diagnosticMutation.mutate,
    isDiagnosticPending: diagnosticMutation.isPending,
  };
}
