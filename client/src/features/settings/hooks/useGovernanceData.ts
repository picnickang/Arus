import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LineageRecord, ProvenanceEvent, VerificationResult } from "../lib/governanceUtils";

export interface LineageFilters {
  family: string;
  stage: string;
  profile: string;
  fromDate: string;
  toDate: string;
}
export interface ProvenanceFilters {
  type: string;
  modelId: string;
  fromDate: string;
  toDate: string;
  limit: number;
}

export function useGovernanceData() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("lineage");
  const [selectedModel, setSelectedModel] = useState<LineageRecord | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [comparisonModel, setComparisonModel] = useState<LineageRecord | null>(null);
  const [lineageFilters, setLineageFilters] = useState<LineageFilters>({
    family: "",
    stage: "",
    profile: "",
    fromDate: "",
    toDate: "",
  });
  const [provenanceFilters, setProvenanceFilters] = useState<ProvenanceFilters>({
    type: "",
    modelId: "",
    fromDate: "",
    toDate: "",
    limit: 100,
  });

  const {
    data: lineageData,
    isLoading: isLoadingLineage,
    refetch: refetchLineage,
  } = useQuery<{ success: boolean; count: number; records: LineageRecord[] }>({
    queryKey: ["/api/governance/model/lineage", lineageFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (lineageFilters.family) {
        params.set("family", lineageFilters.family);
      }
      if (lineageFilters.stage) {
        params.set("stage", lineageFilters.stage);
      }
      if (lineageFilters.profile) {
        params.set("profile", lineageFilters.profile);
      }
      if (lineageFilters.fromDate) {
        params.set("from", lineageFilters.fromDate);
      }
      if (lineageFilters.toDate) {
        params.set("to", lineageFilters.toDate);
      }
      // Opt-in safety cap (server max 1000). Below 1000 records the response
      // is identical to the uncapped fetch; above it, `count` carries the
      // server-side total while `records` holds the newest 1000.
      params.set("limit", "1000");
      return apiRequest<{ success: boolean; count: number; records: LineageRecord[] }>(
        "GET",
        `/api/governance/model/lineage?${params.toString()}`
      );
    },
  });

  const {
    data: provenanceData,
    isLoading: isLoadingProvenance,
    refetch: refetchProvenance,
  } = useQuery<{ success: boolean; events: ProvenanceEvent[]; total: number }>({
    queryKey: ["/api/governance/provenance/events", provenanceFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (provenanceFilters.type) {
        params.set("type", provenanceFilters.type);
      }
      if (provenanceFilters.modelId) {
        params.set("modelId", provenanceFilters.modelId);
      }
      if (provenanceFilters.fromDate) {
        params.set("from", provenanceFilters.fromDate);
      }
      if (provenanceFilters.toDate) {
        params.set("to", provenanceFilters.toDate);
      }
      params.set("limit", String(provenanceFilters.limit));
      return apiRequest<{ success: boolean; events: ProvenanceEvent[]; total: number }>(
        "GET",
        `/api/governance/provenance/events?${params.toString()}`
      );
    },
    enabled: activeTab === "provenance",
  });

  const verifyChainMutation = useMutation({
    mutationFn: async () =>
      apiRequest<{ success: boolean; verification: VerificationResult }>(
        "POST",
        "/api/governance/provenance/verify",
        {}
      ),
    onSuccess: (data: { success: boolean; verification: VerificationResult }) => {
      if (data.verification.ok) {
        toast({
          title: "Chain Verified",
          description: `All ${data.verification.totalEvents} events verified successfully.`,
        });
      } else {
        toast({
          title: "Chain Verification Failed",
          description: `Broken at event ${data.verification.brokenAt}. ${data.verification.errors?.length || 0} errors found.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Verification Error", description: error.message, variant: "destructive" });
    },
  });

  const lineageRecords = useMemo(() => lineageData?.records ?? [], [lineageData]);
  const provenanceEvents = useMemo(() => provenanceData?.events ?? [], [provenanceData]);

  const stats = useMemo(() => {
    const records = lineageRecords;
    // totalModels uses the server-side total (count is pre-slice when the
    // limit kicks in); the remaining stats are computed over the fetched
    // page, which is exact below the 1000-record cap.
    return {
      totalModels: lineageData?.count ?? records.length,
      productionModels: records.filter((r) => r.promotion.stage === "production").length,
      totalPredictions: records.reduce((acc, r) => acc + r.predictionCount, 0),
      familyCounts: {
        lstm: records.filter((r) => r.family === "lstm").length,
        xgboost: records.filter((r) => r.family === "xgboost").length,
        rf: records.filter((r) => r.family === "rf").length,
      },
    };
  }, [lineageRecords, lineageData?.count]);

  const handleViewModelDetails = (model: LineageRecord) => {
    setSelectedModel(model);
    setDetailDrawerOpen(true);
  };
  const handleRefresh = () => {
    refetchLineage();
    refetchProvenance();
  };
  const handleToggleComparison = (record: LineageRecord) => {
    if (comparisonModel?.modelId === record.modelId) {
      setComparisonModel(null);
    } else {
      setComparisonModel(record);
      toast({
        title: "Model Selected for Comparison",
        description: "Select another model to view details and compare",
      });
    }
  };
  const handleClearComparison = () => setComparisonModel(null);
  const updateLineageFilter = (key: keyof LineageFilters, value: string) =>
    setLineageFilters((f) => ({ ...f, [key]: value === "all" ? "" : value }));
  const updateProvenanceFilter = (key: keyof ProvenanceFilters, value: string | number) =>
    setProvenanceFilters((f) => ({ ...f, [key]: value === "all" ? "" : value }));

  return {
    activeTab,
    setActiveTab,
    selectedModel,
    detailDrawerOpen,
    setDetailDrawerOpen,
    comparisonModel,
    lineageFilters,
    provenanceFilters,
    updateLineageFilter,
    updateProvenanceFilter,
    lineageRecords,
    provenanceEvents,
    isLoadingLineage,
    isLoadingProvenance,
    stats,
    verifyChainMutation,
    handleViewModelDetails,
    handleRefresh,
    handleToggleComparison,
    handleClearComparison,
  };
}
