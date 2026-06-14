import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { useCustomMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useCrudMutations";
import { useWorkOrders } from "./useWorkOrders";
import type { WorkOrderFormData } from "./useWorkOrderFormDialogData";
import { useVessels, useEquipmentList } from "@/features/vessels";
import { useCrewList } from "@/features/crew";
import type { WorkOrder, InsertWorkOrder } from "@shared/schema";
import type { WorkOrderFilters } from "@/components/work-orders";
import {
  DEFAULT_WORK_ORDER_FILTERS,
  parseFiltersFromSearch,
  buildWorkOrdersUrl,
} from "../lib/filters-url";

interface PartUsageRecord {
  partId: string;
  quantityUsed: number;
}
interface CostRecord {
  amount?: number;
}
export function useWorkOrdersPageData() {
  const { toast } = useToast();
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formDialogMode, setFormDialogMode] = useState<"create" | "edit">("create");
  const [defaultVesselId, setDefaultVesselId] = useState<string>("");
  const [defaultEquipmentId, setDefaultEquipmentId] = useState<string>("");
  const [_selectedVesselIdForCreate, _setSelectedVesselIdForCreate] = useState<string>("");
  const [_timerTick, setTimerTick] = useState(0);
  const [sortColumn, setSortColumn] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOrder, setDrawerOrder] = useState<WorkOrder | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneOrder, setCloneOrder] = useState<WorkOrder | null>(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<WorkOrder | null>(null);
  const [filters, setFiltersState] = useState<WorkOrderFilters>(() =>
    parseFiltersFromSearch(typeof globalThis === "undefined" ? "" : globalThis.location.search)
  );
  const setFilters = (next: WorkOrderFilters | ((prev: WorkOrderFilters) => WorkOrderFilters)) => {
    setFiltersState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      if (typeof globalThis !== "undefined") {
        globalThis.history.replaceState({}, "", buildWorkOrdersUrl(value));
      }
      return value;
    });
  };

  const filterVesselId: string | undefined =
    filters.vesselId !== "all" ? filters.vesselId : undefined;
  const filterStatus: string | undefined = filters.status !== "all" ? filters.status : undefined;
  const {
    data: workOrders,
    isLoading,
    error,
    refetch,
  } = useWorkOrders({
    ...(filterVesselId !== undefined ? { vesselId: filterVesselId } : {}),
    ...(filterStatus !== undefined ? { status: filterStatus } : {}),
  });
  const { data: vessels = [] } = useVessels();
  const { data: equipment = [] } = useEquipmentList();
  const { data: allCrewMembers = [] } = useCrewList();
  const { data: crewMembers = [] } = useCrewList(_selectedVesselIdForCreate || undefined);

  useEffect(() => {
    if (typeof globalThis === "undefined") {
      return;
    }
    const searchParams = new URLSearchParams(globalThis.location.search);
    if (searchParams.get("action") === "create") {
      const equipmentId = searchParams.get("equipmentId") ?? "";
      if (equipmentId && equipment.length > 0) {
        const selectedEquipment = equipment.find((eq) => eq.id === equipmentId);
        if (selectedEquipment) {
          setDefaultVesselId(selectedEquipment.vesselId || "");
          setDefaultEquipmentId(equipmentId);
        }
      }
      setFormDialogMode("create");
      setFormDialogOpen(true);
      setTimeout(() => {
        if (typeof globalThis !== "undefined") {
          const cleaned = new URLSearchParams(globalThis.location.search);
          cleaned.delete("action");
          cleaned.delete("equipmentId");
          const qs = cleaned.toString();
          globalThis.history.replaceState({}, "", qs ? `/work-orders?${qs}` : "/work-orders");
        }
      }, 100);
    }
  }, [location, equipment]);
  useEffect(() => {
    const interval = setInterval(() => setTimerTick((prev) => prev + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const getCrewName = (crewId: string | null) => {
    if (!crewId) {
      return "Not assigned";
    }
    const crew = allCrewMembers.find((c) => c.id === crewId);
    return crew?.name || crewId;
  };
  const getEquipmentName = (equipmentId: string) => {
    const eq = equipment.find((e) => e.id === equipmentId);
    return eq?.name || equipmentId;
  };
  const getVesselName = (vesselId: string | null) => {
    if (!vesselId) {
      return "Not assigned";
    }
    const vessel = vessels.find((v) => v.id === vesselId);
    return vessel?.name || vesselId;
  };
  const hasActiveFilters =
    filters.search ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.vesselId !== "all" ||
    filters.engineerId !== "all" ||
    filters.equipmentCategory !== "all" ||
    filters.dueDateFrom ||
    filters.dueDateTo;
  const _clearAllFilters = () => {
    setFilters({ ...DEFAULT_WORK_ORDER_FILTERS });
  };
  const _filteredEquipmentForCreate = _selectedVesselIdForCreate
    ? equipment.filter((eq) => eq.vesselId === _selectedVesselIdForCreate)
    : equipment;

  const createMutation = useCustomMutation<{ payload: InsertWorkOrder; templateId?: string }>({
    mutationFn: async ({ payload, templateId }) => {
      const createdOrder = await apiRequest<WorkOrder>("POST", "/api/work-orders", payload);
      if (templateId && createdOrder?.id) {
        try {
          await apiRequest("POST", `/api/work-orders/${createdOrder.id}/initialize-checklist`, {
            templateId,
          });
        } catch {
          /* silent fail for checklist */
        }
      }
      return createdOrder;
    },
    invalidateKeys: ["/api/work-orders"],
    successMessage: "Work order created successfully",
    onSuccess: () => {
      setFormDialogOpen(false);
      setSelectedOrder(null);
    },
  });
  const updateMutation = useUpdateMutation<Partial<WorkOrder>>("/api/work-orders", {
    successMessage: "Work order updated successfully",
    onSuccess: () => {
      setFormDialogOpen(false);
      setSelectedOrder(null);
    },
  });
  const deleteMutation = useDeleteMutation("/api/work-orders", {
    successMessage: "Work order deleted successfully",
  });
  const clearAllMutation = useCustomMutation({
    mutationFn: () => apiRequest("DELETE", "/api/work-orders/clear"),
    invalidateKeys: ["/api/work-orders"],
    successMessage: "All work orders cleared successfully",
  });
  const completeWorkOrderMutation = useCustomMutation<{
    orderId: string;
    predictionFeedback?: Record<string, unknown> | undefined;
  }>({
    mutationFn: async ({
      orderId,
      predictionFeedback,
    }: {
      orderId: string;
      predictionFeedback?: Record<string, unknown> | undefined;
    }) => {
      const order = workOrders?.find((wo) => wo.id === orderId);
      const closeout = predictionFeedback?.["closeout"] as
        | {
            workPerformed?: string;
            causeFound?: string;
            partsUsed?: string;
            laborHours?: number | null;
            downtimeHours?: number | null;
            evidenceNote?: string;
            checklistVerified?: boolean;
            supervisorVerified?: boolean;
          }
        | undefined;
      let actualHours = typeof closeout?.laborHours === "number" ? closeout.laborHours : undefined;
      if (actualHours === undefined && order?.actualStartDate) {
        const startDate = new Date(order.actualStartDate);
        actualHours = Math.round(((Date.now() - startDate.getTime()) / (1000 * 60 * 60)) * 10) / 10;
      }

      const sanitizedPredictionFeedback = predictionFeedback
        ? Object.fromEntries(
            Object.entries(predictionFeedback).filter(([key]) => key !== "closeout")
          )
        : undefined;

      await apiRequest("POST", `/api/work-orders/${orderId}/complete-with-feedback`, {
        actualHours,
        actualDowntimeHours:
          typeof closeout?.downtimeHours === "number" ? closeout.downtimeHours : undefined,
        completionNotes: predictionFeedback?.["notes"],
        closeout,
        predictionFeedback: sanitizedPredictionFeedback,
      });
      return { orderId };
    },
    invalidateKeys: ["/api/work-orders", "/api/work-order-completions"],
    successMessage: "Work order completed successfully",
    onSuccess: () => setViewModalOpen(false),
  });

  const handleViewOrder = (order: WorkOrder) => {
    setDrawerOrder(order);
    setDrawerOpen(true);
  };
  const handleViewOrderModal = (order: WorkOrder) => {
    setSelectedOrder(order);
    setViewModalOpen(true);
  };
  const handleEditOrder = (order: WorkOrder) => {
    setSelectedOrder(order);
    setFormDialogMode("edit");
    setFormDialogOpen(true);
  };
  const handleDeleteOrder = (order: WorkOrder) => {
    setPendingDeleteOrder(order);
  };
  const confirmDeleteOrder = () => {
    if (pendingDeleteOrder) {
      deleteMutation.mutate(pendingDeleteOrder.id, {
        onSuccess: () => setPendingDeleteOrder(null),
        onError: () => setPendingDeleteOrder(null),
      });
    }
  };
  const handleCreateOrder = () => {
    setSelectedOrder(null);
    setDefaultVesselId("");
    setDefaultEquipmentId("");
    setFormDialogMode("create");
    setFormDialogOpen(true);
  };
  const handleCloneOrder = (order: WorkOrder) => {
    setCloneOrder(order);
    setCloneDialogOpen(true);
  };
  const handleClearAllOrders = () => {
    if (
      confirm(
        `Are you sure you want to clear ALL work orders? This action cannot be undone and will remove ${workOrders?.length || 0} work orders.`
      )
    ) {
      clearAllMutation.mutate(undefined);
    }
  };
  const handleFormSubmit = (formData: WorkOrderFormData & { templateId?: string }) => {
    if (formDialogMode === "create") {
      const { templateId, ...restData } = formData;
      const payload: InsertWorkOrder = { ...restData, orgId: getCurrentOrgId() ?? "" } as never;
      createMutation.mutate({ payload, ...(templateId !== undefined ? { templateId } : {}) });
    } else if (selectedOrder) {
      const { templateId: _templateId, ...restData } = formData;
      const cleaned = Object.fromEntries(
        Object.entries(restData).filter(([, v]) => v !== undefined)
      ) as Partial<WorkOrder>;
      updateMutation.mutate({ id: selectedOrder.id, data: cleaned });
    }
  };
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerOrder(null);
  };
  const closeCloneDialog = (open: boolean) => {
    setCloneDialogOpen(open);
    if (!open) {
      setCloneOrder(null);
    }
  };
  const onCloneSuccess = (clonedOrder: WorkOrder) => {
    toast({
      title: "Work Order Cloned",
      description: `Successfully created ${clonedOrder.woNumber}`,
    });
    setDrawerOrder(clonedOrder);
    setDrawerOpen(true);
  };

  const filteredAndSortedWorkOrders = useMemo(() => {
    let orders = workOrders ?? [];
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      orders = orders.filter((wo) => {
        const woNumber = (wo.woNumber || wo.id).toLowerCase();
        const reason = (wo.reason || "").toLowerCase();
        const description = (wo.description || "").toLowerCase();
        const equipmentName = (
          equipment.find((e) => e.id === wo.equipmentId)?.name || ""
        ).toLowerCase();
        return (
          woNumber.includes(searchLower) ||
          reason.includes(searchLower) ||
          description.includes(searchLower) ||
          equipmentName.includes(searchLower)
        );
      });
    }
    if (filters.status !== "all") {
      orders = orders.filter((wo) => wo.status === filters.status);
    }
    if (filters.priority !== "all") {
      orders = orders.filter((wo) => wo.priority === Number.parseInt(filters.priority));
    }
    if (filters.vesselId !== "all") {
      orders = orders.filter((wo) => wo.vesselId === filters.vesselId);
    }
    if (filters.engineerId !== "all") {
      orders = orders.filter((wo) => wo.assignedCrewId === filters.engineerId);
    }
    if (filters.equipmentCategory !== "all") {
      orders = orders.filter((wo) => {
        const eq = equipment.find((e) => e.id === wo.equipmentId);
        return eq?.type === filters.equipmentCategory || eq?.category === filters.equipmentCategory;
      });
    }
    if (filters.dueDateFrom) {
      const fromDate = new Date(filters.dueDateFrom);
      orders = orders.filter((wo) => wo.plannedEndDate && new Date(wo.plannedEndDate) >= fromDate);
    }
    if (filters.dueDateTo) {
      const toDate = new Date(filters.dueDateTo);
      orders = orders.filter((wo) => wo.plannedEndDate && new Date(wo.plannedEndDate) <= toDate);
    }
    return [...orders].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      switch (sortColumn) {
        case "woNumber":
        case "orderId":
          aValue = a.woNumber || a.id;
          bValue = b.woNumber || b.id;
          break;
        case "vessel":
          aValue = vessels.find((v) => v.id === a.vesselId)?.name || "";
          bValue = vessels.find((v) => v.id === b.vesselId)?.name || "";
          break;
        case "equipment":
          aValue = equipment.find((e) => e.id === a.equipmentId)?.name || a.equipmentId;
          bValue = equipment.find((e) => e.id === b.equipmentId)?.name || b.equipmentId;
          break;
        case "priority":
          aValue = a.priority;
          bValue = b.priority;
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "dueDate":
          aValue = a.plannedEndDate ? new Date(a.plannedEndDate).getTime() : 0;
          bValue = b.plannedEndDate ? new Date(b.plannedEndDate).getTime() : 0;
          break;
        case "createdAt":
        case "created":
          aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          return 0;
      }
      if (aValue < bValue) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [workOrders, filters, sortColumn, sortDirection, equipment, vessels]);

  const openOrders = workOrders?.filter((wo) => wo.status !== "completed") ?? [];
  const completedOrders = workOrders?.filter((wo) => wo.status === "completed") ?? [];
  const highPriorityOrders = workOrders?.filter((wo) => wo.priority === 1) ?? [];

  return {
    workOrders,
    vessels,
    equipment,
    allCrewMembers,
    crewMembers,
    isLoading,
    error,
    refetch,
    selectedOrder,
    viewModalOpen,
    setViewModalOpen,
    formDialogOpen,
    setFormDialogOpen,
    formDialogMode,
    defaultVesselId,
    defaultEquipmentId,
    sortColumn,
    sortDirection,
    filters,
    setFilters,
    drawerOpen,
    drawerOrder,
    cloneDialogOpen,
    cloneOrder,
    filteredAndSortedWorkOrders,
    openOrders,
    completedOrders,
    highPriorityOrders,
    hasActiveFilters,
    createMutation,
    updateMutation,
    deleteMutation,
    clearAllMutation,
    completeWorkOrderMutation,
    queryClient,
    getCrewName,
    getEquipmentName,
    getVesselName,
    handleViewOrder,
    handleViewOrderModal,
    handleEditOrder,
    handleDeleteOrder,
    pendingDeleteOrder,
    setPendingDeleteOrder,
    confirmDeleteOrder,
    handleCreateOrder,
    handleCloneOrder,
    handleClearAllOrders,
    handleFormSubmit,
    handleSort,
    closeDrawer,
    closeCloneDialog,
    onCloneSuccess,
  };
}

export function getWorkOrderDuration(order: WorkOrder & { actualDuration?: number }): string {
  if (order.status === "completed") {
    if (typeof order.actualDuration === "number") {
      const m = order.actualDuration;
      const h = Math.floor(m / 60);
      const minutes = m % 60;
      return `${h}h ${minutes}m`;
    }
    const actualEndDate = (order as { actualEndDate?: Date | string | null }).actualEndDate;
    if (order.actualStartDate && actualEndDate) {
      const start = new Date(order.actualStartDate).getTime();
      const end = new Date(actualEndDate).getTime();
      const m = Math.max(0, Math.round((end - start) / (1000 * 60)));
      const h = Math.floor(m / 60);
      const minutes = m % 60;
      return `${h}h ${minutes}m`;
    }
  }
  if (order.actualStartDate && order.status !== "completed") {
    const start = new Date(order.actualStartDate).getTime();
    const now = Date.now();
    const m = Math.max(0, Math.round((now - start) / (1000 * 60)));
    const h = Math.floor(m / 60);
    const minutes = m % 60;
    return `${h}h ${minutes}m (in progress)`;
  }
  return "Not started";
}

export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1:
      return "bg-destructive/20 text-destructive";
    case 2:
      return "bg-chart-2/20 text-chart-2";
    default:
      return "bg-chart-3/20 text-chart-3";
  }
}
export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1:
      return "Critical";
    case 2:
      return "High";
    case 3:
      return "Medium";
    default:
      return "Low";
  }
}
export function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-chart-3/20 text-chart-3";
    case "in_progress":
      return "bg-chart-2/20 text-chart-2";
    default:
      return "bg-muted/20 text-muted-foreground";
  }
}
