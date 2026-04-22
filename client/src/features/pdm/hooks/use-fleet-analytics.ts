import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useFleetBaselines(equipmentType: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/fleet/baselines", currentOrgId, equipmentType],
    queryFn: async () => {
      const res = await fetch(`/api/pdm/fleet/baselines?equipmentType=${encodeURIComponent(equipmentType)}`, { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) {throw new Error("Failed to fetch baselines");}
      return res.json();
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
      const res = await fetch(`/api/pdm/fleet/compare?${params}`, { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) {throw new Error("Failed to fetch comparison");}
      return res.json();
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
