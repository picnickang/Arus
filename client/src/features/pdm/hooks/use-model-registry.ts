import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useModels() {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/models", currentOrgId],
    queryFn: async () => {
      const res = await fetch("/api/pdm/models", { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) {throw new Error("Failed to fetch models");}
      return res.json();
    },
    enabled: !!currentOrgId,
  });
}

export function useModelVersions(modelId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/models", modelId, "versions", currentOrgId],
    queryFn: async () => {
      const res = await fetch(`/api/pdm/models/${modelId}/versions`, { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) {throw new Error("Failed to fetch versions");}
      return res.json();
    },
    enabled: !!modelId && !!currentOrgId,
  });
}

export function useActiveDeployment(modelId: string) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/models", modelId, "deployment", currentOrgId],
    queryFn: async () => {
      const res = await fetch(`/api/pdm/models/${modelId}/deployment`, { headers: { "x-org-id": currentOrgId } });
      if (!res.ok) {throw new Error("Failed to fetch deployment");}
      return res.json();
    },
    enabled: !!modelId && !!currentOrgId,
  });
}

export function useDeployModel() {
  return useMutation({
    mutationFn: async ({ modelId, modelVersionId, target }: { modelId: string; modelVersionId: string; target?: string }) => {
      return apiRequest("POST", `/api/pdm/models/${modelId}/deploy`, { modelVersionId, target });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/models"] });
    },
  });
}

export function useCreateVersion() {
  return useMutation({
    mutationFn: async ({ modelId, ...data }: { modelId: string; version: string; artifactPath?: string; changelog?: string }) => {
      return apiRequest("POST", `/api/pdm/models/${modelId}/versions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm/models"] });
    },
  });
}
