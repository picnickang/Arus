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
    queryKey: ["/api/suppliers", "performance-summary"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers/performance-summary");
      if (!res.ok) throw new Error("Failed to fetch performance data");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
