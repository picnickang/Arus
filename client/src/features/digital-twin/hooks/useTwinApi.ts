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

export function useTemplates() {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/def/templates", currentOrgId],
    queryFn: () => fetchJson("/api/pdm/twin/def/templates", currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
}

export function useCreateTemplate() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("POST", "/api/pdm/twin/def/templates", { ...data, orgId: currentOrgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/def/templates"] });
    },
  });
}

export function useTwins() {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/def/twins", currentOrgId],
    queryFn: () => fetchJson("/api/pdm/twin/def/twins", currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
}

export function useTwin(twinId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/def/twins", currentOrgId, twinId],
    queryFn: () => fetchJson(`/api/pdm/twin/def/twins/${twinId}`, currentOrgId ?? ""),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useCreateTwin() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("POST", "/api/pdm/twin/def/twins", { ...data, orgId: currentOrgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/def/twins"] });
    },
  });
}

export function useLatestTwinState(twinId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/state/latest", currentOrgId, twinId],
    queryFn: () => fetchJson(`/api/pdm/twin/state/latest/${twinId}`, currentOrgId ?? ""),
    enabled: !!currentOrgId && !!twinId,
    retry: false,
  });
}

export function useTwinStateHistory(twinId: string, limit = 50) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/state/history", currentOrgId, twinId, limit],
    queryFn: () => fetchJson(`/api/pdm/twin/state/history/${twinId}?limit=${limit}`, currentOrgId ?? ""),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useComputeTwinState() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (twinId: string) => apiRequest("POST", "/api/pdm/twin/state/compute", { twinId }),
    onSuccess: (_data, twinId) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/pdm/twin/state/latest", currentOrgId, twinId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/pdm/twin/state/history", currentOrgId, twinId],
      });
    },
  });
}

export function useTwinResiduals(twinId: string, limit = 100) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/residuals/twin", currentOrgId, twinId, limit],
    queryFn: () => fetchJson(`/api/pdm/twin/residuals/twin/${twinId}?limit=${limit}`, currentOrgId ?? ""),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useResidualRankings() {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/residuals/rankings", currentOrgId],
    queryFn: () => fetchJson("/api/pdm/twin/residuals/rankings", currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
}

export function useComputeResiduals() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (twinId: string) =>
      apiRequest("POST", "/api/pdm/twin/residuals/compute", { twinId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/residuals"] });
    },
  });
}

export function useTwinScenarios(twinId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/scenarios/twins", currentOrgId, twinId],
    queryFn: () => fetchJson(`/api/pdm/twin/scenarios/twins/${twinId}`, currentOrgId ?? ""),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useRunScenario() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (data: { twinId: string; name: string; parameters: Record<string, any> }) =>
      apiRequest("POST", "/api/pdm/twin/scenarios/run", data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/pdm/twin/scenarios/twins", currentOrgId, vars.twinId],
      });
    },
  });
}

export function useTwinTimeline(twinId: string, startTime?: string, endTime?: string) {
  const { currentOrgId } = useOrganization();
  const params = new URLSearchParams({ twinId });
  if (startTime) {
    params.set("startTime", startTime);
  }
  if (endTime) {
    params.set("endTime", endTime);
  }
  return useQuery({
    queryKey: ["/api/pdm/twin/replay/timeline", currentOrgId, twinId, startTime, endTime],
    queryFn: () => fetchJson(`/api/pdm/twin/replay/timeline?${params}`, currentOrgId ?? ""),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useLogTwinEvent() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (data: {
      twinId: string;
      eventType: string;
      payload?: Record<string, any>;
      source?: string;
    }) => apiRequest("POST", "/api/pdm/twin/replay/events", { ...data, orgId: currentOrgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/replay/timeline"] });
    },
  });
}
