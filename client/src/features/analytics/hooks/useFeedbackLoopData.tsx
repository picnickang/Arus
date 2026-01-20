import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface RetrainingQueueResponse { queue: Array<{ id: number; modelId: string; modelName: string; modelType: string; equipmentType: string | null; triggerType: string; priority: number; reason: string | null; metadata: Record<string, unknown>; createdAt: Date; }>; summary: Array<{ triggerType: string; count: number; avgPriority: number; }>; totalPending: number; }
interface ModelImprovement { modelId: string; modelName: string; modelType: string; currentVersion: string; previousVersion: string | null; currentAccuracy: number | null; validationCount: number; deployedAt: Date | null; improvementStatus: "excellent" | "good" | "needs_improvement" | "pending"; }
interface CorrectionPatternsResponse { patterns: Array<{ feedbackType: string; equipmentType: string; isAccurate: boolean | null; flagReason: string | null; count: number; avgRating: number | null; }>; inaccuracyCount: number; flagReasons: Array<{ reason: string; count: number; }>; totalFeedback: number; }

export function useFeedbackLoopData() {
  const { data: retrainingQueue, isLoading: queueLoading } = useQuery<RetrainingQueueResponse>({ queryKey: ["/api/analytics/retraining-queue"], refetchInterval: 60000, staleTime: 30000 });
  const { data: modelImprovements, isLoading: improvementsLoading } = useQuery<ModelImprovement[]>({ queryKey: ["/api/analytics/model-improvements"], refetchInterval: 300000, staleTime: 120000 });
  const { data: correctionPatterns, isLoading: patternsLoading } = useQuery<CorrectionPatternsResponse>({ queryKey: ["/api/analytics/correction-patterns"], refetchInterval: 300000, staleTime: 120000 });

  const highPriorityCount = useMemo(() => retrainingQueue?.queue.filter((q) => q.priority >= 50).length ?? 0, [retrainingQueue]);
  const hasHighPriorityRetraining = highPriorityCount > 0;

  const getPriorityBadge = useCallback((priority: number) => {
    if (priority >= 80) { return <Badge className="bg-red-600" data-testid="badge-priority-critical">Critical</Badge>; }
    if (priority >= 50) { return <Badge className="bg-amber-600" data-testid="badge-priority-high">High</Badge>; }
    if (priority >= 20) { return <Badge className="bg-blue-600" data-testid="badge-priority-medium">Medium</Badge>; }
    return <Badge variant="outline" data-testid="badge-priority-low">Low</Badge>;
  }, []);

  const getImprovementBadge = useCallback((status: string) => {
    switch (status) { case "excellent": return <Badge className="bg-green-600" data-testid="badge-excellent">Excellent</Badge>; case "good": return <Badge className="bg-blue-600" data-testid="badge-good">Good</Badge>; case "needs_improvement": return <Badge className="bg-amber-600" data-testid="badge-needs-improvement">Needs Improvement</Badge>; default: return <Badge variant="secondary" data-testid="badge-pending">Pending</Badge>; }
  }, []);

  return { retrainingQueue, queueLoading, modelImprovements, improvementsLoading, correctionPatterns, patternsLoading, highPriorityCount, hasHighPriorityRetraining, getPriorityBadge, getImprovementBadge };
}

export type { RetrainingQueueResponse, ModelImprovement, CorrectionPatternsResponse };
