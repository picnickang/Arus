import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Package, Plus, Loader2, Trash2 } from "lucide-react";
import { MultiLinePartsRequestDialog } from "./MultiLinePartsRequestDialog";
import { EnhancedServiceRequestDialog } from "./EnhancedServiceRequestDialog";
import {
  useWorkOrderRequests,
  useOutOfStockSuggestions,
  ServiceOrderCard,
  PartsRequestCard,
} from "@/features/work-orders";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ServiceOrderCardData } from "@/features/work-orders/components/ServiceOrderCard";
import type { PartsRequestCardData } from "@/features/work-orders/components/PartsRequestCard";

interface WorkOrderRequestsTabProps {
  workOrderId: string;
  isReadOnly?: boolean;
  requireAdvancedOptions?: boolean;
}

export function WorkOrderRequestsTab({
  workOrderId,
  isReadOnly = false,
  requireAdvancedOptions = false,
}: WorkOrderRequestsTabProps) {
  const [soDialogOpen, setSoDialogOpen] = useState(false);
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [editingSO, setEditingSO] = useState<ServiceOrderCardData | null>(null);
  const [editingPR, setEditingPR] = useState<PartsRequestCardData | null>(null);

  const { canApprove, canEdit } = useUserPermissions();
  const canApprovePR = canApprove("purchase_requests");
  const canApproveSO = canApprove("service_orders");
  const canEditPR = canEdit("purchase_requests");
  const canEditSO = canEdit("service_orders");

  const {
    serviceOrders,
    isLoadingServiceOrders,
    purchaseRequests,
    isLoadingPurchaseRequests,
    createServiceOrder,
    isCreatingServiceOrder,
    createPurchaseRequest,
    isCreatingPurchaseRequest,
    deleteServiceOrder,
    isDeletingServiceOrder,
    deletingServiceOrderId,
    deletePurchaseRequest,
    isDeletingPurchaseRequest,
    deletingPurchaseRequestId,
    fulfillItem,
    isFulfillingItem,
    updatePRStatus,
    isUpdatingPRStatus,
    updateServiceOrder,
    isUpdatingServiceOrder,
    updatePurchaseRequest,
    isUpdatingPurchaseRequest,
    bulkDeleteServiceOrders,
    isBulkDeletingServiceOrders,
    bulkDeletePurchaseRequests,
    isBulkDeletingPurchaseRequests,
  } = useWorkOrderRequests(workOrderId);

  const { data: outOfStockSuggestions = [] } = useOutOfStockSuggestions(workOrderId);

  const handleCreateServiceOrder = (data: Record<string, unknown>) => {
    if (editingSO) {
      updateServiceOrder(
        { soId: editingSO.id, data },
        {
          onSuccess: () => {
            setSoDialogOpen(false);
            setEditingSO(null);
          },
        }
      );
    } else {
      createServiceOrder(data, {
        onSuccess: () => setSoDialogOpen(false),
      });
    }
  };

  const handleCreatePurchaseRequest = (data: {
    notes?: string;
    items: Array<{ partId?: string; description: string; quantity: number; notes?: string }>;
  }) => {
    createPurchaseRequest(data, {
      onSuccess: () => setPrDialogOpen(false),
    });
  };

  const handleEditServiceOrder = (so: ServiceOrderCardData) => {
    setEditingSO(so);
    setSoDialogOpen(true);
  };

  const handleSoDialogClose = (open: boolean) => {
    setSoDialogOpen(open);
    if (!open) {
      setEditingSO(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Service Orders
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isReadOnly && serviceOrders.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={isBulkDeletingServiceOrders}
                      data-testid="btn-clear-all-so"
                    >
                      {isBulkDeletingServiceOrders ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Service Orders?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all draft and cancelled service orders for this work order.
                        Orders that have been sent or are in progress cannot be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => bulkDeleteServiceOrders()}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSoDialogOpen(true)}
                  data-testid="btn-request-service"
                >
                  <Plus className="h-4 w-4 mr-1" /> Request Service
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingServiceOrders ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : serviceOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No external services requested
            </p>
          ) : (
            <div className="space-y-3">
              {serviceOrders.map((so) => (
                <ServiceOrderCard
                  key={so.id}
                  serviceOrder={so}
                  onDelete={deleteServiceOrder}
                  onEdit={handleEditServiceOrder}
                  isDeleting={isDeletingServiceOrder && deletingServiceOrderId === so.id}
                  isReadOnly={isReadOnly}
                  canApprove={canApproveSO}
                  canEditPermission={canEditSO}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Purchase Requests
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isReadOnly && purchaseRequests.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={isBulkDeletingPurchaseRequests}
                      data-testid="btn-clear-all-pr"
                    >
                      {isBulkDeletingPurchaseRequests ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Purchase Requests?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all draft and cancelled purchase requests for this work
                        order. Submitted or approved requests cannot be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => bulkDeletePurchaseRequests()}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPrDialogOpen(true)}
                  data-testid="btn-request-parts"
                >
                  <Plus className="h-4 w-4 mr-1" /> New Purchase Request
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPurchaseRequests ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : purchaseRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No purchase requests</p>
          ) : (
            <div className="space-y-3">
              {purchaseRequests.map((pr) => (
                <PartsRequestCard
                  key={pr.id}
                  purchaseRequest={pr}
                  onDelete={deletePurchaseRequest}
                  onFulfillItem={(prId, itemId, qty) =>
                    fulfillItem({ prId, itemId, quantity: qty })
                  }
                  onUpdateStatus={(prId, status) => updatePRStatus({ prId, status })}
                  isDeleting={isDeletingPurchaseRequest && deletingPurchaseRequestId === pr.id}
                  isFulfilling={isFulfillingItem}
                  isUpdatingStatus={isUpdatingPRStatus}
                  isReadOnly={isReadOnly}
                  canApprove={canApprovePR}
                  canEditPermission={canEditPR}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EnhancedServiceRequestDialog
        open={soDialogOpen}
        onOpenChange={handleSoDialogClose}
        onSubmit={handleCreateServiceOrder as unknown as Parameters<typeof EnhancedServiceRequestDialog>[0]["onSubmit"]}
        isPending={editingSO ? isUpdatingServiceOrder : isCreatingServiceOrder}
        initialData={
          editingSO
            ? {
                serviceProviderId: editingSO.serviceProviderId,
                scope: editingSO.scope,
                scheduledStartDate: editingSO.scheduledStartDate,
                scheduledEndDate: editingSO.scheduledEndDate,
                estimatedDurationHours: editingSO.estimatedDurationHours,
              }
            : undefined
        }
        isEditing={!!editingSO}
        defaultExpanded={requireAdvancedOptions}
      />
      <MultiLinePartsRequestDialog
        open={prDialogOpen}
        onOpenChange={setPrDialogOpen}
        onSubmit={handleCreatePurchaseRequest}
        isPending={isCreatingPurchaseRequest}
        suggestions={outOfStockSuggestions}
      />
    </div>
  );
}

export default WorkOrderRequestsTab;
