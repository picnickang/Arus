import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useEquipmentFeatures(equipmentId: string, from?: string, to?: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/features", currentOrgId, equipmentId, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ equipmentId });
      if (from) {
        params.append("from", from);
      }
      if (to) {
        params.append("to", to);
      }
      return apiRequest("GET", `/api/pdm/features?${params}`);
    },
    enabled: !!equipmentId && !!currentOrgId,
  });
}

export interface LatestFeatures {
  message?: string;
  sampleCount?: number;
  meanTemp?: number;
  stdTemp?: number;
  meanVibration?: number;
  stdVibration?: number;
  meanPressure?: number;
  stdPressure?: number;
  rmsVibration?: number;
  peakToPeak?: number;
  kurtosis?: number;
  skewness?: number;
  windowMinutes?: number;
  computedAt?: string;
  createdAt?: string;
}

export function useLatestFeatures(equipmentId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery<LatestFeatures | undefined>({
    queryKey: ["/api/pdm/features/latest", currentOrgId, equipmentId],
    queryFn: async () =>
      apiRequest(
        "GET",
        `/api/pdm/features/latest?equipmentId=${encodeURIComponent(equipmentId)}`
      ) as object as Promise<LatestFeatures | undefined>,
    enabled: !!equipmentId && !!currentOrgId,
  });
}

export function useComputeFeatures() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: async ({
      equipmentId,
      windowMinutes,
    }: {
      equipmentId: string;
      windowMinutes?: number;
    }) => {
      return apiRequest("POST", "/api/pdm/features/compute", { equipmentId, windowMinutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/features"] });
    },
  });
}
