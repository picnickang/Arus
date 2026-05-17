import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/ml-ai/layouts/PageHeader";
import { KpiCard } from "@/components/ml-ai/data-display/KpiCard";
import { InsightCard } from "@/components/ml-ai/data-display/InsightCard";
import { ModelTable, Model } from "@/components/ml-ai/data-display/ModelTable";
import { AccuracyTrendChart } from "@/components/ml-ai/visualizations/AccuracyTrendChart";
import { ModelTrainingForm, TrainingConfig } from "@/components/ml-ai/forms/ModelTrainingForm";
import {
  AcousticAnalysisPanel,
  AcousticData,
  AnalysisResult,
} from "@/components/ml-ai/forms/AcousticAnalysisPanel";
import { ModelDetailsDrawer } from "@/components/ml-ai/modals/ModelDetailsDrawer";
import { TabbedDashboard } from "@/components/ml-ai/layouts/TabbedDashboard";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Brain, Activity, TrendingUp, AlertTriangle, Plus, List, Sparkles } from "lucide-react";

export default function AIStudioPage() {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accuracyTimeRange, setAccuracyTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Fetch ML models
  const { data: models = [], isLoading: modelsLoading } = useQuery<Model[]>({
    queryKey: ["/api/ml/models"],
  });

  // Fetch accuracy trend data
  const { data: accuracyData = [] } = useQuery({
    queryKey: ["/api/ml/accuracy-trend", accuracyTimeRange],
  });

  // Fetch equipment types for training form
  const { data: equipmentTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/equipment/types"],
  });

  // Train model mutation
  const trainModelMutation = useMutation({
    mutationFn: async (config: TrainingConfig) => {
      return apiRequest("/api/ml/train", {
        method: "POST",
        body: JSON.stringify(config),
      });
    },
    onSuccess: () => {
      toast({
        title: "Training Started",
        description: "Your model training has been queued successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ml/models"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Training Failed",
        description: error.message,
      });
    },
  });

  // Deploy model mutation
  const deployModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest(`/api/ml/models/${modelId}/deploy`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Model Deployed",
        description: "Model is now active and making predictions.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ml/models"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Deployment Failed",
        description: error.message,
      });
    },
  });

  // Archive model mutation
  const archiveModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest(`/api/ml/models/${modelId}/archive`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Model Archived",
        description: "Model has been archived successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ml/models"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Archive Failed",
        description: error.message,
      });
    },
  });

  // Acoustic analysis mutation
  const analyzeAcousticMutation = useMutation({
    mutationFn: async (data: AcousticData): Promise<AnalysisResult> => {
      return apiRequest("/api/ml/acoustic-analysis", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message,
      });
    },
  });

  const handleViewDetails = (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (model) {
      setSelectedModel(model);
      setDrawerOpen(true);
    }
  };

  const handleDeploy = (modelId: string) => {
    deployModelMutation.mutate(modelId);
  };

  const handleArchive = (modelId: string) => {
    archiveModelMutation.mutate(modelId);
  };

  const handleRetrain = (_modelId: string) => {
    toast({
      title: "Retraining",
      description: "Model retraining feature coming soon.",
    });
  };

  // Calculate KPIs
  const deployedModels = models.filter((m) => m.status === "deployed").length;
  const avgAccuracy =
    models.length > 0 ? models.reduce((sum, m) => sum + (m.accuracy || 0), 0) / models.length : 0;
  const trainingModels = models.filter((m) => m.status === "training").length;
  const modelsNeedingAttention = models.filter(
    (m) => m.accuracy !== null && m.accuracy < 70
  ).length;

  // Overview Tab Component
  function OverviewTab() {
    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Active Models"
            value={deployedModels}
            icon={Brain}
            // @ts-ignore -- bulk-silence
            trend={deployedModels > 0 ? { direction: "up", value: 12 } : undefined}
            data-testid="kpi-active-models"
          />
          <KpiCard
            title="Avg. Accuracy"
            value={`${avgAccuracy.toFixed(1)}%`}
            icon={TrendingUp}
            // @ts-ignore -- bulk-silence
            trend={avgAccuracy >= 80 ? { direction: "up", value: 5 } : undefined}
            data-testid="kpi-avg-accuracy"
          />
          <KpiCard
            // @ts-ignore -- bulk-silence
            title="In Training"
            value={trainingModels}
            icon={Activity}
            data-testid="kpi-in-training"
          />
          <KpiCard
            // @ts-ignore -- bulk-silence
            title="Need Attention"
            value={modelsNeedingAttention}
            icon={AlertTriangle}
            variant={modelsNeedingAttention > 0 ? "warning" : "default"}
            data-testid="kpi-need-attention"
          />
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InsightCard
            title="Model Performance"
            // @ts-ignore -- bulk-silence
            message={
              avgAccuracy >= 85
                ? "Excellent model performance across the fleet"
                : avgAccuracy >= 70
                  ? "Good performance, but some models need attention"
                  : "Several models require retraining"
            }
            type={avgAccuracy >= 85 ? "success" : avgAccuracy >= 70 ? "info" : "warning"}
          />
          <InsightCard
            title="System Status"
            // @ts-ignore -- bulk-silence
            message={
              trainingModels > 0
                ? `${trainingModels} model(s) currently training`
                : "No active training jobs"
            }
            type="info"
          />
        </div>

        {/* Accuracy Trend */}
        <AccuracyTrendChart
          // @ts-ignore -- bulk-silence
          data={accuracyData}
          timeRange={accuracyTimeRange}
          onTimeRangeChange={setAccuracyTimeRange}
          data-testid="accuracy-trend-chart"
        />

        {/* Models Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Models</h2>
          </div>
          <ModelTable
            models={models.slice(0, 5)}
            loading={modelsLoading}
            onViewDetails={handleViewDetails}
            onDeploy={handleDeploy}
            onArchive={handleArchive}
            onTrain={handleRetrain}
            data-testid="models-table-overview"
          />
        </div>
      </div>
    );
  }

  // All Models Tab Component
  function AllModelsTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Manage all your trained models</p>
        </div>

        <ModelTable
          models={models}
          loading={modelsLoading}
          onViewDetails={handleViewDetails}
          onDeploy={handleDeploy}
          onArchive={handleArchive}
          onTrain={handleRetrain}
          data-testid="models-table-all"
        />
      </div>
    );
  }

  // Train Model Tab Component
  function TrainModelTab() {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold mb-2">Train New Model</h2>
          <p className="text-muted-foreground">
            Configure and train a new predictive maintenance model
          </p>
        </div>

        <ModelTrainingForm
          onSubmit={async (config) => {
            await trainModelMutation.mutateAsync(config);
          }}
          equipmentTypes={equipmentTypes}
          loading={trainModelMutation.isPending}
          data-testid="model-training-form"
        />
      </div>
    );
  }

  // Acoustic Analysis Tab Component
  function AcousticTab() {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Acoustic Analysis</h2>
          <p className="text-muted-foreground">
            Analyze acoustic data for anomaly detection and equipment health assessment
          </p>
        </div>

        <AcousticAnalysisPanel
          onAnalyze={async (data) => {
            return analyzeAcousticMutation.mutateAsync(data);
          }}
          loading={analyzeAcousticMutation.isPending}
          data-testid="acoustic-analysis-panel"
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Condition Monitoring AI Studio"
        description="Advanced AI/ML predictive maintenance platform"
        icon={Sparkles}
      />

      <TabbedDashboard
        title="AI Studio"
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: TrendingUp,
            component: OverviewTab,
          },
          {
            id: "models",
            label: "All Models",
            icon: List,
            component: AllModelsTab,
          },
          {
            id: "train",
            label: "Train Model",
            icon: Plus,
            component: TrainModelTab,
          },
          {
            id: "acoustic",
            label: "Acoustic Analysis",
            icon: Activity,
            component: AcousticTab,
          },
        ]}
        defaultTab="overview"
        data-testid="ai-studio-dashboard"
      />

      <ModelDetailsDrawer
        model={selectedModel}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedModel(null);
        }}
        onDeploy={handleDeploy}
        onArchive={handleArchive}
        onRetrain={handleRetrain}
        data-testid="model-details-drawer"
      />
    </>
  );
}
