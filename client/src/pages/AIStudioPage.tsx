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

const DATA_WINDOW_DAYS: Record<TrainingConfig["dataWindow"], number> = {
  bronze: 90,
  silver: 180,
  gold: 365,
  platinum: 730,
};

const MODEL_ALGORITHMS: Record<TrainingConfig["modelType"], string> = {
  lstm: "lstm",
  "random-forest": "rf",
  xgboost: "xgboost",
};

function buildIdempotencyKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function toMlTrainPayload(config: TrainingConfig) {
  const runtimeModelType =
    config.modelType === "lstm" ? "lstm" : config.modelType === "random-forest" ? "rf" : undefined;
  return {
    ...(runtimeModelType ? { modelType: runtimeModelType } : {}),
    algorithm: MODEL_ALGORITHMS[config.modelType],
    equipmentType: config.equipmentScope,
    dataWindowDays: DATA_WINDOW_DAYS[config.dataWindow],
    epochs: config.epochs,
    batchSize: config.batchSize,
    learningRate: config.learningRate,
    targetColumn: config.objective,
    windowSize: config.sequenceLength,
    hyperparameters: {
      objective: config.objective,
      sequenceLength: config.sequenceLength,
      numTrees: config.numTrees,
      maxDepth: config.maxDepth,
      lstmUnits: config.lstmUnits,
      dropoutRate: config.dropoutRate,
    },
  };
}

function toRetrainConfig(model: Model): TrainingConfig {
  return {
    modelType: model.modelType,
    objective: model.objective,
    equipmentScope: model.scope || "all",
    dataWindow: "gold",
    epochs: 100,
    sequenceLength: 10,
    learningRate: 0.001,
    numTrees: 100,
    maxDepth: 6,
    lstmUnits: 64,
    dropoutRate: 0.2,
    batchSize: 32,
  };
}

export default function AIStudioPage() {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accuracyTimeRange, setAccuracyTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Fetch ML models
  const { data: models = [], isLoading: modelsLoading } = useQuery<Model[]>({
    queryKey: ["/api/ml/models"],
  });

  // Fetch accuracy trend data (typed to the chart's data contract so no cast
  // is needed at the call site).
  const { data: accuracyData = [] } = useQuery<
    React.ComponentProps<typeof AccuracyTrendChart>["data"]
  >({
    queryKey: ["/api/ml/accuracy-trend", { range: accuracyTimeRange }],
  });

  // Fetch equipment types for training form
  const { data: equipmentTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/equipment/types"],
  });

  // Train model mutation
  const trainModelMutation = useMutation({
    mutationFn: async (config: TrainingConfig) => {
      return apiRequest("POST", "/api/ml/train", toMlTrainPayload(config), {
        headers: {
          "Idempotency-Key": buildIdempotencyKey("ml-train"),
        },
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
      return apiRequest("POST", `/api/ml/models/${modelId}/deploy`, undefined, {
        headers: {
          "Idempotency-Key": buildIdempotencyKey(`ml-deploy-${modelId}`),
        },
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
      return apiRequest("POST", `/api/ml/models/${modelId}/archive`, undefined, {
        headers: {
          "Idempotency-Key": buildIdempotencyKey(`ml-archive-${modelId}`),
        },
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

  const handleRetrain = (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) {
      toast({
        variant: "destructive",
        title: "Retraining Failed",
        description: "Could not find the selected model.",
      });
      return;
    }
    trainModelMutation.mutate(toRetrainConfig(model));
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
            label="Active Models"
            value={deployedModels}
            icon={Brain}
            {...(deployedModels > 0
              ? { trend: { direction: "up" as const, value: 12, label: "vs last month" } }
              : {})}
            data-testid="kpi-active-models"
          />
          <KpiCard
            label="Avg. Accuracy"
            value={`${avgAccuracy.toFixed(1)}%`}
            icon={TrendingUp}
            {...(avgAccuracy >= 80
              ? { trend: { direction: "up" as const, value: 5, label: "vs last month" } }
              : {})}
            data-testid="kpi-avg-accuracy"
          />
          <KpiCard
            label="In Training"
            value={trainingModels}
            icon={Activity}
            data-testid="kpi-in-training"
          />
          <KpiCard
            label="Need Attention"
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
            description={
              avgAccuracy >= 85
                ? "Excellent model performance across the fleet"
                : avgAccuracy >= 70
                  ? "Good performance, but some models need attention"
                  : "Several models require retraining"
            }
            status={avgAccuracy >= 85 ? "normal" : avgAccuracy >= 70 ? "pending" : "warning"}
            icon={TrendingUp}
            data-testid="insight-model-performance"
          />
          <InsightCard
            title="System Status"
            description={
              trainingModels > 0
                ? `${trainingModels} model(s) currently training`
                : "No active training jobs"
            }
            status={trainingModels > 0 ? "training" : "normal"}
            icon={Activity}
            data-testid="insight-system-status"
          />
        </div>

        {/* Accuracy Trend */}
        <AccuracyTrendChart
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
