import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useRunInference() {
  return useMutation({
    mutationFn: async ({ equipmentId, modelVersionId }: { equipmentId: string; modelVersionId?: string }) => {
      return apiRequest("POST", "/api/pdm/infer", { equipmentId, modelVersionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm"] });
    },
  });
}

export function usePredictionExplanations(predictionId: number | null) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/infer/predictions", predictionId, "explanations"],
    queryFn: async () => {
      const res = await fetch(`/api/pdm/infer/predictions/${predictionId}/explanations`, { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) throw new Error("Failed to fetch explanations");
      return res.json();
    },
    enabled: predictionId != null && !!currentOrgId,
  });
}
