import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useDeleteMutation, useCustomMutation } from "@/hooks/useCrudMutations";
import { useToast } from "@/hooks/use-toast";
import type { InsertStorageConfig } from "@shared/schema";

interface ProviderTestResult {
  ok: boolean;
  detail?: string;
}

export function useStorageSettings() {
  const { toast } = useToast();
  const [showNewConfig, setShowNewConfig] = useState(false);
  const [newConfig, setNewConfig] = useState<InsertStorageConfig>({
    id: "",
    kind: "object",
    provider: "s3",
    isDefault: false,
    mirror: false,
    cfg: {},
  });
  const [newOpsDbUrl, setNewOpsDbUrl] = useState("");
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});

  const { data: storageConfigsRaw, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ["/api/storage/config"],
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const storageConfigs = Array.isArray(storageConfigsRaw) ? storageConfigsRaw : [];
  const { data: currentOpsDb } = useQuery({ queryKey: ["/api/storage/ops-db/current"] });
  const { data: stagedOpsDb } = useQuery({ queryKey: ["/api/storage/ops-db/staged"] });

  const resetNewConfig = useCallback(() => {
    setNewConfig({
      id: "",
      kind: "object",
      provider: "s3",
      isDefault: false,
      mirror: false,
      cfg: {},
    });
  }, []);

  const saveConfigMutation = useCustomMutation<InsertStorageConfig, InsertStorageConfig>({
    mutationFn: async (config) => apiRequest("POST", "/api/storage/config", config),
    invalidateKeys: ["/api/storage/config"],
    successMessage: "Storage configuration saved successfully",
    onSuccess: () => {
      setShowNewConfig(false);
      resetNewConfig();
    },
  });
  const deleteConfigMutation = useDeleteMutation({
    endpoint: "/api/storage/config",
    invalidateKeys: ["/api/storage/config"],
    successMessage: "Storage configuration deleted",
  });
  const testConfigMutation = useCustomMutation<InsertStorageConfig, ProviderTestResult>({
    mutationFn: async (config) => apiRequest("POST", "/api/storage/config/test", config),
    onSuccess: (result, config) => {
      setTestResults((prev) => ({ ...prev, [config.id]: result }));
      toast({
        title: result.ok ? "Connection Successful" : "Connection Failed",
        description:
          result.detail ||
          (result.ok ? "Provider configuration is valid" : "Check configuration details"),
        variant: result.ok ? "default" : "destructive",
      });
    },
  });
  const stageOpsDbMutation = useCustomMutation<string, { staged: boolean }>({
    mutationFn: async (url) => apiRequest("POST", "/api/storage/ops-db/stage", { url }),
    invalidateKeys: ["/api/storage/ops-db/staged"],
    successMessage: "Database URL staged for next restart",
    onSuccess: () => setNewOpsDbUrl(""),
  });
  const testOpsDbMutation = useCustomMutation<string, ProviderTestResult>({
    mutationFn: async (url) => apiRequest("POST", "/api/storage/ops-db/test", { url }),
    onSuccess: (result) => {
      toast({
        title: result.ok ? "Database Connection Successful" : "Database Connection Failed",
        description:
          result.detail || (result.ok ? "Database URL is valid" : "Check connection string"),
        variant: result.ok ? "default" : "destructive",
      });
    },
  });

  const handleConfigChange = useCallback(
    (field: keyof InsertStorageConfig, value: string | boolean | Record<string, string>) => {
      setNewConfig((prev) => ({ ...prev, [field]: value }));
    },
    []
  );
  const handleCfgChange = useCallback((key: string, value: string) => {
    setNewConfig((prev) => ({ ...prev, cfg: { ...prev.cfg, [key]: value } }));
  }, []);

  const getProviderFields = useCallback((provider: string) => {
    switch (provider) {
      case "s3":
        return ["endpoint", "region", "accessKeyId", "secretAccessKey", "bucket", "forcePathStyle"];
      case "gcs":
        return ["projectId", "bucket", "keyFilename"];
      case "azure_blob":
        return ["accountName", "accountKey", "containerName"];
      case "gdrive":
        return ["serviceAccountJson", "folderId"];
      case "sftp":
        return ["host", "port", "username", "password", "path"];
      case "dropbox":
        return ["accessToken", "path"];
      default:
        return ["endpoint", "apiKey"];
    }
  }, []);

  return {
    storageConfigs,
    isLoadingConfigs,
    currentOpsDb,
    stagedOpsDb,
    showNewConfig,
    setShowNewConfig,
    newConfig,
    newOpsDbUrl,
    setNewOpsDbUrl,
    testResults,
    saveConfigMutation,
    deleteConfigMutation,
    testConfigMutation,
    stageOpsDbMutation,
    testOpsDbMutation,
    handleConfigChange,
    handleCfgChange,
    getProviderFields,
    resetNewConfig,
  };
}

export type { ProviderTestResult };
