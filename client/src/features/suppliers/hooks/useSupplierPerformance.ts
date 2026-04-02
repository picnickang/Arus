import { useQuery } from "@tanstack/react-query";

export interface SupplierPerformanceSummary {
  supplierId: string;
  name: string;
  performanceScore: number;
  onTimeRate: number;
  qualityRating: number;
  totalOrders: number;
  status: "preferred" | "active" | "inactive" | "blacklisted";
}

export function useSupplierPerformance() {
  return useQuery<SupplierPerformanceSummary[]>({
    queryKey: ["/api/suppliers/performance-summary"],
    staleTime: 5 * 60 * 1000,
  });
}
