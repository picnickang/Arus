import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function usePredictionGovernance(status?: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/governance/predictions", { status }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const url = `/api/pdm/governance/predictions${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { headers: { "x-org-id": currentOrgId || "" } });
      if (!res.ok) throw new Error("Failed to fetch governance predictions");
      return res.json();
    },
    enabled: !!currentOrgId,
  });
}

export function useGovernanceDetail(id: number | null) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/governance/predictions", id],
    queryFn: async () => {
      const res = await fetch(`/api/pdm/governance/predictions/${id}`, { headers: { "x-org-id": currentOrgId || "" } });
      if (!res.ok) throw new Error("Failed to fetch governance details");
      return res.json();
    },
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
