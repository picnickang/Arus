import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface PipelineStage {
  key: string;
  label: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  timestamp: string | null;
  actor: string | null;
  actorName: string | null;
  details: Record<string, unknown> | null;
}

export interface PurchasePipeline {
  prId: string;
  currentStage: string;
  stages: PipelineStage[];
}

const pipelineKeys = {
  detail: (prId: string) => ["/api/purchase-requests", prId, "pipeline"] as const,
};

export function usePurchasePipeline(prId: string | undefined) {
  return useQuery<PurchasePipeline>({
    queryKey: pipelineKeys.detail(prId || ""),
    queryFn: () => apiRequest<PurchasePipeline>("GET", `/api/purchase-requests/${prId}/pipeline`),
    enabled: !!prId,
    refetchInterval: 30000,
  });
}
