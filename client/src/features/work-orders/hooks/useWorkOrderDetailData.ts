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

export interface ProcurementCosts {
  serviceOrderCosts: number;
  totalProcurementCost: number;
  resolvedDowntimeCostPerHour: number;
  serviceOrderDetails: Array<{
    id: string;
    soNumber: string;
    status: string;
    actualAmount: number | null;
    quotedAmount: number | null;
    serviceProviderId: string;
  }>;
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
  procurementCosts: ProcurementCosts | null;
  isLoadingParts: boolean;
  isLoadingCosts: boolean;
  isLoadingProcurement: boolean;
  totalPartsCost: number;
  totalLaborCost: number;
  totalProcurementCost: number;
  downtimeCost: number;
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

  const { data: procurementCosts = null, isLoading: isLoadingProcurement } = useQuery<ProcurementCosts>({
    queryKey: ["/api/work-orders", workOrder?.id, "procurement-costs"],
    enabled: !!workOrder?.id,
  });

  const totalPartsCost = useMemo(() => {
    return workOrderParts.reduce((sum, part) => sum + (part.totalCost || 0), 0);
  }, [workOrderParts]);

  const totalLaborCost = useMemo(() => {
    return workOrder?.totalLaborCost ?? workOrder?.laborCost ?? 0;
  }, [workOrder?.totalLaborCost, workOrder?.laborCost]);

  const totalProcurementCost = useMemo(() => {
    return procurementCosts?.totalProcurementCost ?? 0;
  }, [procurementCosts]);

  const downtimeCost = useMemo(() => {
    const hours = workOrder?.actualDowntimeHours ?? 0;
    const rate = procurementCosts?.resolvedDowntimeCostPerHour ?? workOrder?.downtimeCostPerHour ?? 0;
    return hours * rate;
  }, [workOrder?.actualDowntimeHours, workOrder?.downtimeCostPerHour, procurementCosts?.resolvedDowntimeCostPerHour]);

  const grandTotal = useMemo(() => {
    return totalLaborCost + totalPartsCost + totalProcurementCost + downtimeCost;
  }, [totalPartsCost, totalLaborCost, totalProcurementCost, downtimeCost]);

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
    procurementCosts,
    isLoadingParts,
    isLoadingCosts,
    isLoadingProcurement,
    totalPartsCost,
    totalLaborCost,
    totalProcurementCost,
    downtimeCost,
    grandTotal,
    invalidateParts,
    invalidateChecklist,
  };
}
