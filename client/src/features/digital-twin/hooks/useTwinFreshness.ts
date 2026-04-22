import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

function orgHeaders(orgId: string) {
  return { "x-org-id": orgId };
}

async function fetchJson(url: string, orgId: string) {
  const res = await fetch(url, { headers: orgHeaders(orgId) });
  if (!res.ok) {
    throw new Error(`Failed: ${res.statusText}`);
  }
  return res.json();
}

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
    queryFn: () => fetchJson("/api/pdm/twin/updates/freshness", currentOrgId!),
    enabled: !!currentOrgId,
    refetchInterval: 60000,
  });
}

export function useSingleTwinFreshness(twinId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery<TwinFreshnessInfo>({
    queryKey: ["/api/pdm/twin/updates/freshness", currentOrgId, twinId],
    queryFn: () => fetchJson(`/api/pdm/twin/updates/freshness/${twinId}`, currentOrgId!),
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
