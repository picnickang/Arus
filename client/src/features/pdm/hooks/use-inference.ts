import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface InferenceResult {
  inferenceRun?: {
    status?: string;
    latencyMs?: number;
    predictionId?: number;
  };
  prediction: {
    failureProbability: number;
    riskLevel: string;
    remainingUsefulLife: number;
    recommendations?: string[];
  };
}

export interface PredictionExplanation {
  id: string | number;
  featureName: string;
  importance: number;
  featureValue?: number;
  baselineValue?: number;
  direction?: "increasing" | "decreasing" | "stable" | string;
}

export function useRunInference() {
  return useMutation({
    mutationFn: async ({
      equipmentId,
      modelVersionId,
    }: {
      equipmentId: string;
      modelVersionId?: string;
    }) => {
      return apiRequest<InferenceResult>("POST", "/api/pdm/infer", { equipmentId, modelVersionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdm"] });
    },
  });
}

export function usePredictionExplanations(predictionId: number | null) {
  const { currentOrgId } = useOrganization();
  return useQuery({
    queryKey: ["/api/pdm/infer/predictions", predictionId, "explanations"],
    queryFn: async () =>
      apiRequest<PredictionExplanation[]>(
        "GET",
        `/api/pdm/infer/predictions/${predictionId}/explanations`,
      ),
    enabled: predictionId != null && !!currentOrgId,
  });
}
