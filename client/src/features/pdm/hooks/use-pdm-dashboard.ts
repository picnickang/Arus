import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  PdmDashboardData,
  AssetDetail,
  CostSavingsSummary,
  EquipmentFinancials,
  TelemetryReading,
  TelemetryTrend,
  PdmScheduleData,
} from "../types";

export interface DashboardFilters {
  vesselId?: string;
  equipmentType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export function usePdmDashboard(filters?: DashboardFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.vesselId) {
    queryParams.set("vesselId", filters.vesselId);
  }
  if (filters?.equipmentType) {
    queryParams.set("equipmentType", filters.equipmentType);
  }
  if (filters?.dateFrom) {
    queryParams.set("dateFrom", filters.dateFrom);
  }
  if (filters?.dateTo) {
    queryParams.set("dateTo", filters.dateTo);
  }
  if (filters?.search) {
    queryParams.set("search", filters.search);
  }

  const queryString = queryParams.toString();
  const url = queryString ? `/api/pdm/dashboard?${queryString}` : "/api/pdm/dashboard";

  return useQuery<PdmDashboardData>({
    queryKey: [url],
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function useAssetDetail(equipmentId: string | null) {
  return useQuery<AssetDetail>({
    queryKey: ["/api/pdm/asset", equipmentId],
    enabled: !!equipmentId,
    staleTime: 30000,
  });
}

export function useAcknowledgeRisk() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("POST", `/api/pdm/risk/${itemId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/pdm/dashboard");
        },
      });
      toast({
        title: "Risk Acknowledged",
        description: "The risk item has been acknowledged.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge risk item.",
        variant: "destructive",
      });
    },
  });
}

export function useCreateWorkOrderFromRisk() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("POST", `/api/pdm/risk/${itemId}/create-work-order`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/pdm/dashboard");
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Work Order Created",
        description: "A work order has been created from this risk item.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work order.",
        variant: "destructive",
      });
    },
  });
}

export function useCostSavingsSummary(months: number = 12) {
  return useQuery<CostSavingsSummary>({
    queryKey: [`/api/cost-savings/summary?months=${months}`],
    staleTime: 60000,
  });
}

export function useEquipmentFinancials() {
  return useQuery<EquipmentFinancials>({
    queryKey: ["/api/cost-savings/equipment-financials"],
    staleTime: 60000,
  });
}

export function useEquipmentTelemetry(
  equipmentId: string | null,
  options?: { limit?: number; sensorType?: string; hours?: number }
) {
  const params = new URLSearchParams();
  if (options?.limit) {
    params.set("limit", options.limit.toString());
  }
  if (options?.sensorType) {
    params.set("sensorType", options.sensorType);
  }
  if (options?.hours) {
    params.set("hours", options.hours.toString());
  }

  const queryString = params.toString();
  const url = equipmentId
    ? `/api/pdm/equipment/${equipmentId}/telemetry${queryString ? `?${queryString}` : ""}`
    : "";

  return useQuery<TelemetryReading[]>({
    queryKey: [url],
    enabled: !!equipmentId && !!url,
    staleTime: 30000,
  });
}

export function useTelemetryTrends(equipmentId?: string, hours: number = 24) {
  const params = new URLSearchParams();
  if (equipmentId) {
    params.set("equipmentId", equipmentId);
  }
  params.set("hours", hours.toString());

  return useQuery<TelemetryTrend[]>({
    queryKey: [`/api/pdm/telemetry/trends?${params.toString()}`],
    staleTime: 30000,
  });
}

export interface PdmFilterOptions {
  vessels: Array<{ id: string; name: string }>;
  equipmentTypes: string[];
}

export function usePdmFilterOptions() {
  return useQuery<PdmFilterOptions>({
    queryKey: ["/api/pdm/filter-options"],
    staleTime: 300000,
  });
}

export interface ScheduleFilters {
  vesselIds?: string[];
  equipmentTypes?: string[];
  startDate?: string;
  endDate?: string;
  maxTasksPerVesselPerDay?: number;
  autoPopulate?: boolean;
}

export function usePdmSchedule(filters?: ScheduleFilters) {
  const params = new URLSearchParams();
  if (filters?.vesselIds?.length) {
    params.set("vesselIds", filters.vesselIds.join(","));
  }
  if (filters?.equipmentTypes?.length) {
    params.set("equipmentTypes", filters.equipmentTypes.join(","));
  }
  if (filters?.startDate) {
    params.set("startDate", filters.startDate);
  }
  if (filters?.endDate) {
    params.set("endDate", filters.endDate);
  }
  if (filters?.maxTasksPerVesselPerDay) {
    params.set("maxTasksPerVesselPerDay", filters.maxTasksPerVesselPerDay.toString());
  }
  if (filters?.autoPopulate !== undefined) {
    params.set("autoPopulate", filters.autoPopulate.toString());
  }

  const queryString = params.toString();
  const url = queryString ? `/api/pdm/schedule?${queryString}` : "/api/pdm/schedule";

  return useQuery<PdmScheduleData>({
    queryKey: ["/api/pdm/schedule", filters],
    queryFn: async () => {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error("Failed to fetch schedule");
      }
      return response.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
