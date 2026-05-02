import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useModelDrift(modelVersionId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/drift", currentOrgId, modelVersionId],
    queryFn: async () => apiRequest("GET", `/api/pdm/drift/${modelVersionId}`),
    enabled: !!modelVersionId && !!currentOrgId,
  });
}

export function useDriftSummary() {
  const { currentOrgId } = useOrganization();
  return useQuery<{ alertCount: number; monitoredVersions: number }>({
    queryKey: ["/api/pdm/drift", "summary", currentOrgId],
    queryFn: async () => apiRequest("GET", "/api/pdm/drift"),
    enabled: !!currentOrgId,
  });
}

export function useComputeDrift() {
  return useMutation({
    mutationFn: async ({
      modelVersionId,
      windowDays,
    }: {
      modelVersionId: string;
      windowDays?: number;
    }) => {
      return apiRequest("POST", `/api/pdm/drift/${modelVersionId}/compute`, { windowDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/drift"] });
    },
  });
}
