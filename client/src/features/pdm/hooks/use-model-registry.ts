import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface ModelSummary {
  id: string;
  name: string;
  type: string;
  equipmentType?: string;
  status?: string;
  accuracy?: string;
}

export interface ModelVersionSummary {
  id: string;
  version: string | number;
  status: string;
  trainingDate?: string | Date;
  accuracy?: number;
  driftScore?: number;
  artifactPath?: string;
  trainingDataPoints?: number;
}

export interface ActiveDeploymentSummary {
  id?: string;
  modelVersionId?: string;
  status?: string;
}

export function useModels() {
  const { currentOrgId } = useOrganization();
  return useQuery<ModelSummary[]>({
    queryKey: ["/api/pdm/models", currentOrgId],
    queryFn: async () => apiRequest<ModelSummary[]>("GET", "/api/pdm/models"),
    enabled: !!currentOrgId,
  });
}

export function useModelVersions(modelId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery<ModelVersionSummary[]>({
    queryKey: ["/api/pdm/models", modelId, "versions", currentOrgId],
    queryFn: async () =>
      apiRequest<ModelVersionSummary[]>("GET", `/api/pdm/models/${modelId}/versions`),
    enabled: !!modelId && !!currentOrgId,
  });
}

export function useActiveDeployment(modelId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery<ActiveDeploymentSummary | null>({
    queryKey: ["/api/pdm/models", modelId, "deployment", currentOrgId],
    queryFn: async () =>
      apiRequest<ActiveDeploymentSummary | null>("GET", `/api/pdm/models/${modelId}/deployment`),
    enabled: !!modelId && !!currentOrgId,
  });
}

export function useDeployModel() {
  return useMutation({
    mutationFn: async ({
      modelId,
      modelVersionId,
      target,
    }: {
      modelId: string;
      modelVersionId: string;
      target?: string;
    }) => {
      return apiRequest("POST", `/api/pdm/models/${modelId}/deploy`, { modelVersionId, target });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/models"] });
    },
  });
}

export function useCreateVersion() {
  return useMutation({
    mutationFn: async ({
      modelId,
      ...data
    }: {
      modelId: string;
      version: string;
      artifactPath?: string;
      changelog?: string;
    }) => {
      return apiRequest("POST", `/api/pdm/models/${modelId}/versions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/models"] });
    },
  });
}
