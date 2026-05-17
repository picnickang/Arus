import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type {
  ReportType,
  AudienceType,
  LlmModelType,
  AIModel,
  Audience,
  GeneratedReport,
  VesselIntelligence,
} from "../types";

function useSearchParams() {
  const [searchParams, setSearchParams] = useState(
    () => new URLSearchParams(globalThis.location.search)
  );
  useEffect(() => {
    const checkForChanges = () => {
      const newParams = new URLSearchParams(globalThis.location.search);
      if (newParams.toString() !== searchParams.toString()) {
        setSearchParams(newParams);
      }
    };
    const intervalId = setInterval(checkForChanges, 100);
    globalThis.addEventListener("popstate", checkForChanges);
    return () => {
      clearInterval(intervalId);
      globalThis.removeEventListener("popstate", checkForChanges);
    };
  }, [searchParams]);
  return searchParams;
}

export function useAiInsightsData() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [reportType, setReportType] = useState<ReportType>("health");
  const [audience, setAudience] = useState<AudienceType>("executive");
  const [selectedModel, setSelectedModel] = useState<LlmModelType>("gpt-4o");
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [vesselIntelligence, setVesselIntelligence] = useState<VesselIntelligence | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);
  const [openSections, setOpenSections] = useState({
    analysis: false,
    scenarios: false,
    roi: false,
    citations: false,
  });

  useEffect(() => {
    const typeParam = searchParams.get("type") as ReportType | null;
    const validTypes: ReportType[] = ["health", "fleet", "maintenance", "compliance"];
    if (typeParam && validTypes.includes(typeParam)) {
      setReportType(typeParam);
    } else {
      setReportType("health");
    }
  }, [searchParams]);

  useEffect(() => {
    document.title = "AI Insights - ARUS";
    return () => {
      document.title = "ARUS - Marine Predictive Maintenance";
    };
  }, []);

  const { data: modelsData } = useQuery<{ models?: AIModel[]; audiences?: Audience[] }>({
    queryKey: ["/api/llm/models"],
  });
  const { data: vessels = [] } = useQuery({ queryKey: ["/api/vessels"] });
  const { data: equipment = [] } = useQuery({ queryKey: ["/api/equipment/health"] });
  const models: AIModel[] = modelsData?.models ?? [];
  const audiences: Audience[] = modelsData?.audiences ?? [];

  const generateReport = async () => {
    if (!selectedVessel && reportType !== "fleet") {
      toast({
        title: "Vessel Required",
        description: "Please select a vessel to generate a report",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    try {
      const endpointMap: Record<ReportType, string> = {
        health: "/api/llm/reports/vessel-health",
        fleet: "/api/llm/reports/fleet-summary",
        maintenance: "/api/llm/reports/maintenance",
        compliance: "/api/llm/reports/compliance",
      };
      const requestBody: {
        audience: AudienceType;
        includeScenarios: boolean;
        includeROI: boolean;
        modelPreference: LlmModelType;
        vesselId?: string;
      } = {
        audience,
        includeScenarios: true,
        includeROI: reportType === "health" || reportType === "fleet",
        modelPreference: selectedModel,
      };
      if (reportType !== "fleet") {
        requestBody.vesselId = selectedVessel;
      }
      const response = await apiRequest<{
        success: boolean;
        error?: string;
        report: { analysis?: string; [key: string]: unknown };
      }>("POST", endpointMap[reportType], requestBody);
      if (!response.success) {
        throw new Error(response.error || "Failed to generate report");
      }
      setGeneratedReport({
        reportType,
        audience,
        model: selectedModel,
        content: response.report,
        timestamp: new Date().toISOString(),
      });
      toast({
        title: "Report Generated",
        description: response.report.analysis
          ? `${response.report.analysis.substring(0, 100)}...`
          : "Report successfully generated",
      });
    } catch (error: unknown) {
      toast({
        title: "Report Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate AI report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const loadVesselIntelligence = async () => {
    if (!selectedVessel) {
      toast({
        title: "Vessel Required",
        description: "Please select a vessel to analyze",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingIntelligence(true);
    try {
      const response = await fetch(
        `/api/llm/vessel/${selectedVessel}/intelligence?lookbackDays=365`
      );
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load vessel intelligence");
      }
      setVesselIntelligence(data.intelligence);
      toast({
        title: "Intelligence Loaded",
        description: `Analyzed patterns for ${data.intelligence.vesselName}`,
      });
    } catch (error: unknown) {
      toast({
        title: "Intelligence Load Failed",
        description: error instanceof Error ? error.message : "Failed to load vessel intelligence",
        variant: "destructive",
      });
    } finally {
      setIsLoadingIntelligence(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };
  const getSeverityColorLocal = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-500";
      case "high":
        return "text-orange-500";
      case "medium":
        return "text-yellow-500";
      case "low":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return {
    reportType,
    setReportType,
    audience,
    setAudience,
    selectedModel,
    setSelectedModel,
    selectedVessel,
    setSelectedVessel,
    selectedEquipment,
    setSelectedEquipment,
    generatedReport,
    vesselIntelligence,
    isGenerating,
    isLoadingIntelligence,
    openSections,
    setOpenSections,
    toggleSection,
    vessels,
    equipment,
    models,
    audiences,
    generateReport,
    loadVesselIntelligence,
    getPriorityColor,
    getSeverityColor: getSeverityColorLocal,
  };
}
