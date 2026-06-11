import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

// Reads go through apiRequest (auth headers + envelope unwrapping).

export interface TwinFreshnessInfo {
  twinId: string;
  twinName: string;
  status: string;
  lastStateUpdate: string | null;
  lastResidualUpdate: string | null;
  isStale: boolean;
  staleMinutes: number | null;
}

export function useTwinFreshness() {
  const { currentOrgId } = useOrganization();
  return useQuery<TwinFreshnessInfo[]>({
    queryKey: ["/api/pdm/twin/updates/freshness", currentOrgId],
    queryFn: () => apiRequest("GET", "/api/pdm/twin/updates/freshness"),
    enabled: !!currentOrgId,
    refetchInterval: 60000,
  });
}

export function useSingleTwinFreshness(twinId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery<TwinFreshnessInfo>({
    queryKey: ["/api/pdm/twin/updates/freshness", currentOrgId, twinId],
    queryFn: () => apiRequest("GET", `/api/pdm/twin/updates/freshness/${twinId}`),
    enabled: !!currentOrgId && !!twinId,
    refetchInterval: 60000,
  });
}

export function useRefreshTwin() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (twinId: string) => apiRequest("POST", `/api/pdm/twin/updates/refresh/${twinId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/updates/freshness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/state/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/residuals"] });
    },
  });
}

export function useRefreshAllTwins() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/pdm/twin/updates/refresh-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/updates/freshness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/state/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/residuals"] });
    },
  });
}
