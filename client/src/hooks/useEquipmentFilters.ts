import { useState } from "react";

export interface EquipmentFilters {
  search: string;
  vessel: string;
  type: string;
  status: string;
  manufacturer: string;
}

export function useEquipmentFilters(initialFilters: Partial<EquipmentFilters> = {}) {
  const [filters, setFilters] = useState<EquipmentFilters>({
    search: initialFilters.search || "",
    vessel: initialFilters.vessel || "all",
    type: initialFilters.type || "all",
    status: initialFilters.status || "all",
    manufacturer: initialFilters.manufacturer || "all",
  });

  const updateFilter = <K extends keyof EquipmentFilters>(key: K, value: EquipmentFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      vessel: "all",
      type: "all",
      status: "all",
      manufacturer: "all",
    });
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.vessel !== "all" ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.manufacturer !== "all";

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
  };
}
