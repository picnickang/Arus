import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  type PdmAlert,
  type PdmBaseline,
  type AnalysisResult,
  type BearingFormData,
} from "../types";
import {
  bearingFormSchema,
  pumpFormSchema,
  createDefaultBearingFormValues,
  createDefaultPumpFormValues,
} from "../lib/pdmUtils";

export function usePdmPackData() {
  const { currentOrgId } = useOrganization();

  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [bearingAnalysisResult, setBearingAnalysisResult] = useState<AnalysisResult | null>(null);
  const [pumpAnalysisResult, setPumpAnalysisResult] = useState<AnalysisResult | null>(null);

  const bearingForm = useForm<BearingFormData>({
    resolver: zodResolver(bearingFormSchema),
    defaultValues: createDefaultBearingFormValues(),
  });
  const pumpForm = useForm({
    resolver: zodResolver(pumpFormSchema),
    defaultValues: createDefaultPumpFormValues(),
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/pdm/alerts", currentOrgId],
    queryFn: async () => apiRequest<PdmAlert[]>("GET", "/api/pdm/alerts"),
    enabled: !!currentOrgId,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/pdm/health"],
    queryFn: async () => {
      const response = await fetch("/api/pdm/health");
      if (!response.ok) {
        throw new Error("Failed to fetch PdM service health");
      }
      return response.json();
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: baselines, isLoading: baselinesLoading } = useQuery({
    queryKey: ["/api/pdm/baseline", currentOrgId, selectedVessel, selectedAsset],
    queryFn: async () => {
      const result = await apiRequest<{ baselines: PdmBaseline[] }>(
        "GET",
        `/api/pdm/baseline/${selectedVessel}/${selectedAsset}`
      );
      return result.baselines ?? [];
    },
    enabled: !!currentOrgId && !!selectedVessel && !!selectedAsset,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const bearingAnalysisMutation = useCustomMutation<any, any>({
    mutationFn: (async (data: BearingFormData) => {
      const series = data.series
        .split(",")
        .map((s: string) => Number.parseFloat(s.trim()))
        .filter((n: number) => Number.isFinite(n));
      if (series.length < 10) {
        throw new Error("At least 10 data points required for analysis");
      }
      return apiRequest("POST", "/api/pdm/analyze/bearing", { ...data, series });
    }) as any,
    invalidateKeys: [
      ["/api/pdm/alerts", currentOrgId],
      ["/api/pdm/baseline", currentOrgId, selectedVessel, selectedAsset],
    ],
    successMessage: "Bearing vibration analysis completed successfully",
    errorMessage: ((error: Error) => error.message || "Failed to analyze bearing data") as any,
    onSuccess: (data: { analysis: AnalysisResult }) => setBearingAnalysisResult(data.analysis),
  });

  const pumpAnalysisMutation = useCustomMutation<any, any>({
    mutationFn: (async (data: z.infer<typeof pumpFormSchema>) => {
      const processedData: Record<string, string | boolean | number[]> = {
        vesselName: data.vesselName,
        assetId: data.assetId,
        autoBaseline: data.autoBaseline,
      };
      (["flow", "pressure", "current"] as const).forEach((field) => {
        const value = data[field] as string;
        if (value?.trim()) {
          const values = value
            .split(",")
            .map((s) => Number.parseFloat(s.trim()))
            .filter((n) => Number.isFinite(n));
          if (values.length > 0) {
            processedData[field] = values;
          }
        }
      });
      return apiRequest("POST", "/api/pdm/analyze/pump", processedData);
    }) as any,
    invalidateKeys: [
      ["/api/pdm/alerts", currentOrgId],
      ["/api/pdm/baseline", currentOrgId, selectedVessel, selectedAsset],
    ],
    successMessage: "Pump process analysis completed successfully",
    errorMessage: ((error: Error) => error.message || "Failed to analyze pump data") as any,
    onSuccess: (data: { analysis: AnalysisResult }) => setPumpAnalysisResult(data.analysis),
  });

  const recentAlerts = useMemo(
    () =>
      alerts?.filter((a) => {
        const alertTime = new Date(a.at).getTime();
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return alertTime > oneDayAgo;
      }) ?? [],
    [alerts]
  );
  const criticalCount = useMemo(
    () => recentAlerts.filter((a) => a.severity === "high").length,
    [recentAlerts]
  );
  const warningCount = useMemo(
    () => recentAlerts.filter((a) => a.severity === "warn").length,
    [recentAlerts]
  );
  const serviceStatus = healthData?.status === "operational";

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-500";
      case "warn":
        return "text-yellow-500";
      case "info":
        return "text-blue-500";
      default:
        return "text-muted-foreground";
    }
  };
  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "warn":
        return "secondary";
      case "info":
        return "outline";
      default:
        return "outline";
    }
  };

  return {
    currentOrgId,
    selectedVessel,
    setSelectedVessel,
    selectedAsset,
    setSelectedAsset,
    activeTab,
    setActiveTab,
    bearingAnalysisResult,
    pumpAnalysisResult,
    bearingForm,
    pumpForm,
    alerts,
    alertsLoading,
    healthData,
    healthLoading,
    baselines,
    baselinesLoading,
    bearingAnalysisMutation,
    pumpAnalysisMutation,
    recentAlerts,
    criticalCount,
    warningCount,
    serviceStatus,
    getSeverityColor,
    getSeverityBadgeColor,
  };
}
