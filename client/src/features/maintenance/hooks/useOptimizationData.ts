import { useState } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { POLL_INTERVALS, pollingInterval } from "@/lib/polling";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCreateMutation, useDeleteMutation, useCustomMutation } from "@/hooks/useCrudMutations";
import type {
  OptimizerConfiguration,
  OptimizationResult,
  TrendAnalysis,
  OptimizerConfigForm,
} from "@/features/maintenance";
import {
  optimizerConfigSchema,
  generateDateRange,
  createDefaultPriorityWeights,
  createDefaultOptimizerFormValues,
  getStatusVariant,
} from "@/features/maintenance";
import { formatCurrency as formatCurrencyUtil } from "@/lib/formatters";

interface OptimizationEquipment {
  id: string;
  name?: string;
  type?: string;
  location?: string;
}

interface RulPrediction {
  riskLevel: string;
  remainingDays: number;
  healthIndex: number;
  failureProbability: number;
  componentStatus?:
    | Array<{
        componentType: string;
        healthScore?: number | undefined;
        degradationMetric?: number | undefined;
        predictedFailureDays: number;
      }>
    | undefined;
  recommendations?: string[] | undefined;
}

export function useOptimizationData() {
  const { toast } = useToast();
  const _queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("scenarios");
  const [selectedConfiguration, setSelectedConfiguration] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const configForm = useForm<OptimizerConfigForm, unknown, OptimizerConfigForm>({
    resolver: zodResolver(optimizerConfigSchema),
    defaultValues: createDefaultOptimizerFormValues(),
  });

  interface OptimizationDashboardData {
    configurations: OptimizerConfiguration[];
    results: OptimizationResult[];
    trendInsights: TrendAnalysis[];
    equipment: OptimizationEquipment[];
    vessels: Array<{ id: string; name: string; active: boolean }>;
    sectionErrors?: Record<string, string>;
  }

  // One aggregate request replaces the five parallel configuration/result/
  // trend/equipment/vessel queries (server: GET /api/optimization/dashboard,
  // which previously meant 5 requests polled every 15s). The key keeps
  // "/api/optimization" as its first segment so mutations can prefix-
  // invalidate it alongside the legacy per-resource keys.
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    refetch: refetchDashboard,
  } = useQuery<OptimizationDashboardData>({
    queryKey: ["/api/optimization", "dashboard"],
    queryFn: async () => {
      return apiRequest<OptimizationDashboardData>("GET", "/api/optimization/dashboard");
    },
    staleTime: 10000,
    refetchInterval: pollingInterval(POLL_INTERVALS.FAST),
  });

  const configurations = dashboardData?.configurations;
  const optimizationResults = dashboardData?.results;
  const trendAnalyses = dashboardData?.trendInsights;
  const equipment = dashboardData?.equipment;
  const vessels = dashboardData?.vessels;
  const configurationsLoading = dashboardLoading;
  const resultsLoading = dashboardLoading;
  const trendsLoading = dashboardLoading;
  const equipmentLoading = dashboardLoading;
  const refetchConfigurations = refetchDashboard;
  const refetchResults = refetchDashboard;

  // Crew stays a standalone query: it's shared cache with the crew pages and
  // only feeds the fleet headcount stats here.
  const { data: crew } = useQuery<Array<{ id: string; name: string; active: boolean }>>({
    queryKey: ["/api/crew"],
    queryFn: async () => {
      return apiRequest<Array<{ id: string; name: string; active: boolean }>>("GET", "/api/crew");
    },
  });

  const fleetStats = {
    activeVessels: vessels?.filter((v) => v.active).length ?? 0,
    totalVessels: vessels?.length ?? 0,
    activeCrew: crew?.filter((c) => c.active).length ?? 0,
    totalCrew: crew?.length ?? 0,
  };

  const equipmentIds = equipment?.slice(0, 3).map((e) => e.id) ?? [];
  const rulQueries = useQueries({
    queries: equipmentIds.map((equipmentId: string) => ({
      queryKey: ["/api/equipment", equipmentId, "rul"],
      queryFn: async () => {
        try {
          return await apiRequest<RulPrediction>("GET", `/api/equipment/${equipmentId}/rul`);
        } catch {
          return null;
        }
      },
      enabled: !!equipmentId,
    })),
  });

  const createConfigMutation = useCreateMutation("/api/optimization/configurations", {
    invalidateKeys: ["/api/optimization/configurations", "/api/optimization"],
    successMessage: "Optimizer configuration created successfully",
    errorMessage: "Failed to create optimizer configuration",
    onSuccess: () => {
      setConfigDialogOpen(false);
      configForm.reset();
    },
  });

  const runOptimizationMutation = useCustomMutation({
    mutationFn: async ({
      configId,
      equipmentScope,
      timeHorizon,
    }: {
      configId: string;
      equipmentScope?: string[];
      timeHorizon?: number;
    }) => apiRequest("POST", "/api/optimization/run", { configId, equipmentScope, timeHorizon }),
    invalidateKeys: ["/api/optimization/results", "/api/optimization"],
    successMessage: "Optimization run started successfully",
    errorMessage: "Failed to start optimization run",
    onSuccess: () => {
      setRunDialogOpen(false);
    },
  });

  const deleteConfigMutation = useDeleteMutation("/api/optimization/configurations", {
    invalidateKeys: ["/api/optimization/configurations", "/api/optimization"],
    successMessage: "Configuration deleted successfully",
    errorMessage: "Failed to delete configuration",
  });

  const cancelOptimizationMutation = useCustomMutation({
    mutationFn: async (optimizationId: string) =>
      apiRequest("DELETE", `/api/optimization/cancel/${optimizationId}`),
    invalidateKeys: ["/api/optimization/results", "/api/optimization"],
    successMessage: "Optimization cancelled successfully",
    errorMessage: "Failed to cancel optimization",
  });

  const applyToProductionMutation = useCustomMutation({
    mutationFn: async (optimizationId: string) =>
      apiRequest("POST", `/api/optimization/${optimizationId}/apply`),
    invalidateKeys: ["/api/optimization/results", "/api/optimization"],
    successMessage: "Optimization applied to production successfully",
    errorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  });

  const downloadOptimizationMutation = useCustomMutation({
    mutationFn: async (optimizationId: string) => {
      const r = await fetch(`/api/optimization/${optimizationId}/download`);
      if (!r.ok) {
        throw new Error("Failed to download optimization");
      }
      const blob = await r.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `optimization-${optimizationId}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    successMessage: "Optimization results downloaded successfully",
    errorMessage: "Failed to download optimization results",
  });

  const deleteOptimizationMutation = useDeleteMutation("/api/optimization/results", {
    invalidateKeys: ["/api/optimization/results", "/api/optimization"],
    successMessage: "Optimization result deleted successfully",
    errorMessage: "Failed to delete optimization result",
  });

  const clearAllOptimizationsMutation = useCustomMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/optimization/results"),
    invalidateKeys: ["/api/optimization/results", "/api/optimization"],
    successMessage: (data: unknown) =>
      `Successfully cleared ${(data as { deletedCount: number }).deletedCount} optimization result(s)`,
    errorMessage: "Failed to clear optimization results",
  });

  const fleetOptimizationMutation = useCustomMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/optimization/run", {
        configId: configurations?.[0]?.id || "default-fleet-config",
        equipmentScope: [],
        timeHorizon: 30,
      }),
    invalidateKeys: ["/api/optimization/results", "/api/optimization"],
    successMessage: "Fleet optimization started successfully",
    errorMessage: "Failed to start fleet optimization",
    onSuccess: () => {
      setActiveTab("runs");
    },
  });

  const crewSchedulingMutation = useCustomMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/crew/schedule/plan-enhanced", {
        engine: "constraint_satisfaction",
        days: generateDateRange(14),
        shifts: [],
        crew: [],
        leaves: [],
        portCalls: [],
        drydocks: [],
        certifications: {},
        preferences: {
          weights: {
            unfilled: 1000,
            fairness: 20,
            night_over: 10,
            consec_night: 8,
            pref_off: 6,
            vessel_mismatch: 3,
          },
        },
        validate_stcw: true,
      }),
    successMessage: "Crew scheduling optimization completed successfully",
    errorMessage: "Failed to optimize crew scheduling",
  });

  const maintenanceSchedulingMutation = useCustomMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/beast/lp/optimize", {
        maxDailyWorkHours: 8,
        maxConcurrentJobs: 3,
        crewAvailability: [
          {
            crewMember: "maintenance-team-1",
            availableDays: generateDateRange(14),
            maxHoursPerDay: 8,
            skillLevel: 4,
            hourlyRate: 85,
          },
        ],
        partsBudget: 10000,
        timeHorizonDays: 14,
        priorityWeights: createDefaultPriorityWeights(),
      }),
    successMessage: "Maintenance scheduling optimization completed successfully",
    errorMessage: "Failed to schedule maintenance",
  });

  const getStatusBadge = (status: string) => {
    const variant = getStatusVariant(status);
    return { variant, iconName: variant.iconName, color: variant.color };
  };
  const formatCurrency = (amount: number | null) =>
    amount === null ? "N/A" : formatCurrencyUtil(amount);

  const filteredConfigurations =
    configurations?.filter((config) =>
      config.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? [];
  const filteredResults =
    optimizationResults?.filter((result) => {
      const matchesSearch = configurations
        ?.find((c) => c.id === result.configurationId)
        ?.name.toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || result.runStatus === statusFilter;
      return matchesSearch && matchesStatus;
    }) ?? [];

  const handleRefresh = () => {
    toast({
      title: "Refreshing optimization data...",
      description: "Updating configurations and results",
    });
    refetchConfigurations();
    refetchResults();
    setTimeout(() => {
      toast({ title: "Data refreshed", description: "Optimization data updated successfully" });
    }, 500);
  };
  const onSubmitConfig = (data: OptimizerConfigForm) => createConfigMutation.mutate(data);

  return {
    activeTab,
    setActiveTab,
    selectedConfiguration,
    setSelectedConfiguration,
    selectedResult,
    setSelectedResult,
    runDialogOpen,
    setRunDialogOpen,
    configDialogOpen,
    setConfigDialogOpen,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    configForm,
    configurations,
    configurationsLoading,
    refetchConfigurations,
    optimizationResults,
    resultsLoading,
    refetchResults,
    trendAnalyses,
    trendsLoading,
    equipment,
    equipmentLoading,
    rulQueries,
    vessels,
    crew,
    fleetStats,
    createConfigMutation,
    runOptimizationMutation,
    deleteConfigMutation,
    cancelOptimizationMutation,
    applyToProductionMutation,
    downloadOptimizationMutation,
    deleteOptimizationMutation,
    clearAllOptimizationsMutation,
    fleetOptimizationMutation,
    crewSchedulingMutation,
    maintenanceSchedulingMutation,
    getStatusBadge,
    formatCurrency,
    filteredConfigurations,
    filteredResults,
    handleRefresh,
    onSubmitConfig,
  };
}
