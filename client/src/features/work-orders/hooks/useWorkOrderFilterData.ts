import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  WORK_ORDER_FILTER_STATUS_OPTIONS,
  WORK_ORDER_FILTER_PRIORITY_OPTIONS,
  EQUIPMENT_CATEGORIES,
} from "../constants";

// Re-exported with shorter names for consumer convenience.
// Local aliases follow so this module can use them too — `export { X as Y }`
// only adjusts the public name, it does not create a local binding.
const STATUS_OPTIONS = WORK_ORDER_FILTER_STATUS_OPTIONS;
const PRIORITY_OPTIONS = WORK_ORDER_FILTER_PRIORITY_OPTIONS;

export interface WorkOrderFilters {
  search: string;
  status: string;
  priority: string;
  vesselId: string;
  engineerId: string;
  equipmentCategory: string;
  dueDateFrom: string;
  dueDateTo: string;
}

export {
  WORK_ORDER_FILTER_STATUS_OPTIONS as STATUS_OPTIONS,
  WORK_ORDER_FILTER_PRIORITY_OPTIONS as PRIORITY_OPTIONS,
  EQUIPMENT_CATEGORIES,
};

const DEFAULT_FILTERS: WorkOrderFilters = {
  search: "",
  status: "all",
  priority: "all",
  vesselId: "all",
  engineerId: "all",
  equipmentCategory: "all",
  dueDateFrom: "",
  dueDateTo: "",
};

interface VesselOption {
  id: string;
  name: string;
}
interface CrewMember {
  id: string;
  name: string;
  rank?: string;
  active?: boolean;
  hourlyRate?: number;
}

export interface UseWorkOrderFilterDataReturn {
  localFilters: WorkOrderFilters;
  vessels: VesselOption[];
  engineers: CrewMember[];
  activeFilterCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  updateFilter: (key: keyof WorkOrderFilters, value: string) => void;
  clearAllFilters: () => void;
  removeFilter: (key: keyof WorkOrderFilters) => void;
  getStatusLabel: (value: string) => string | undefined;
  getPriorityLabel: (value: string) => string | undefined;
  getVesselName: (id: string) => string | undefined;
  getEngineerName: (id: string) => string | undefined;
}

export function useWorkOrderFilterData(
  filters: WorkOrderFilters,
  onFiltersChange: (filters: WorkOrderFilters) => void
): UseWorkOrderFilterDataReturn {
  const [isOpen, setIsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const { data: vessels = [] } = useQuery<VesselOption[]>({
    queryKey: ["/api/vessels"],
    staleTime: 300000,
  });
  const { data: crew = [] } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew"],
    staleTime: 300000,
  });

  const engineers = useMemo(() => {
    return (crew ?? []).filter(
      (c) =>
        c.active !== false &&
        (c.rank?.toLowerCase().includes("engineer") ||
          c.rank?.toLowerCase().includes("technician") ||
          c.rank?.toLowerCase().includes("mechanic") ||
          c.name)
    );
  }, [crew]);

  useEffect(() => {
    const areFiltersEqual =
      localFilters.search === filters.search &&
      localFilters.status === filters.status &&
      localFilters.priority === filters.priority &&
      localFilters.vesselId === filters.vesselId &&
      localFilters.engineerId === filters.engineerId &&
      localFilters.equipmentCategory === filters.equipmentCategory &&
      localFilters.dueDateFrom === filters.dueDateFrom &&
      localFilters.dueDateTo === filters.dueDateTo;
    if (!areFiltersEqual) {
      setLocalFilters(filters);
    }
  }, [filters]);

  const updateFilter = useCallback((key: keyof WorkOrderFilters, value: string) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateUrlParams = useCallback((newFilters: WorkOrderFilters) => {
    if (typeof globalThis === "undefined") {
      return;
    }
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        params.set(key, value);
      }
    });
    params.set("tab", "work-orders");
    const queryString = params.toString();
    const newPath = `/maint?${queryString}`;
    globalThis.history.replaceState({}, "", newPath);
  }, []);

  useEffect(() => {
    const areFiltersEqual =
      localFilters.search === filters.search &&
      localFilters.status === filters.status &&
      localFilters.priority === filters.priority &&
      localFilters.vesselId === filters.vesselId &&
      localFilters.engineerId === filters.engineerId &&
      localFilters.equipmentCategory === filters.equipmentCategory &&
      localFilters.dueDateFrom === filters.dueDateFrom &&
      localFilters.dueDateTo === filters.dueDateTo;
    if (areFiltersEqual) {
      return;
    }
    const timeoutId = setTimeout(() => {
      onFiltersChange(localFilters);
      updateUrlParams(localFilters);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [localFilters, filters, onFiltersChange, updateUrlParams]);

  useEffect(() => {
    if (typeof globalThis === "undefined") {
      return;
    }
    const params = new URLSearchParams(globalThis.location.search);
    const urlFilters: WorkOrderFilters = {
      search: params.get("search") || "",
      status: params.get("status") || "all",
      priority: params.get("priority") || "all",
      vesselId: params.get("vesselId") || "all",
      engineerId: params.get("engineerId") || "all",
      equipmentCategory: params.get("equipmentCategory") || "all",
      dueDateFrom: params.get("dueDateFrom") || "",
      dueDateTo: params.get("dueDateTo") || "",
    };
    setLocalFilters(urlFilters);
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.entries(localFilters).filter(
      ([key, value]) => value && value !== "all" && value !== "" && key !== "search"
    ).length;
  }, [localFilters]);

  const clearAllFilters = useCallback(() => setLocalFilters(DEFAULT_FILTERS), []);

  const removeFilter = useCallback((key: keyof WorkOrderFilters) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: key === "search" || key === "dueDateFrom" || key === "dueDateTo" ? "" : "all",
    }));
  }, []);

  const getStatusLabel = useCallback(
    (value: string) => STATUS_OPTIONS.find((s: { value: string; label: string }) => s.value === value)?.label,
    []
  );
  const getPriorityLabel = useCallback(
    (value: string) => PRIORITY_OPTIONS.find((p: { value: string; label: string }) => p.value === value)?.label,
    []
  );
  const getVesselName = useCallback(
    (id: string) => (vessels ?? []).find((v) => v.id === id)?.name,
    [vessels]
  );
  const getEngineerName = useCallback(
    (id: string) => engineers.find((e) => e.id === id)?.name,
    [engineers]
  );

  return {
    localFilters,
    vessels: vessels ?? [],
    engineers,
    activeFilterCount,
    isOpen,
    setIsOpen,
    mobileOpen,
    setMobileOpen,
    updateFilter,
    clearAllFilters,
    removeFilter,
    getStatusLabel,
    getPriorityLabel,
    getVesselName,
    getEngineerName,
  };
}
