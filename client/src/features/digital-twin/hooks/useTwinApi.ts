import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

// All reads go through apiRequest: real auth/org headers plus envelope
// unwrapping (/api/pdm/* is an enveloped domain).

export interface TwinTemplateSummary {
  id: string;
  name: string;
  equipmentType?: string;
  description?: string;
}

export function useTemplates() {
  const { currentOrgId } = useOrganization();
  return useQuery<TwinTemplateSummary[]>({
    queryKey: ["/api/pdm/twin/def/templates", currentOrgId],
    queryFn: () => apiRequest<TwinTemplateSummary[]>("GET", "/api/pdm/twin/def/templates"),
    enabled: !!currentOrgId,
  });
}

export function useCreateTemplate() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/pdm/twin/def/templates", { ...data, orgId: currentOrgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/def/templates"] });
    },
  });
}

export interface TwinSummary {
  id: string;
  name: string;
  equipmentId?: string;
  status?: string;
}

export function useTwins() {
  const { currentOrgId } = useOrganization();
  return useQuery<TwinSummary[]>({
    queryKey: ["/api/pdm/twin/def/twins", currentOrgId],
    queryFn: () => apiRequest<TwinSummary[]>("GET", "/api/pdm/twin/def/twins"),
    enabled: !!currentOrgId,
  });
}

export function useTwin(twinId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/def/twins", currentOrgId, twinId],
    queryFn: () => apiRequest("GET", `/api/pdm/twin/def/twins/${twinId}`),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useCreateTwin() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/pdm/twin/def/twins", { ...data, orgId: currentOrgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/def/twins"] });
    },
  });
}

/** Minimal computed-state shape consumed by the twin overview/state cards. */
export interface LatestTwinState {
  healthScore?: number;
  efficiencyScore?: number;
  remainingUsefulLifeHours?: number;
  error?: string;
  observedValues?: Record<string, number>;
  expectedValues?: Record<string, number>;
  [key: string]: unknown;
}

/** Timeline event shape consumed by the replay tab. */
export interface TwinTimelineEvent {
  id?: string;
  eventType?: string;
  type?: string;
  source?: string;
  timestamp?: string;
  payload?: unknown;
  [key: string]: unknown;
}

export function useLatestTwinState(twinId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/state/latest", currentOrgId, twinId],
    queryFn: () => apiRequest<LatestTwinState>("GET", `/api/pdm/twin/state/latest/${twinId}`),
    enabled: !!currentOrgId && !!twinId,
    retry: false,
  });
}

export function useTwinStateHistory(twinId: string, limit = 50) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/state/history", currentOrgId, twinId, limit],
    queryFn: () => apiRequest("GET", `/api/pdm/twin/state/history/${twinId}?limit=${limit}`),
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
    queryFn: () => apiRequest("GET", `/api/pdm/twin/residuals/twin/${twinId}?limit=${limit}`),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useResidualRankings() {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/twin/residuals/rankings", currentOrgId],
    queryFn: () => apiRequest("GET", "/api/pdm/twin/residuals/rankings"),
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
    queryFn: () => apiRequest("GET", `/api/pdm/twin/scenarios/twins/${twinId}`),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useRunScenario() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (data: { twinId: string; name: string; parameters: Record<string, unknown> }) =>
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
    queryFn: () => apiRequest<TwinTimelineEvent[]>("GET", `/api/pdm/twin/replay/timeline?${params}`),
    enabled: !!currentOrgId && !!twinId,
  });
}

export function useLogTwinEvent() {
  const { currentOrgId } = useOrganization();
  return useMutation({
    mutationFn: (data: {
      twinId: string;
      eventType: string;
      payload?: Record<string, unknown>;
      source?: string;
    }) => apiRequest("POST", "/api/pdm/twin/replay/events", { ...data, orgId: currentOrgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/twin/replay/timeline"] });
    },
  });
}
