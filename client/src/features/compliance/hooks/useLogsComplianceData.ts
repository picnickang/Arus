import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { ComplianceFinding } from "@shared/schema";

interface ComplianceSummary {
  open: number;
  acknowledged: number;
  resolved: number;
  suppressed: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

export function useLogsComplianceData() {
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<
    { id: string; name: string }[]
  >({ queryKey: ["/api/vessels"] });
  const { data: openFindings = [], isLoading: findingsLoading } = useQuery<ComplianceFinding[]>({
    queryKey: ["/api/compliance/findings", { status: "open" }],
  });
  const { data: summary } = useQuery<ComplianceSummary>({
    queryKey: [`/api/compliance/summary/${selectedVessel}`],
    enabled: selectedVessel !== "all",
  });

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const filteredFindings = useMemo(
    () =>
      selectedVessel === "all"
        ? openFindings
        : openFindings.filter((f) => f.vesselId === selectedVessel),
    [openFindings, selectedVessel]
  );

  const severityCounts = useMemo(
    () => ({
      critical: filteredFindings.filter((f) => f.severity === "critical").length,
      warning: filteredFindings.filter((f) => f.severity === "warning").length,
      info: filteredFindings.filter((f) => f.severity === "info").length,
    }),
    [filteredFindings]
  );

  const recentFindings = useMemo(
    () =>
      [...filteredFindings]
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5),
    [filteredFindings]
  );

  const getVesselName = useCallback(
    (vesselId: string) => vessels.find((v) => v.id === vesselId)?.name || vesselId,
    [vessels]
  );

  return {
    vessels,
    vesselsLoading,
    openFindings,
    findingsLoading,
    summary,
    selectedVessel,
    setSelectedVessel,
    activeTab,
    setActiveTab,
    todayStr,
    filteredFindings,
    severityCounts,
    recentFindings,
    getVesselName,
  };
}

export type { ComplianceSummary };
