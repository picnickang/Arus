import { z } from "zod";

export interface OptimizerConfiguration {
  id: string;
  orgId: string;
  name: string;
  algorithmType: "greedy" | "genetic" | "simulated_annealing";
  enabled: boolean;
  config: string;
  maxSchedulingHorizon: number;
  costWeightFactor: number;
  urgencyWeightFactor: number;
  resourceConstraintStrict: boolean;
  conflictResolutionStrategy: "priority_based" | "cost_based" | "earliest_first";
  createdAt: string;
  updatedAt: string;
}

export interface OptimizationResult {
  id: string;
  orgId: string;
  configurationId: string;
  runStatus: "running" | "completed" | "failed";
  startTime: string;
  endTime: string | null;
  executionTimeMs: number | null;
  equipmentScope: string;
  timeHorizon: number;
  totalSchedules: number;
  totalCostEstimate: number | null;
  costSavings: number | null;
  resourceUtilization: string | null;
  conflictsResolved: number;
  optimizationScore: number | null;
  algorithmMetrics: string | null;
  recommendations: string | null;
  appliedToProduction: boolean;
}

export interface TrendAnalysis {
  equipmentId: string;
  sensorType: string;
  timeRange: {
    start: string;
    end: string;
  };
  statisticalSummary: {
    mean: number;
    standardDeviation: number;
    trend: {
      slope: number;
      trendType: "increasing" | "decreasing" | "stable" | "volatile";
    };
  };
  anomalyDetection: {
    totalAnomalies: number;
    anomalyRate: number;
    severity: "low" | "medium" | "high" | "critical";
  };
  forecasting: {
    method: string;
    predictions: Array<{
      timestamp: string;
      predictedValue: number;
    }>;
    confidence: number;
  };
}

export const optimizerConfigSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    algorithmType: z.enum(["greedy", "genetic", "simulated_annealing"]),
    enabled: z.boolean(),
    maxSchedulingHorizon: z.number().min(1).max(365),
    costWeightFactor: z.number().min(0).max(1),
    urgencyWeightFactor: z.number().min(0).max(1),
    resourceConstraintStrict: z.boolean(),
    conflictResolutionStrategy: z.enum(["priority_based", "cost_based", "earliest_first"]),
  })
  .refine(
    (data) => {
      const sum = data.costWeightFactor + data.urgencyWeightFactor;
      return sum <= 1.01;
    },
    {
      message: "Cost weight factor and urgency weight factor must sum to 1 or less",
      path: ["urgencyWeightFactor"],
    }
  );

export type OptimizerConfigForm = z.infer<typeof optimizerConfigSchema>;

export function formatDurationMs(ms: number | null): string {
  if (!ms) {
    return "N/A";
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export type OptimizationStatus = "running" | "completed" | "failed";

export interface StatusVariant {
  color: string;
  iconName: "loader" | "check" | "x";
}

export const STATUS_VARIANTS: Record<OptimizationStatus, StatusVariant> = {
  running: { color: "bg-blue-500", iconName: "loader" },
  completed: { color: "bg-green-500", iconName: "check" },
  failed: { color: "bg-red-500", iconName: "x" },
};

export function getStatusVariant(status: string): StatusVariant {
  return STATUS_VARIANTS[status as OptimizationStatus] || STATUS_VARIANTS.failed;
}

export const ALGORITHM_LABELS: Record<string, string> = {
  greedy: "Greedy (Fast)",
  genetic: "Genetic Algorithm",
  simulated_annealing: "Simulated Annealing",
};

export const CONFLICT_RESOLUTION_LABELS: Record<string, string> = {
  priority_based: "Priority Based",
  cost_based: "Cost Based",
  earliest_first: "Earliest First",
};

export function getAlgorithmLabel(algorithmType: string): string {
  return ALGORITHM_LABELS[algorithmType] || algorithmType;
}

export function getConflictResolutionLabel(strategy: string): string {
  return CONFLICT_RESOLUTION_LABELS[strategy] || strategy;
}

export function generateDateRange(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split("T")[0] ?? "";
  });
}

export function createDefaultPriorityWeights() {
  return {
    critical: 100,
    high: 50,
    medium: 20,
    low: 10,
  };
}

export function createDefaultOptimizerFormValues(): OptimizerConfigForm {
  return {
    name: "",
    algorithmType: "greedy",
    enabled: true,
    maxSchedulingHorizon: 90,
    costWeightFactor: 0.4,
    urgencyWeightFactor: 0.6,
    resourceConstraintStrict: true,
    conflictResolutionStrategy: "priority_based",
  };
}

export const OPTIMIZATION_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
] as const;
