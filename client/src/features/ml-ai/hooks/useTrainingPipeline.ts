import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useTrainingDatasets(status?: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/training/datasets", currentOrgId, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) {
        params.append("status", status);
      }
      const url = `/api/pdm/training/datasets${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { headers: { "x-org-id": currentOrgId || "default-org-id" } });
      if (!res.ok) {
        throw new Error("Failed to fetch training datasets");
      }
      return res.json();
    },
    enabled: !!currentOrgId,
  });
}

export function useTrainingRuns(filters?: { status?: string; datasetId?: string }) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/training/runs", currentOrgId, filters?.status, filters?.datasetId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) {
        params.append("status", filters.status);
      }
      if (filters?.datasetId) {
        params.append("datasetId", filters.datasetId);
      }
      const url = `/api/pdm/training/runs${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { headers: { "x-org-id": currentOrgId || "default-org-id" } });
      if (!res.ok) {
        throw new Error("Failed to fetch training runs");
      }
      return res.json();
    },
    enabled: !!currentOrgId,
  });
}

export function useCreateDataset() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      sourceType: string;
      description?: string;
      sourceConfig?: Record<string, unknown>;
      featureColumns?: string[];
      labelColumn?: string;
      targetType?: string;
      timeRangeStart?: string;
      timeRangeEnd?: string;
      rowCount?: number;
      splitConfig?: Record<string, unknown>;
      createdBy?: string;
    }) => {
      return apiRequest("POST", "/api/pdm/training/datasets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/training/datasets"] });
    },
  });
}

export function useStartTrainingRun() {
  return useMutation({
    mutationFn: async (data: {
      datasetId: string;
      config?: Record<string, unknown>;
      hyperparameters?: Record<string, unknown>;
      initiatedBy?: string;
    }) => {
      return apiRequest("POST", "/api/pdm/training/runs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/training/runs"] });
    },
  });
}

export function usePromoteRun() {
  return useMutation({
    mutationFn: async ({
      runId,
      modelId,
      version,
      changelog,
    }: {
      runId: string;
      modelId: string;
      version: string;
      changelog?: string;
    }) => {
      return apiRequest("POST", `/api/pdm/training/runs/${runId}/promote`, {
        modelId,
        version,
        changelog,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/training/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/models"] });
    },
  });
}

export function useTrainingArtifacts(modelVersionId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/training/artifacts", currentOrgId, modelVersionId],
    queryFn: async () => {
      const res = await fetch(`/api/pdm/training/artifacts?modelVersionId=${modelVersionId}`, {
        headers: { "x-org-id": currentOrgId || "default-org-id" },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch artifacts");
      }
      return res.json();
    },
    enabled: !!modelVersionId && !!currentOrgId,
  });
}
