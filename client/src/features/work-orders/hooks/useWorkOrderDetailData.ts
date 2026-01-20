import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkOrder } from "@shared/schema";

export interface WorkOrderPart {
  id: string;
  workOrderId: string;
  partId: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  partName?: string;
  partNumber?: string;
}

export interface WorkOrderCost {
  id: string;
  workOrderId: string;
  costType: string;
  description?: string;
  amount: number;
}

export interface UseWorkOrderDetailDataProps {
  workOrder: WorkOrder | null;
}

export interface UseWorkOrderDetailDataReturn {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  linkTemplateDialogOpen: boolean;
  setLinkTemplateDialogOpen: (open: boolean) => void;
  workOrderParts: WorkOrderPart[];
  workOrderCosts: WorkOrderCost[];
  isLoadingParts: boolean;
  isLoadingCosts: boolean;
  totalPartsCost: number;
  totalOtherCosts: number;
  grandTotal: number;
  invalidateParts: () => void;
  invalidateChecklist: () => void;
}

export function useWorkOrderDetailData({ workOrder }: UseWorkOrderDetailDataProps): UseWorkOrderDetailDataReturn {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [linkTemplateDialogOpen, setLinkTemplateDialogOpen] = useState(false);

  const { data: workOrderParts = [], isLoading: isLoadingParts } = useQuery<WorkOrderPart[]>({
    queryKey: ["/api/work-orders", workOrder?.id, "parts"],
    enabled: !!workOrder?.id,
  });

  const { data: workOrderCosts = [], isLoading: isLoadingCosts } = useQuery<WorkOrderCost[]>({
    queryKey: ["/api/work-orders", workOrder?.id, "costs"],
    enabled: !!workOrder?.id,
  });

  const totalPartsCost = useMemo(() => {
    return workOrderParts.reduce((sum, part) => sum + (part.totalCost || 0), 0);
  }, [workOrderParts]);

  const totalOtherCosts = useMemo(() => {
    return workOrderCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);
  }, [workOrderCosts]);

  const grandTotal = useMemo(() => {
    return totalPartsCost + totalOtherCosts + (workOrder?.laborCost || 0);
  }, [totalPartsCost, totalOtherCosts, workOrder?.laborCost]);

  const invalidateParts = useCallback(() => {
    if (workOrder?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrder.id, "parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    }
  }, [queryClient, workOrder?.id]);

  const invalidateChecklist = useCallback(() => {
    if (workOrder?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-checklist", workOrder.id] });
      setActiveTab("tasks");
    }
  }, [queryClient, workOrder?.id]);

  return {
    activeTab,
    setActiveTab,
    linkTemplateDialogOpen,
    setLinkTemplateDialogOpen,
    workOrderParts,
    workOrderCosts,
    isLoadingParts,
    isLoadingCosts,
    totalPartsCost,
    totalOtherCosts,
    grandTotal,
    invalidateParts,
    invalidateChecklist,
  };
}
