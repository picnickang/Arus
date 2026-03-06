import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useEquipmentFeatures(equipmentId: string, from?: string, to?: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/features", currentOrgId, equipmentId, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ equipmentId });
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      const res = await fetch(`/api/pdm/features?${params}`, { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) throw new Error("Failed to fetch features");
      return res.json();
    },
    enabled: !!equipmentId && !!currentOrgId,
  });
}

export function useLatestFeatures(equipmentId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/features/latest", currentOrgId, equipmentId],
    queryFn: async () => {
      const res = await fetch(`/api/pdm/features/latest?equipmentId=${equipmentId}`, { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) throw new Error("Failed to fetch latest features");
      return res.json();
    },
    enabled: !!equipmentId && !!currentOrgId,
  });
}

export function useComputeFeatures() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: async ({ equipmentId, windowMinutes }: { equipmentId: string; windowMinutes?: number }) => {
      return apiRequest("POST", "/api/pdm/features/compute", { equipmentId, windowMinutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/features"] });
    },
  });
}
