/**
 * AI Health Dashboard
 *
 * Consolidated AI/ML dashboard with tabbed layout.
 * Includes: Overview, Performance, Insights, Training, Reports
 */

import { useState, Suspense, lazy, useEffect } from "react";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  TrendingUp,
  Brain,
  Lightbulb,
  BarChart3,
  FileText,
  Settings,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchEquipmentHealthTyped } from "@/lib/api/equipment";
import { fetchFailurePredictions, fetchAnomalyDetections } from "@/lib/api";

const PerformanceTab = lazy(() => import("@/components/ai-health/PerformanceTab"));
const InsightsTab = lazy(() => import("@/components/ai-health/InsightsTab"));
const TrainingTab = lazy(() => import("@/components/ai-health/TrainingTab"));
const ReportsTab = lazy(() => import("@/components/ai-health/ReportsTab"));

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

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/equipment/health"],
    queryFn: () => fetchEquipmentHealthTyped(),
  });

  const { data: predictionsData, isLoading: predictionsLoading } = useQuery({
    queryKey: ["/api/analytics/predictions"],
    queryFn: () => fetchFailurePredictions({ page: 1, limit: 20 }),
  });

  const { data: anomaliesData, isLoading: anomaliesLoading } = useQuery({
    queryKey: ["/api/analytics/anomalies"],
    queryFn: () => fetchAnomalyDetections({ page: 1, limit: 50 }),
  });

  const isLoading = healthLoading || predictionsLoading || anomaliesLoading;

  const equipmentList = healthData?.results ?? [];
  const predictions = predictionsData?.results ?? [];
  const anomalies = anomaliesData?.results ?? [];

  const healthyCount = equipmentList.filter((e: any) => e.healthScore >= 75).length;
  const totalCount = equipmentList.length;
  const fleetHealthPercent = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;

  const activeAlerts = anomalies.filter((a: any) => !a.acknowledged).length;
  const predictedFailures = predictions.filter((p: any) => p.confidence >= 0.7).length;
  const maintenanceDue = predictions.filter((p: any) => {
    const daysUntil = p.daysUntilFailure ?? 30;
    return daysUntil <= 14;
  }).length;

  const topRecommendations = predictions
    .filter((p: any) => p.confidence >= 0.5)
    .slice(0, 5)
    .map((p: any) => ({
      equipment: p.equipmentName || p.equipmentId,
      action: p.recommendedAction || `Schedule maintenance within ${p.daysUntilFailure ?? 30} days`,
      urgency: p.confidence >= 0.8 ? "high" : p.confidence >= 0.6 ? "medium" : "low",
    }));

  const avgConfidence =
    predictions.length > 0
      ? predictions.reduce((sum: number, p: any) => sum + (p.confidence || 0), 0) /
        predictions.length
      : 0;

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

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-fleet-health">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Fleet Health</span>
                </div>
                <div className="text-3xl font-bold" data-testid="text-fleet-health">
                  {fleetHealthPercent}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {healthyCount} of {totalCount} healthy
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-alerts">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Active Alerts</span>
                </div>
                <div className="text-3xl font-bold" data-testid="text-active-alerts">
                  {activeAlerts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Require attention</p>
              </CardContent>
            </Card>

            <Card data-testid="card-predicted-failures">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">Predicted Issues</span>
                </div>
                <div className="text-3xl font-bold" data-testid="text-predicted">
                  {predictedFailures}
                </div>
                <p className="text-xs text-muted-foreground mt-1">High confidence predictions</p>
              </CardContent>
            </Card>

            <Card data-testid="card-maintenance-due">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Maintenance Due</span>
                </div>
                <div className="text-3xl font-bold" data-testid="text-maintenance">
                  {maintenanceDue}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Within 14 days</p>
              </CardContent>
            </Card>
          </div>
        )}

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
            <OverviewTab avgConfidence={avgConfidence} predictions={predictions} />
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
}: {
  avgConfidence: number;
  predictions: any[];
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
            <p className="text-lg font-semibold">3</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Training</p>
            <p className="text-lg font-semibold">7 days ago</p>
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
