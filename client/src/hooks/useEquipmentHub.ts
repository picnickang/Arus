import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface WorkOrderSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  assignedCrewId: string | null;
  assignmentStatus: string | null;
  assignmentResponseReason: string | null;
  assignmentRespondedAt: string | null;
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
export interface EquipmentHubActiveAnomaly {
  id: number;
  anomalyType: string | null;
  sensorType: string;
  severity: string;
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}
export interface EquipmentHubCrewMember {
  id: string;
  name: string;
  rank: string | null;
  vesselId: string | null;
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
  activeAnomaly: EquipmentHubActiveAnomaly | null;
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

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<EquipmentHubActiveAnomaly>(
        "POST",
        `/api/equipment-intelligence/anomalies/${equipmentId}/acknowledge`
      );
    },
    onSuccess: () => {
      toast({ title: "Anomaly acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-intelligence/hub", equipmentId] });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to acknowledge",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const crewQuery = useQuery<EquipmentHubCrewMember[]>({
    queryKey: ["/api/crew"],
    enabled: !!equipmentId,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ workOrderId, crewId }: { workOrderId: string; crewId: string }) => {
      // Only set the assignee. The server marks the assignment as
      // "assigned" (awaiting response); the crew member then accepts
      // (→ in_progress) or declines (→ open) from their Today screen.
      return apiRequest("PUT", `/api/work-orders/${workOrderId}`, {
        assignedCrewId: crewId,
      });
    },
    onSuccess: () => {
      toast({ title: "Work assigned", description: "The crew member will be asked to accept it." });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-intelligence/hub", equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to assign work",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    runDiagnostic: diagnosticMutation.mutate,
    isDiagnosticPending: diagnosticMutation.isPending,
    acknowledgeAnomaly: acknowledgeMutation.mutate,
    isAcknowledgePending: acknowledgeMutation.isPending,
    crew: crewQuery.data ?? [],
    isCrewLoading: crewQuery.isLoading,
    assignWork: assignMutation.mutate,
    isAssignPending: assignMutation.isPending,
  };
}
