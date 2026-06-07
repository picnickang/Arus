import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface GovernancePrediction {
  id: number;
  equipmentId: string;
  riskLevel: string;
  reviewStatus: string | null;
  failureProbability: number | null;
  remainingUsefulLife: number | null;
  predictionTimestamp: string | Date | null;
  predictionValidUntil: string | Date | null;
  modelVersionId: string | null;
  featureSetVersion: string | null;
  featureSnapshotId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | Date | null;
  suppressionReason: string | null;
  [key: string]: unknown;
}

export function usePredictionGovernance(status?: string) {
  const { currentOrgId } = useOrganization();
  return useQuery<GovernancePrediction[]>({
    queryKey: ["/api/pdm/governance/predictions", { status }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) {
        params.set("status", status);
      }
      const url = `/api/pdm/governance/predictions${params.toString() ? `?${params}` : ""}`;
      return (await apiRequest("GET", url));
    },
    enabled: !!currentOrgId,
  });
}

export function useGovernanceDetail(id: number | null) {
  const { currentOrgId } = useOrganization();
  return useQuery<GovernancePrediction>({
    queryKey: ["/api/pdm/governance/predictions", id],
    queryFn: async () =>
      (await apiRequest(
        "GET",
        `/api/pdm/governance/predictions/${id}`
      )),
    enabled: id != null && !!currentOrgId,
  });
}

export function useReviewPrediction() {
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      return apiRequest("PATCH", `/api/pdm/governance/predictions/${id}/review`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/governance/predictions"] });
    },
  });
}

export function useApprovePrediction() {
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      return apiRequest("PATCH", `/api/pdm/governance/predictions/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/governance/predictions"] });
    },
  });
}

export function useSuppressPrediction() {
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return apiRequest("PATCH", `/api/pdm/governance/predictions/${id}/suppress`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/governance/predictions"] });
    },
  });
}
