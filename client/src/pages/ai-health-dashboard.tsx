/**
 * AI Health Dashboard
 *
 * Consolidated AI/ML dashboard with tabbed layout.
 * Includes: Overview, Performance, Insights, Training, Reports
 */

import { useState, Suspense, lazy, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Brain,
  Lightbulb,
  BarChart3,
  FileText,
  Settings,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchFailurePredictions } from "@/lib/api";

const PerformanceTab = lazy(() => import("@/components/ai-health/PerformanceTab"));
const InsightsTab = lazy(() => import("@/components/ai-health/InsightsTab"));
const TrainingTab = lazy(() => import("@/components/ai-health/TrainingTab"));
const ReportsTab = lazy(() => import("@/components/ai-health/ReportsTab"));

interface MlModelRow {
  status?: string | null;
  trainedOn?: string | null;
  createdAt?: string | null;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return "Just now";
  }
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 1) {
    return "Just now";
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  }
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
}

function TabLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export default function AIHealthDashboard() {
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab");
    if (tab && ["overview", "performance", "insights", "training", "reports"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchString]);

  const { data: predictionsData } = useQuery({
    queryKey: ["/api/analytics/predictions"],
    queryFn: () => fetchFailurePredictions({ page: 1, limit: 20 }),
  });

  const { data: modelsData, isLoading: modelsLoading } = useQuery<MlModelRow[]>({
    queryKey: ["/api/ml/models"],
  });

  type PredictionItem = Awaited<
    ReturnType<typeof fetchFailurePredictions>
  >["results"][number] & {
    confidence?: number;
    daysUntilFailure?: number;
    recommendedAction?: string;
  };

  const predictions: PredictionItem[] = predictionsData?.results ?? [];

  const topRecommendations = predictions
    .filter((p) => (p.confidence ?? 0) >= 0.5)
    .slice(0, 5)
    .map((p) => ({
      equipment: p.equipmentName || p.equipmentId,
      action: p.recommendedAction || `Schedule maintenance within ${p.daysUntilFailure ?? 30} days`,
      urgency:
        (p.confidence ?? 0) >= 0.8 ? "high" : (p.confidence ?? 0) >= 0.6 ? "medium" : "low",
    }));

  const avgConfidence =
    predictions.length > 0
      ? predictions.reduce((sum, p) => sum + (p.confidence || 0), 0) / predictions.length
      : 0;

  const models: MlModelRow[] = modelsData ?? [];
  const modelsActive = models.filter((m) => m.status === "deployed").length;
  const lastTrainingLabel = (() => {
    const dates = models
      .map((m) => m.trainedOn ?? m.createdAt)
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (dates.length === 0) {
      return null;
    }
    const latest = dates.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
    return formatRelativeTime(latest);
  })();

  return (
    <div className="space-y-6" data-testid="page-ai-health">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Fleet AI Status</h2>
          </div>
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Multi-Model AI
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground -mt-2">
          Fleet health gauges and assets-at-risk now live in{" "}
          <Link href="/equipment-intelligence" className="text-primary underline">
            Equipment Intelligence
          </Link>
          . This view focuses on AI model performance, insights, and training.
        </p>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">AI Recommendations</CardTitle>
            </div>
            <CardDescription>Top priority actions based on AI analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {topRecommendations.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>No urgent recommendations. Fleet is operating well.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {topRecommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                    data-testid={`item-recommendation-${idx}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {rec.urgency === "high" ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : rec.urgency === "medium" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Lightbulb className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{rec.equipment}</p>
                      <p className="text-sm text-muted-foreground">{rec.action}</p>
                    </div>
                    <Badge
                      variant={rec.urgency === "high" ? "destructive" : "secondary"}
                      className="flex-shrink-0"
                    >
                      {rec.urgency}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
              <TabsTrigger
                value="overview"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
                data-testid="tab-overview"
              >
                <Brain className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Overview</span>
                <span className="sm:hidden">Summary</span>
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
                data-testid="tab-performance"
              >
                <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Performance</span>
                <span className="sm:hidden">Perf</span>
              </TabsTrigger>
              <TabsTrigger
                value="insights"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
                data-testid="tab-insights"
              >
                <Sparkles className="h-4 w-4 mr-1 sm:mr-2" />
                <span>Insights</span>
              </TabsTrigger>
              <TabsTrigger
                value="training"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
                data-testid="tab-training"
              >
                <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                <span>Training</span>
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
                data-testid="tab-reports"
              >
                <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                <span>Reports</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab
              avgConfidence={avgConfidence}
              predictions={predictions}
              modelsActive={modelsActive}
              modelsLoading={modelsLoading}
              lastTrainingLabel={lastTrainingLabel}
            />
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <PerformanceTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <InsightsTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="training" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <TrainingTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <ReportsTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OverviewTab({
  avgConfidence,
  predictions,
  modelsActive,
  modelsLoading,
  lastTrainingLabel,
}: {
  avgConfidence: number;
  predictions: { length: number };
  modelsActive: number;
  modelsLoading: boolean;
  lastTrainingLabel: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Technical Summary
        </CardTitle>
        <CardDescription>AI system performance metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">AI Accuracy</p>
            <p className="text-lg font-semibold">{(avgConfidence * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Models Active</p>
            <p className="text-lg font-semibold" data-testid="text-models-active">
              {modelsLoading ? "—" : modelsActive}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Training</p>
            <p className="text-lg font-semibold" data-testid="text-last-training">
              {modelsLoading ? "—" : (lastTrainingLabel ?? "No training yet")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Predictions</p>
            <p className="text-lg font-semibold">{predictions.length}</p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Model Ensemble</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">LSTM Neural Network</Badge>
            <Badge variant="outline">XGBoost</Badge>
            <Badge variant="outline">Random Forest</Badge>
          </div>
        </div>

        <div className="pt-4 border-t text-xs text-muted-foreground">
          <p>The AI system uses a 3-model hybrid ensemble with SHAP explainability.</p>
          <p className="mt-1">Models are retrained automatically when performance degrades.</p>
          <p className="mt-2">
            <strong>Navigate the tabs above</strong> for detailed model performance, AI insights,
            training controls, and AI-generated reports.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
