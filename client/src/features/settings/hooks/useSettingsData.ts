import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "@/lib/api";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import { useUnitPreferences } from "@/hooks/use-unit-preferences";
import type { SystemSettings } from "@shared/schema";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: { status: "pass" | "warn" | "fail"; responseTimeMs?: number; message?: string };
    telemetry: { status: "pass" | "warn" | "fail"; details?: { bufferUtilization: number } };
    memory: {
      status: "pass" | "warn" | "fail";
      details?: { heapUsedMB: number; utilizationPercent: number };
    };
    services: Array<{ name: string; status: "running" | "stopped" | "error" }>;
  };
}
export interface TestSuite {
  name: string;
  description: string;
  file: string;
  category: string;
}
export interface OpenAIKeyValidation {
  valid: boolean;
  status: "active" | "invalid" | "not_configured" | "rate_limited" | "error";
  message: string;
  source: "user_configured" | "ai_integrations" | null | "unknown";
}
export type { SystemSettings };

export function useSettingsData() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<SystemSettings>>({});
  const {
    preferences,
    setPowerUnit,
    setSpeedUnit,
    setWeightUnit,
    setTemperatureUnit,
    resetToDefaults,
  } = useUnitPreferences();

  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({ queryKey: ["/api/settings"], queryFn: fetchSettings });
  const { data: health } = useQuery<HealthCheckResult>({
    queryKey: ["/api/diagnostics/health"],
    refetchInterval: 60000,
  });
  const { data: testSuites } = useQuery<{
    suites: TestSuite[];
    totalCount: number;
    categories: string[];
  }>({ queryKey: ["/api/diagnostics/test-suites"] });
  const {
    data: openAIValidation,
    isLoading: isValidatingKey,
    refetch: refetchKeyValidation,
  } = useQuery<OpenAIKeyValidation>({
    queryKey: ["/api/settings/validate-openai-key"],
    staleTime: 60000,
  });

  const updateSettingsMutation = useCustomMutation<Partial<SystemSettings>, void>({
    mutationFn: ((data: Partial<SystemSettings>) => updateSettings(data)) as object as (data: Partial<SystemSettings>) => Promise<void>,
    invalidateKeys: ["/api/settings"],
    successMessage: "System settings have been successfully updated.",
  });
  const factoryResetMutation = useCustomMutation<void, { message: string; clearedTables: number }>({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/factory-reset", {
        confirmationCode: "FACTORY_RESET_CONFIRMED",
      }),
    onSuccess: (response) => {
      toast({
        title: "Factory Reset Complete",
        description: `${response.message}. ${response.clearedTables} tables cleared.`,
        variant: "destructive",
      });
      queryClient.clear();
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSave = useCallback(() => {
    updateSettingsMutation.mutate(formData);
  }, [formData, updateSettingsMutation]);
  const handleResetUnits = useCallback(() => {
    resetToDefaults();
    toast({
      title: "Units Reset",
      description: "All units have been reset to defaults (metric system)",
    });
  }, [resetToDefaults, toast]);
  const handleFactoryReset = useCallback(() => {
    factoryResetMutation.mutate();
  }, [factoryResetMutation]);

  return {
    formData,
    setFormData,
    settings,
    isLoading,
    error,
    health,
    testSuites,
    preferences,
    setPowerUnit,
    setSpeedUnit,
    setWeightUnit,
    setTemperatureUnit,
    updateSettingsMutation,
    factoryResetMutation,
    handleSave,
    handleResetUnits,
    handleFactoryReset,
    openAIValidation,
    isValidatingKey,
    refetchKeyValidation,
  };
}
