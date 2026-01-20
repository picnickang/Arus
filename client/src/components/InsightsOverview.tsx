import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Brain,
  TrendingUp,
  Target,
  Zap,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchLatestInsightSnapshot,
  triggerInsightsGeneration,
  fetchInsightsJobStats,
} from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface InsightSnapshotData {
  id: string;
  createdAt: string;
  summary?: string;
  insights?: Array<{ type: string; title: string; description: string; severity?: string }>;
  metrics?: { healthScore?: number; efficiency?: number; uptime?: number };
}

interface JobStatsData {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

interface InsightsOverviewProps {
  orgId?: string;
  scope?: string;
  prefetchedSnapshot?: InsightSnapshotData | null;
  prefetchedJobStats?: JobStatsData | null;
}

export function InsightsOverview({
  orgId = "default-org-id",
  scope = "fleet",
  prefetchedSnapshot,
  prefetchedJobStats,
}: InsightsOverviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Fetch latest insights snapshot - use initialData for prefetched data so mutations can still refetch
  const {
    data: latestSnapshot,
    isLoading: snapshotLoading,
    error: snapshotError,
  } = useQuery({
    queryKey: ["/api/insights/snapshots/latest", orgId, scope],
    queryFn: () => fetchLatestInsightSnapshot(orgId, scope),
    staleTime: 300000,
    refetchInterval: 300000,
    initialData: prefetchedSnapshot ?? undefined,
    retry: (failureCount, error: Error) => {
      if (error?.message?.includes("404")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const { data: jobStats } = useQuery({
    queryKey: ["/api/insights/jobs/stats"],
    queryFn: fetchInsightsJobStats,
    staleTime: 120000,
    refetchInterval: 120000,
    initialData: prefetchedJobStats ?? undefined,
  });

  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    try {
      await triggerInsightsGeneration(orgId, scope);
      toast({
        title: "Insights Generation Started",
        description: "Fleet insights are being generated. This may take 1-2 minutes.",
      });

      // Refresh the snapshot query after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/insights/snapshots/latest"] });
      }, 5000);
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: (error as Error).message || "Failed to generate insights",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Show loading state
  if (snapshotLoading && !latestSnapshot) {
    return (
      <Card data-testid="insights-overview">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fleet Insights</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no snapshots exist yet
  if (snapshotError || !latestSnapshot) {
    return (
      <Card data-testid="insights-overview">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fleet Insights</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              No insights generated yet. Create your first fleet insights analysis.
            </p>
            <Button
              onClick={handleGenerateInsights}
              disabled={isGenerating}
              size="sm"
              data-testid="button-generate-insights"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { kpi, risks, recommendations } = latestSnapshot;
  const generatedAt = new Date(latestSnapshot.createdAt);

  const totalRisks = (risks?.critical?.length || 0) + (risks?.warnings?.length || 0);
  const riskLevel =
    (risks?.critical?.length || 0) > 0
      ? "High"
      : (risks?.warnings?.length || 0) > 0
        ? "Medium"
        : "Low";

  return (
    <div className="space-y-4" data-testid="insights-overview">
      {/* Compact Header with Inline Stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <CardTitle className="text-sm font-medium">Fleet Insights</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Generated {formatDistanceToNow(generatedAt, { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {jobStats?.totalJobs > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {jobStats.completedJobs}/{jobStats.totalJobs}
                </Badge>
              )}
              <Button
                onClick={handleGenerateInsights}
                disabled={isGenerating}
                size="sm"
                variant="outline"
                data-testid="button-refresh-insights"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Compact Inline Stats */}
          <div className="flex flex-wrap items-center gap-4 md:gap-6 px-3 py-2 bg-muted/30 dark:bg-muted/20 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Vessels:</span>
              <span className="text-sm font-bold" data-testid="metric-fleet-vessels">
                {kpi?.fleet?.vessels || 0}
              </span>
              <span className="text-xs text-muted-foreground">
                ({kpi?.fleet?.signalsMapped || 0} mapped)
              </span>
            </div>
            <div className="hidden md:block h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${riskLevel === "High" ? "text-red-600 dark:text-red-400" : riskLevel === "Medium" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
              />
              <span className="text-sm text-muted-foreground">Risk:</span>
              <span
                className={`text-sm font-bold ${riskLevel === "High" ? "text-red-700 dark:text-red-300" : riskLevel === "Medium" ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300"}`}
                data-testid="metric-risk-level"
              >
                {riskLevel}
              </span>
              <span className="text-xs text-muted-foreground">({totalRisks} factors)</span>
            </div>
            <div className="hidden md:block h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Signals:</span>
              <span className="text-sm font-bold" data-testid="metric-discovered-signals">
                {kpi?.fleet?.signalsDiscovered || 0}
              </span>
              <span className="text-xs text-muted-foreground">
                ({kpi?.fleet?.dq7d || 0} DQ events)
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Risk Summary */}
          {(risks?.critical?.length > 0 || risks?.warnings?.length > 0) && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Active Risks</h4>
              <div className="space-y-2">
                {risks.critical?.slice(0, 2).map((risk: string, index: number) => (
                  <div key={`critical-${index}`} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground" data-testid={`risk-critical-${index}`}>
                      {risk}
                    </p>
                  </div>
                ))}
                {risks.warnings?.slice(0, 1).map((risk: string, index: number) => (
                  <div key={`warning-${index}`} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                    <p className="text-muted-foreground" data-testid={`risk-warning-${index}`}>
                      {risk}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations Preview */}
          {recommendations?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Top Recommendations</h4>
              <div className="space-y-2">
                {recommendations.slice(0, 3).map((rec: string, index: number) => (
                  <div key={rec} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-chart-3 mt-2 flex-shrink-0" />
                    <p className="text-muted-foreground" data-testid={`recommendation-${index}`}>
                      {rec}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
