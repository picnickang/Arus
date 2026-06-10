import type { WorkOrderFilters } from "@/components/work-orders";

export const DEFAULT_WORK_ORDER_FILTERS: WorkOrderFilters = {
  search: "",
  status: "all",
  priority: "all",
  vesselId: "all",
  engineerId: "all",
  equipmentCategory: "all",
  dueDateFrom: "",
  dueDateTo: "",
};

const FILTER_KEYS = Object.keys(DEFAULT_WORK_ORDER_FILTERS) as (keyof WorkOrderFilters)[];

export function parseFiltersFromSearch(search: string): WorkOrderFilters {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const filters: WorkOrderFilters = { ...DEFAULT_WORK_ORDER_FILTERS };
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value !== null && value !== "") {
      filters[key] = value;
    }
  }
  return filters;
}

export function serializeFiltersToParams(filters: WorkOrderFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value && value !== DEFAULT_WORK_ORDER_FILTERS[key]) {
      params.set(key, value);
    }
  }
  return params;
}

export function buildWorkOrdersUrl(filters: WorkOrderFilters): string {
  const qs = serializeFiltersToParams(filters).toString();
  return qs ? `/work-orders?${qs}` : "/work-orders";
}
