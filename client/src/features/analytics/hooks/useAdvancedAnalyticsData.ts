import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useCustomMutation,
} from "@/hooks/useCrudMutations";
import type {
  MlModel,
  DigitalTwin,
  InsightSnapshot,
  AnomalyDetectionRecord,
  FailurePredictionRecord,
  ThresholdOptimizationRecord,
} from "@/features/analytics";
import {
  mlModelSchema,
  createEquipmentLookup,
  createVesselLookup,
  lookupName,
  createDefaultMlModelForm,
} from "@/features/analytics";

export interface UseAdvancedAnalyticsDataReturn {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  editingItem: MlModel | null;
  setEditingItem: (item: MlModel | null) => void;
  selectedAnomaly: AnomalyDetectionRecord | null;
  setSelectedAnomaly: (anomaly: AnomalyDetectionRecord | null) => void;
  selectedDigitalTwin: DigitalTwin | null;
  setSelectedDigitalTwin: (twin: DigitalTwin | null) => void;
  selectedInsight: InsightSnapshot | null;
  setSelectedInsight: (insight: InsightSnapshot | null) => void;
  orgId: string;
  equipment: EquipmentData[];
  vessels: VesselData[];
  getEquipmentName: (id: string) => string;
  getVesselName: (id: string) => string;
  mlModels: MlModel[];
  isLoadingModels: boolean;
  anomalyDetections: AnomalyDetectionRecord[];
  isLoadingAnomalies: boolean;
  failurePredictions: FailurePredictionRecord[];
  isLoadingPredictions: boolean;
  thresholdOptimizations: ThresholdOptimizationRecord[];
  isLoadingOptimizations: boolean;
  digitalTwins: DigitalTwin[];
  isLoadingTwins: boolean;
  insightSnapshots: InsightSnapshot[];
  isLoadingInsights: boolean;
  createMlModelMutation: ReturnType<typeof useCreateMutation>;
  updateMlModelMutation: ReturnType<typeof useUpdateMutation>;
  deleteMlModelMutation: ReturnType<typeof useDeleteMutation>;
  acknowledgeAnomalyMutation: ReturnType<typeof useCustomMutation>;
  applyOptimizationMutation: ReturnType<typeof useCustomMutation>;
  mlModelForm: ReturnType<typeof useForm>;
  onSubmitMlModel: (data: MlModelFormData) => void;
  handleEdit: (item: MlModel) => void;
  handleDelete: (id: string) => void;
  handleAcknowledgeAnomaly: (id: number) => void;
  handleApplyOptimization: (id: number) => void;
  resetModelForm: () => void;
}

interface EquipmentData {
  id: string;
  name?: string;
}
interface VesselData {
  id: string;
  name?: string;
}
interface MlModelFormData {
  name: string;
  modelType: string;
  targetEquipment?: string;
  parameters?: Record<string, unknown>;
}

async function fetchAnalyticsData(endpoint: string, orgId: string) {
  try {
    const res = await fetch(`/api/analytics/${endpoint}?orgId=${orgId}`);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function useAdvancedAnalyticsData(): UseAdvancedAnalyticsDataReturn {
  const { toast: _toast } = useToast();
  const _queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState("ml-models");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MlModel | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyDetectionRecord | null>(null);
  const [selectedDigitalTwin, setSelectedDigitalTwin] = useState<DigitalTwin | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<InsightSnapshot | null>(null);

  const orgId = "default-org-id";

  const { data: equipment = [] } = useQuery<EquipmentData[]>({ queryKey: ["/api/equipment"] });
  const { data: vessels = [] } = useQuery<VesselData[]>({ queryKey: ["/api/vessels"] });

  const equipmentMap = createEquipmentLookup(equipment);
  const vesselMap = createVesselLookup(vessels as Array<{ id: string; name: string }>);
  const getEquipmentName = (id: string) => lookupName(equipmentMap, id);
  const getVesselName = (id: string) => lookupName(vesselMap, id);

  const { data: mlModels = [], isLoading: isLoadingModels } = useQuery({
    queryKey: ["/api/analytics/ml-models", orgId],
    queryFn: () => fetchAnalyticsData("ml-models", orgId),
  });

  const { data: anomalyDetections = [], isLoading: isLoadingAnomalies } = useQuery({
    queryKey: ["/api/analytics/anomaly-detections", orgId],
    queryFn: () => fetchAnalyticsData("anomaly-detections", orgId),
  });

  const { data: failurePredictions = [], isLoading: isLoadingPredictions } = useQuery({
    queryKey: ["/api/analytics/failure-predictions", orgId],
    queryFn: () => fetchAnalyticsData("failure-predictions", orgId),
  });

  const { data: thresholdOptimizations = [], isLoading: isLoadingOptimizations } = useQuery({
    queryKey: ["/api/analytics/threshold-optimizations", orgId],
    queryFn: () => fetchAnalyticsData("threshold-optimizations", orgId),
  });

  const { data: digitalTwins = [], isLoading: isLoadingTwins } = useQuery({
    queryKey: ["/api/analytics/digital-twins", orgId],
    queryFn: () => fetchAnalyticsData("digital-twins", orgId),
  });

  const { data: insightSnapshots = [], isLoading: isLoadingInsights } = useQuery({
    queryKey: ["/api/analytics/insight-snapshots", orgId],
    queryFn: () => fetchAnalyticsData("insight-snapshots", orgId),
  });

  const createMlModelMutation = (useCreateMutation as object as (cfg: object) => ReturnType<typeof useCreateMutation>)({
    endpoint: "/api/analytics/ml-models",
    invalidateKeys: [["/api/analytics/ml-models", orgId]],
    successMessage: "ML model created successfully",
    errorMessage: "Failed to create ML model",
    onSuccess: () => {
      setIsDialogOpen(false);
    },
    transformData: (data: MlModelFormData) => ({ ...data, orgId }),
  });

  const updateMlModelMutation = (useUpdateMutation as object as (cfg: object) => ReturnType<typeof useUpdateMutation>)({
    endpoint: "/api/analytics/ml-models",
    invalidateKeys: [["/api/analytics/ml-models", orgId]],
    successMessage: "ML model updated successfully",
    errorMessage: "Failed to update ML model",
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
    },
    transformData: (data: MlModelFormData) => ({ ...data, orgId }),
  });

  const deleteMlModelMutation = (useDeleteMutation as object as (cfg: object) => ReturnType<typeof useDeleteMutation>)({
    endpoint: "/api/analytics/ml-models",
    invalidateKeys: [["/api/analytics/ml-models", orgId]],
    successMessage: "ML model deleted successfully",
    errorMessage: "Failed to delete ML model",
    urlSuffix: `?orgId=${orgId}`,
  });

  const acknowledgeAnomalyMutation = useCustomMutation({
    mutationFn: ({ id, acknowledgedBy }: { id: number; acknowledgedBy: string }) =>
      apiRequest("PATCH", `/api/analytics/anomaly-detections/${id}/acknowledge`, {
        acknowledgedBy,
        orgId,
      }),
    invalidateKeys: [["/api/analytics/anomaly-detections", orgId]],
    successMessage: "Anomaly acknowledged successfully",
    errorMessage: "Failed to acknowledge anomaly",
  });

  const applyOptimizationMutation = useCustomMutation({
    mutationFn: (id: number) =>
      apiRequest("PATCH", `/api/analytics/threshold-optimizations/${id}/apply`, { orgId }),
    invalidateKeys: [["/api/analytics/threshold-optimizations", orgId]],
    successMessage: "Threshold optimization applied successfully",
    errorMessage: "Failed to apply threshold optimization",
  });

  const mlModelForm = useForm({
    resolver: zodResolver(mlModelSchema),
    defaultValues: editingItem || createDefaultMlModelForm(),
  });

  if (editingItem && editingItem !== mlModelForm.getValues()) {
    mlModelForm.reset(editingItem);
  }

  const onSubmitMlModel = (data: MlModelFormData) => {
    if (editingItem) {
      (updateMlModelMutation.mutate as (v: unknown) => void)({ ...data, id: editingItem.id });
    } else {
      createMlModelMutation.mutate(data);
    }
  };

  const handleEdit = (item: MlModel) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this ML model?")) {
      deleteMlModelMutation.mutate(id);
    }
  };
  const handleAcknowledgeAnomaly = (id: number) => {
    const acknowledgedBy = prompt("Enter your name to acknowledge this anomaly:");
    if (acknowledgedBy) {
      acknowledgeAnomalyMutation.mutate({ id, acknowledgedBy });
    }
  };
  const handleApplyOptimization = (id: number) => {
    if (confirm("Are you sure you want to apply this threshold optimization?")) {
      applyOptimizationMutation.mutate(id);
    }
  };
  const resetModelForm = () => mlModelForm.reset(createDefaultMlModelForm());

  return {
    selectedTab,
    setSelectedTab,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    setEditingItem,
    selectedAnomaly,
    setSelectedAnomaly,
    selectedDigitalTwin,
    setSelectedDigitalTwin,
    selectedInsight,
    setSelectedInsight,
    orgId,
    equipment,
    vessels,
    getEquipmentName,
    getVesselName,
    mlModels,
    isLoadingModels,
    anomalyDetections,
    isLoadingAnomalies,
    failurePredictions,
    isLoadingPredictions,
    thresholdOptimizations,
    isLoadingOptimizations,
    digitalTwins,
    isLoadingTwins,
    insightSnapshots,
    isLoadingInsights,
    createMlModelMutation,
    updateMlModelMutation,
    deleteMlModelMutation,
    acknowledgeAnomalyMutation: acknowledgeAnomalyMutation as object as UseAdvancedAnalyticsDataReturn["acknowledgeAnomalyMutation"],
    applyOptimizationMutation: applyOptimizationMutation as object as UseAdvancedAnalyticsDataReturn["applyOptimizationMutation"],
    mlModelForm: mlModelForm as object as UseAdvancedAnalyticsDataReturn["mlModelForm"],
    onSubmitMlModel,
    handleEdit,
    handleDelete,
    handleAcknowledgeAnomaly,
    handleApplyOptimization,
    resetModelForm,
  };
}
