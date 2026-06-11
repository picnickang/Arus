import { useState as useLocalState } from "react";
import { Plus, Trash2, Package, FileText, Wrench, RefreshCw, AlertTriangle } from "lucide-react";
import { WorkOrderRequestsTab } from "@/components/work-orders/WorkOrderRequestsTab";
import {
  WorkOrderCloseoutWizard,
  type CloseoutPredictionFeedback,
} from "@/components/work-orders/WorkOrderCloseoutWizard";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  WorkOrderFilterPanel,
  VirtualizedWorkOrderTable,
  WorkOrderDetailDrawer,
  WorkOrderFormDialog,
  WorkOrderCloneDialog,
} from "@/components/work-orders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { MultiPartSelector } from "@/components/MultiPartSelector";
import {
  useWorkOrdersPageData,
  getWorkOrderDuration,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
} from "@/features/work-orders";
import { PermissionGate } from "@/components/PermissionGate";
import { DeleteWorkOrderDialog } from "@/components/work-orders/DeleteWorkOrderDialog";
import type { WorkOrder } from "@shared/schema";

export default function WorkOrders() {
  const {
    workOrders,
    vessels,
    equipment,
    allCrewMembers,
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
    clearAllMutation,
    completeWorkOrderMutation,
    queryClient,
    getEquipmentName,
    getVesselName,
    handleViewOrder,
    handleEditOrder,
    handleDeleteOrder,
    pendingDeleteOrder,
    setPendingDeleteOrder,
    confirmDeleteOrder,
    deleteMutation,
    handleCreateOrder,
    handleClearAllOrders,
    handleFormSubmit,
    handleSort,
    closeDrawer,
    closeCloneDialog,
    onCloneSuccess,
  } = useWorkOrdersPageData();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent>
            <TableSkeleton rows={10} columns={8} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const message = error?.message ?? "Unknown error";
    const isNetworkError =
      message === "Load failed" ||
      message === "Failed to fetch" ||
      message.includes("NetworkError");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md px-4">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold" data-testid="text-work-orders-error-title">
            {isNetworkError ? "Connection issue" : "Error loading work orders"}
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="text-work-orders-error-message">
            {isNetworkError
              ? "Could not reach the server. Please check your connection and try again."
              : message}
          </p>
          <Button
            onClick={() => refetch()}
            variant="outline"
            data-testid="button-retry-work-orders"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Work Orders" />
      <div className="px-6 py-4 flex flex-wrap items-center justify-end gap-3">
        <PermissionGate resource="work_orders" action="delete">
          <Button
            variant="destructive"
            data-testid="button-clear-all-work-orders"
            onClick={handleClearAllOrders}
            disabled={clearAllMutation.isPending || !workOrders?.length}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {clearAllMutation.isPending ? "Clearing..." : "Clear All"}
          </Button>
        </PermissionGate>
        <PermissionGate resource="work_orders" action="create">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-create-work-order"
            onClick={handleCreateOrder}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Work Order
          </Button>
        </PermissionGate>
      </div>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          <StatCard
            label="Total Orders"
            value={workOrders?.length || 0}
            testId="stat-total-orders"
          />
          <StatCard
            label="Open"
            value={openOrders.length}
            testId="stat-open-orders"
            className="text-chart-2"
          />
          <StatCard
            label="High Priority"
            value={highPriorityOrders.length}
            testId="stat-high-priority-orders"
            className="text-destructive"
          />
          <StatCard
            label="Completed"
            value={completedOrders.length}
            testId="stat-completed-orders"
            className="text-chart-3"
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <WorkOrderFilterPanel filters={filters} onFiltersChange={setFilters} />
          <div className="flex-1 min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Work Order Management</h3>
                <p className="text-sm text-muted-foreground">
                  Track and manage maintenance work orders across your fleet
                  {hasActiveFilters && ` (${filteredAndSortedWorkOrders.length} filtered results)`}
                </p>
              </div>
            </div>
            <VirtualizedWorkOrderTable
              workOrders={
                filteredAndSortedWorkOrders as object as React.ComponentProps<
                  typeof VirtualizedWorkOrderTable
                >["workOrders"]
              }
              equipment={equipment}
              vessels={vessels}
              crew={allCrewMembers}
              isLoading={isLoading}
              onView={handleViewOrder}
              onEdit={handleEditOrder}
              onDelete={handleDeleteOrder}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </div>
        </div>
      </div>

      <WorkOrderDetailDrawer
        workOrder={drawerOrder}
        open={drawerOpen}
        onClose={closeDrawer}
        equipment={equipment}
        vessels={vessels}
        crew={allCrewMembers}
        onComplete={(id, feedback) => {
          completeWorkOrderMutation.mutate({
            orderId: id,
            ...(feedback !== undefined && {
              predictionFeedback: feedback as object as Record<string, unknown>,
            }),
          });
          closeDrawer();
        }}
        onEdit={(_order) => {
          closeDrawer();
          handleEditOrder(_order);
        }}
        onClone={(_order) => {
          closeDrawer();
          closeCloneDialog(true);
        }}
        onDelete={handleDeleteOrder}
        isCompleting={completeWorkOrderMutation.isPending}
      />
      <WorkOrderCloneDialog
        workOrder={cloneOrder}
        open={cloneDialogOpen}
        onOpenChange={closeCloneDialog}
        onSuccess={onCloneSuccess}
      />

      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent
          className="max-w-6xl w-[95vw] md:w-auto max-h-[90vh] overflow-y-auto"
          data-testid="order-detail-panel"
        >
          <DialogHeader>
            <DialogTitle>Work Order {selectedOrder?.woNumber || selectedOrder?.id}</DialogTitle>
            <DialogDescription>
              Manage work order and parts for{" "}
              {selectedOrder && getEquipmentName(selectedOrder.equipmentId)}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <ViewOrderTabs
              order={selectedOrder}
              getEquipmentName={getEquipmentName}
              getVesselName={getVesselName}
              onComplete={(feedback) =>
                completeWorkOrderMutation.mutate({
                  orderId: selectedOrder.id,
                  ...(feedback !== undefined && {
                    predictionFeedback: feedback as object as Parameters<
                      typeof completeWorkOrderMutation.mutate
                    >[0]["predictionFeedback"],
                  }),
                })
              }
              isCompleting={completeWorkOrderMutation.isPending}
              onClose={() => setViewModalOpen(false)}
              queryClient={queryClient}
            />
          )}
        </DialogContent>
      </Dialog>

      <WorkOrderFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        mode={formDialogMode}
        workOrder={selectedOrder}
        onSubmit={
          handleFormSubmit as object as React.ComponentProps<typeof WorkOrderFormDialog>["onSubmit"]
        }
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        defaultVesselId={defaultVesselId}
        defaultEquipmentId={defaultEquipmentId}
      />

      <DeleteWorkOrderDialog
        workOrderId={pendingDeleteOrder?.id ?? null}
        workOrderLabel={pendingDeleteOrder?.woNumber || pendingDeleteOrder?.id || ""}
        open={!!pendingDeleteOrder}
        onOpenChange={(o) => {
          if (!o) {
            setPendingDeleteOrder(null);
          }
        }}
        onConfirm={confirmDeleteOrder}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  testId,
  className = "text-foreground",
}: {
  label: string;
  value: number;
  testId: string;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs md:text-sm">{label}</p>
            <p className={`text-xl md:text-2xl font-bold mt-1 ${className}`} data-testid={testId}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type PredictionFeedbackData = CloseoutPredictionFeedback;

function ViewOrderTabs({
  order,
  getEquipmentName,
  getVesselName,
  onComplete,
  isCompleting,
  onClose,
  queryClient,
}: {
  order: WorkOrder;
  getEquipmentName: (id: string) => string;
  getVesselName: (id: string | null) => string;
  onComplete: (feedback?: PredictionFeedbackData) => void;
  isCompleting: boolean;
  onClose: () => void;
  queryClient: { invalidateQueries: (options: { queryKey: string[] }) => void };
}) {
  const isPredictiveWo = order.maintenanceType === "predictive";
  const [closeoutOpen, setCloseoutOpen] = useLocalState(false);

  const handleComplete = () => setCloseoutOpen(true);

  return (
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="flex w-full justify-start overflow-x-auto md:grid md:grid-cols-3 [&>*]:flex-shrink-0 [&>*]:min-h-[44px]">
        <TabsTrigger value="details" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Order Details
        </TabsTrigger>
        <TabsTrigger
          value="requests"
          className="flex items-center gap-2"
          data-testid="tab-requests"
        >
          <Wrench className="h-4 w-4" />
          Service & Purchase Requests
        </TabsTrigger>
        <TabsTrigger value="parts" className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          Parts Management
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="space-y-4 mt-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium">Order ID</Label>
            <p className="text-sm text-muted-foreground font-mono">{order.woNumber || order.id}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Vessel</Label>
            <p className="text-sm text-muted-foreground font-semibold">
              {getVesselName(order.vesselId)}
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium">Equipment</Label>
            <p className="text-sm text-muted-foreground">{getEquipmentName(order.equipmentId)}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Duration</Label>
            <p className="text-sm text-muted-foreground font-semibold">
              {getWorkOrderDuration(order)}
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium">Priority</Label>
            <Badge className={getPriorityColor(order.priority)}>
              {getPriorityLabel(order.priority)}
            </Badge>
          </div>
          <div>
            <Label className="text-sm font-medium">Status</Label>
            <Badge className={getStatusColor(order.status)}>
              {order.status.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </Badge>
          </div>
          <div className="col-span-2">
            <Label className="text-sm font-medium">Reason</Label>
            <p className="text-sm text-muted-foreground">{order.reason || "No reason provided"}</p>
          </div>
          <div className="col-span-2">
            <Label className="text-sm font-medium">Description</Label>
            <p className="text-sm text-muted-foreground" data-testid="text-order-description">
              {order.description || "No description provided"}
            </p>
          </div>
          {order.costJustification && (
            <div className="col-span-2" data-testid="text-cost-justification">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Cost Justification
              </Label>
              <div className="mt-1 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-md p-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {order.costJustification}
                </p>
              </div>
            </div>
          )}
          <div>
            <Label className="text-sm font-medium">Created</Label>
            <p className="text-sm text-muted-foreground">
              {order.createdAt
                ? formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })
                : "Unknown"}
            </p>
          </div>
          {order.actualDowntimeHours && (
            <div>
              <Label className="text-sm font-medium">Actual Downtime</Label>
              <p className="text-sm text-muted-foreground">{order.actualDowntimeHours}h</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          {order.status !== "completed" && order.status !== "cancelled" && (
            <Button
              onClick={handleComplete}
              disabled={isCompleting}
              variant="default"
              data-testid="button-complete-work-order"
            >
              {isCompleting ? "Closing..." : "Closeout"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </TabsContent>
      <TabsContent value="requests" className="mt-6">
        <WorkOrderRequestsTab
          workOrderId={order.id}
          isReadOnly={order.status === "completed"}
          requireAdvancedOptions={order.maintenanceType === "drydock"}
        />
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </TabsContent>
      <TabsContent value="parts" className="mt-6">
        <MultiPartSelector
          workOrderId={order.id}
          onPartsAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
          }}
        />
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </TabsContent>
      <WorkOrderCloseoutWizard
        open={closeoutOpen}
        onOpenChange={setCloseoutOpen}
        workOrderId={order.id}
        isPredictive={isPredictiveWo}
        isSubmitting={isCompleting}
        onComplete={(feedback?: CloseoutPredictionFeedback) => {
          onComplete(feedback);
          setCloseoutOpen(false);
        }}
      />
    </Tabs>
  );
}
