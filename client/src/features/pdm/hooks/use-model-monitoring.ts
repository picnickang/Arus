import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useModelDrift(modelVersionId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/drift", currentOrgId, modelVersionId],
    queryFn: async () => {
      const res = await fetch(`/api/pdm/drift/${modelVersionId}`, { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) {throw new Error("Failed to fetch drift metrics");}
      return res.json();
    },
    enabled: !!modelVersionId && !!currentOrgId,
  });
}

export function useDriftSummary() {
  const { currentOrgId } = useOrganization();
  return useQuery<{ alertCount: number; monitoredVersions: number }>({
    queryKey: ["/api/pdm/drift", "summary", currentOrgId],
    queryFn: async () => {
      const res = await fetch("/api/pdm/drift", { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) {throw new Error("Failed to fetch drift summary");}
      return res.json();
    },
    enabled: !!currentOrgId,
  });
}

export function useComputeDrift() {
  return useMutation({
    mutationFn: async ({ modelVersionId, windowDays }: { modelVersionId: string; windowDays?: number }) => {
      return apiRequest("POST", `/api/pdm/drift/${modelVersionId}/compute`, { windowDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/drift"] });
    },
  });
}
