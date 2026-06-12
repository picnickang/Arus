import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Part } from "../types";

const inventoryKeys = {
  parts: () => ["/api/parts"] as const,
};

export function useParts(searchTerm?: string) {
  return useQuery<Part[]>({
    queryKey: [...inventoryKeys.parts(), searchTerm ?? "all"],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/parts${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`
      ),
  });
}
