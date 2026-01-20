import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const ORG_ID = "default-org-id";

export interface EnrichedWorkOrderPart {
  id: string;
  workOrderId: string;
  partId: string;
  partNo: string;
  partName: string;
  quantityUsed: number;
  quantityOnHand: number;
  unitCost: number;
  totalCost: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  deliveryStatus: string | null;
  supplierName: string | null;
  supplierLeadTimeDays: number | null;
  notes: string | null;
  usedBy: string | null;
  usedAt: string | null;
}

export interface OutOfStockSuggestion {
  partId: string;
  partNo: string;
  partName: string;
  quantityNeeded: number;
  quantityOnHand: number;
  shortfall: number;
  suggestedOrderQuantity: number;
  supplierLeadTimeDays: number | null;
}

export function useEnrichedWorkOrderParts(workOrderId: string | undefined) {
  return useQuery<EnrichedWorkOrderPart[]>({
    queryKey: ["/api/work-orders", workOrderId, "parts", "enriched"],
    queryFn: () =>
      fetch(`/api/work-orders/${workOrderId}/parts/enriched`, {
        headers: { "x-org-id": ORG_ID },
      }).then((res) => res.json()),
    enabled: !!workOrderId,
  });
}

export function useOutOfStockSuggestions(workOrderId: string | undefined) {
  return useQuery<OutOfStockSuggestion[]>({
    queryKey: ["/api/work-orders", workOrderId, "parts", "out-of-stock-suggestions"],
    queryFn: () =>
      fetch(`/api/work-orders/${workOrderId}/parts/out-of-stock-suggestions`, {
        headers: { "x-org-id": ORG_ID },
      }).then((res) => res.json()),
    enabled: !!workOrderId,
  });
}
