import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { TechnicianInsight } from "@/components/TechnicianInsightCard";

interface VesselInsights {
  vesselId: string;
  vesselName: string;
  insights: TechnicianInsight[];
}

interface FleetOverviewResponse {
  orgId: string;
  vesselId: string | null;
  vessels: VesselInsights[];
  generatedAt: string;
}

interface FleetStats {
  total: number;
  critical: number;
  actionRequired: number;
  monitor: number;
  normal: number;
}

export interface UseFleetOverviewDataReturn {
  data: FleetOverviewResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  stats: FleetStats;
  statusFilter: string | null;
  setStatusFilter: (filter: string | null) => void;
  filteredVessels: VesselInsights[] | undefined;
  handleViewDetails: (equipmentId: string) => void;
}

export function useFleetOverviewData(): UseFleetOverviewDataReturn {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<FleetOverviewResponse>({
    queryKey: ["/api/insights/v2/fleet-overview"],
  });

  const stats = useMemo<FleetStats>(() => {
    if (!data?.vessels) {
      return { total: 0, critical: 0, actionRequired: 0, monitor: 0, normal: 0 };
    }
    return data.vessels.reduce(
      (acc, vessel) => {
        vessel.insights.forEach((insight) => {
          acc.total++;
          if (insight.statusLevel === "critical") {acc.critical++;}
          else if (insight.statusLevel === "action_required") {acc.actionRequired++;}
          else if (insight.statusLevel === "monitor") {acc.monitor++;}
          else {acc.normal++;}
        });
        return acc;
      },
      { total: 0, critical: 0, actionRequired: 0, monitor: 0, normal: 0 }
    );
  }, [data?.vessels]);

  const filteredVessels = useMemo(() => {
    return data?.vessels
      .map((vessel) => ({
        ...vessel,
        insights: vessel.insights.filter((insight) => !statusFilter || insight.statusLevel === statusFilter),
      }))
      .filter((vessel) => vessel.insights.length > 0);
  }, [data?.vessels, statusFilter]);

  const handleViewDetails = useCallback((equipmentId: string) => {
    navigate(`/health?equipmentId=${equipmentId}`);
  }, [navigate]);

  return {
    data,
    isLoading,
    error,
    stats,
    statusFilter,
    setStatusFilter,
    filteredVessels,
    handleViewDetails,
  };
}

export type { VesselInsights, FleetOverviewResponse, FleetStats };
