import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import {
  createDefaultLstmConfig,
  createDefaultRandomForestConfig,
  parseAcousticData,
  validateAcousticData,
  getUniqueEquipmentTypes,
} from "../lib/trainingUtils";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { MlModelDisplay } from "../types";

interface AcousticAnalysisResult {
  healthScore?: number;
  severity: string;
  features?: Record<string, any>;
  primaryIssues: string[];
  recommendations: string[];
}
interface TrainingResult {
  metrics: { accuracy: number };
}
interface ResetResult {
  deleted: { telemetryRecords: number; predictions: number; anomalies: number };
}
interface Equipment {
  type?: string;
}

export const trainingKeys = {
  models: (orgId: string) => ["/api/analytics/ml-models", orgId] as const,
  equipment: ["/api/equipment"] as const,
};

export function useTrainingData() {
  const { toast } = useToast();
  const { currentOrgId } = useOrganization();
  const orgId = currentOrgId || "";
  const [selectedEquipmentType, setSelectedEquipmentType] = useState("");
  const [acousticData, setAcousticData] = useState("");
  const [sampleRate, setSampleRate] = useState("44100");
  const [rpm, setRpm] = useState("");
  const [acousticResults, setAcousticResults] = useState<AcousticAnalysisResult | null>(null);

  const {
    data: mlModels = [],
    isLoading: isLoadingModels,
    refetch: refetchModels,
  } = useQuery({
    queryKey: trainingKeys.models(orgId),
    queryFn: async () => {
      try {
        const res = await fetch(`/api/analytics/ml-models?orgId=${orgId}`);
        if (!res.ok) {
          return [];
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({ queryKey: trainingKeys.equipment });
  const uniqueEquipmentTypes = getUniqueEquipmentTypes(equipment);

  const trainLSTM = useCustomMutation<any, any>({
    mutationFn: async (params: {
      equipmentType?: string;
      epochs?: number;
      sequenceLength?: number;
    }) => {
      return apiRequest("POST", "/api/ml/train/lstm", {
        orgId,
        equipmentType: params.equipmentType || undefined,
        lstmConfig: createDefaultLstmConfig(params.epochs, params.sequenceLength),
      });
    },
    invalidateKeys: [["/api/analytics/ml-models"]],
    successMessage: (data: TrainingResult) =>
      `Model trained successfully with ${(data.metrics.accuracy * 100).toFixed(1)}% accuracy`,
    errorMessage: ((error: any) => error?.message || "Training failed") as any,
    onSuccess: () => {
      refetchModels();
    },
  });

  const trainRandomForest = useCustomMutation<any, any>({
    mutationFn: async (params: { equipmentType?: string; numTrees?: number }) => {
      return apiRequest("POST", "/api/ml/train/random-forest", {
        orgId,
        equipmentType: params.equipmentType || undefined,
        rfConfig: createDefaultRandomForestConfig(params.numTrees),
      });
    },
    invalidateKeys: [["/api/analytics/ml-models"]],
    successMessage: (data: TrainingResult) =>
      `Model trained successfully with ${(data.metrics.accuracy * 100).toFixed(1)}% accuracy`,
    errorMessage: ((error: any) => error?.message || "Training failed") as any,
    onSuccess: () => {
      refetchModels();
    },
  });

  const analyzeAcoustic = useCustomMutation<void, AcousticAnalysisResult>({
    mutationFn: async () => {
      const data = parseAcousticData(acousticData);
      const validation = validateAcousticData(data);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      return apiRequest("POST", "/api/acoustic/analyze", {
        acousticData: data,
        sampleRate: Number.parseInt(sampleRate),
        rpm: rpm ? Number.parseFloat(rpm) : undefined,
      });
    },
    successMessage: (data: AcousticAnalysisResult) =>
      `Health score: ${data.healthScore?.toFixed(0)}% - ${data.severity} severity`,
    errorMessage: ((error: any) => error?.message || "Analysis failed") as any,
    onSuccess: (data) => {
      setAcousticResults(data);
    },
  });

  const resetMLData = useCustomMutation<any, any>({
    mutationFn: async (params: { deleteModels?: boolean }) => {
      return apiRequest("POST", "/api/admin/ml/reset-training-data", {
        confirmationCode: "RESET_ML_DATA_CONFIRMED",
        deleteModels: params.deleteModels || false,
      });
    },
    invalidateKeys: [["/api/analytics/ml-models"], ["/api/equipment"]],
    successMessage: (data: ResetResult) =>
      `Reset complete: ${data.deleted.telemetryRecords} telemetry records, ${data.deleted.predictions} predictions, ${data.deleted.anomalies} anomalies deleted`,
    errorMessage: ((error: any) => error?.message || "Reset failed") as any,
    onSuccess: () => {
      refetchModels();
    },
  });

  const handleTrainLSTM = () => {
    const epochs = Number.parseInt(
      (document.getElementById("lstm-epochs") as HTMLInputElement)?.value || "50"
    );
    const sequenceLength = Number.parseInt(
      (document.getElementById("lstm-sequence") as HTMLInputElement)?.value || "10"
    );
    trainLSTM.mutate({ equipmentType: selectedEquipmentType || undefined, epochs, sequenceLength });
  };

  const handleTrainRandomForest = () => {
    const numTrees = Number.parseInt(
      (document.getElementById("rf-trees") as HTMLInputElement)?.value || "50"
    );
    trainRandomForest.mutate({ equipmentType: selectedEquipmentType || undefined, numTrees });
  };

  const exportData = (
    type:
      | "complete-json"
      | "complete-csv"
      | "models-json"
      | "models-csv"
      | "predictions-json"
      | "predictions-csv"
      | "telemetry-json"
      | "telemetry-csv"
  ) => {
    const exports: Record<string, { url: string; title: string; desc: string }> = {
      "complete-json": {
        url: `/api/analytics/export/ml-pdm-complete?orgId=${orgId}&format=json`,
        title: "Downloading complete export",
        desc: "All ML/PDM data in JSON format",
      },
      "complete-csv": {
        url: `/api/analytics/export/ml-pdm-complete?orgId=${orgId}&format=csv`,
        title: "Downloading models CSV",
        desc: "ML models with tier metadata",
      },
      "models-json": {
        url: `/api/analytics/export/ml-models?orgId=${orgId}&format=json`,
        title: "Downloading ML models",
        desc: "JSON format with tier metadata",
      },
      "models-csv": {
        url: `/api/analytics/export/ml-models?orgId=${orgId}&format=csv`,
        title: "Downloading ML models",
        desc: "CSV format",
      },
      "predictions-json": {
        url: `/api/analytics/export/predictions?orgId=${orgId}&format=json`,
        title: "Downloading predictions",
        desc: "Failure predictions and history",
      },
      "predictions-csv": {
        url: `/api/analytics/export/predictions?orgId=${orgId}&format=csv`,
        title: "Downloading predictions",
        desc: "CSV format",
      },
      "telemetry-json": {
        url: `/api/analytics/export/telemetry?orgId=${orgId}&format=json&limit=10000`,
        title: "Downloading telemetry",
        desc: "Historical sensor data",
      },
      "telemetry-csv": {
        url: `/api/analytics/export/telemetry?orgId=${orgId}&format=csv&limit=10000`,
        title: "Downloading telemetry",
        desc: "CSV format",
      },
    };
    const exp = exports[type];
    globalThis.open(exp.url, "_blank");
    toast({ title: exp.title, description: exp.desc });
  };

  const getTierBadge = (tier: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      platinum: { label: "💎 Platinum", className: "bg-purple-500 text-white hover:bg-purple-600" },
      gold: { label: "🥇 Gold", className: "bg-yellow-500 text-white hover:bg-yellow-600" },
      silver: { label: "🥈 Silver", className: "bg-gray-400 text-white hover:bg-gray-500" },
      bronze: { label: "🥉 Bronze", className: "bg-orange-600 text-white hover:bg-orange-700" },
    };
    return badges[tier] || { label: "Unknown", className: "bg-muted text-muted-foreground" };
  };

  return {
    orgId,
    mlModels: mlModels as MlModelDisplay[],
    isLoadingModels,
    equipment,
    uniqueEquipmentTypes,
    selectedEquipmentType,
    setSelectedEquipmentType,
    acousticData,
    setAcousticData,
    sampleRate,
    setSampleRate,
    rpm,
    setRpm,
    acousticResults,
    trainLSTM,
    trainRandomForest,
    analyzeAcoustic,
    resetMLData,
    handleTrainLSTM,
    handleTrainRandomForest,
    exportData,
    getTierBadge,
  };
}
