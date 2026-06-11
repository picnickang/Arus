import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useFleetBaselines(equipmentType: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/fleet/baselines", currentOrgId, equipmentType],
    queryFn: async () => {
      return apiRequest(
        "GET",
        `/api/pdm/fleet/baselines?equipmentType=${encodeURIComponent(equipmentType)}`
      );
    },
    enabled: !!equipmentType && !!currentOrgId,
  });
}

export function useFleetComparison(equipmentId: string, equipmentType: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/fleet/compare", currentOrgId, equipmentId, equipmentType],
    queryFn: async () => {
      const params = new URLSearchParams({ equipmentId, equipmentType });
      return apiRequest("GET", `/api/pdm/fleet/compare?${params}`);
    },
    enabled: !!equipmentId && !!equipmentType && !!currentOrgId,
  });
}

export function useComputeBaselines() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: async (equipmentType: string) => {
      return apiRequest("POST", "/api/pdm/fleet/baselines/compute", { equipmentType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/fleet"] });
    },
  });
}
