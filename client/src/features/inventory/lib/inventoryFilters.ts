import type { PartsInventoryItem } from "@/components/inventory/VirtualizedInventoryTable";
import type { InventoryFilters } from "@/components/inventory/InventoryFilterPanel";
import { getStockStatus } from "./stockUtils";

export const DEFAULT_INVENTORY_FILTERS: InventoryFilters = {
  search: "",
  categories: [],
  criticalities: [],
  stockStatus: "all",
  suppliers: [],
};

export function createDefaultFilters(): InventoryFilters {
  return { ...DEFAULT_INVENTORY_FILTERS };
}

export function parseFiltersFromUrl(searchParams: string): InventoryFilters {
  const params = new URLSearchParams(searchParams);
  return {
    search: params.get("search") || "",
    categories: params.get("categories")?.split(",").filter(Boolean) ?? [],
    criticalities: params.get("criticalities")?.split(",").filter(Boolean) ?? [],
    stockStatus: params.get("stockStatus") || "all",
    suppliers: params.get("suppliers")?.split(",").filter(Boolean) ?? [],
  };
}

export function serializeFiltersToUrl(filters: InventoryFilters): string {
  const params = new URLSearchParams();
  if (filters.search) {
    params.set("search", filters.search);
  }

  if (filters.categories.length) {
    params.set("categories", filters.categories.join(","));
  }

  if (filters.criticalities.length) {
    params.set("criticalities", filters.criticalities.join(","));
  }

  if (filters.stockStatus !== "all") {
    params.set("stockStatus", filters.stockStatus);
  }

  if (filters.suppliers.length) {
    params.set("suppliers", filters.suppliers.join(","));
  }
  return params.toString();
}

export function countActiveFilters(filters: InventoryFilters): number {
  let count = 0;
  if (filters.search) {
    count++;
  }
  count += filters.categories.length;
  count += filters.criticalities.length;
  count += filters.suppliers.length;
  if (filters.stockStatus !== "all") {
    count++;
  }
  return count;
}

export function filterParts(parts: PartsInventoryItem[], filters: InventoryFilters): PartsInventoryItem[] {
  let result = [...parts];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(
      (part) =>
        (part.partNumber || "").toLowerCase().includes(searchLower) ||
        (part.partName || "").toLowerCase().includes(searchLower) ||
        (part.category || "").toLowerCase().includes(searchLower) ||
        part.description?.toLowerCase().includes(searchLower)
    );
  }

  if (filters.categories.length > 0) {
    result = result.filter((part) => part.category && filters.categories.includes(part.category));
  }

  if (filters.criticalities.length > 0) {
    result = result.filter((part) => part.criticality && filters.criticalities.includes(part.criticality));
  }

  if (filters.suppliers.length > 0) {
    result = result.filter((part) => part.supplierName && filters.suppliers.includes(part.supplierName));
  }

  if (filters.stockStatus !== "all") {
    result = result.filter((part) => {
      const status = getStockStatus(part);
      switch (filters.stockStatus) {
        case "critical":
          return status === "critical" || status === "out_of_stock";
        case "low":
          return status === "low_stock";
        case "adequate":
          return status === "adequate";
        case "excess":
          return status === "excess_stock";
        case "zero":
          return status === "out_of_stock";
        default:
          return true;
      }
    });
  }

  return result;
}

export interface FilterOptions {
  categories: { value: string; label: string }[];
  suppliers: { value: string; label: string }[];
  criticalities: { value: string; label: string }[];
}

export function deriveFilterOptions(parts: PartsInventoryItem[]): FilterOptions {
  const categories = [...new Set(parts.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const suppliers = [...new Set(parts.map(p => p.supplierName).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
  const criticalities = ["critical", "high", "medium", "low"];

  return {
    categories: categories.map(c => ({ value: c, label: c })),
    suppliers: suppliers.map(s => ({ value: s, label: s })),
    criticalities: criticalities.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
  };
}
