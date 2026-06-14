import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus } from "lucide-react";
import { useWorkOrderServiceOrders } from "@/features/work-orders/hooks/useWoSoBridge";
import { useWorkOrderServiceRequests } from "@/features/serviceRequests/hooks/useServiceRequests";
import { ServiceOrderCard, ServiceRequestCard } from "./LinkedServiceOrdersPanelCards";
import { CreateServiceRequestDialog } from "./LinkedServiceRequestDialog";

interface LinkedServiceOrdersPanelProps {
  workOrderId: string;
  workOrderNumber: string;
  workOrderStatus?: string;
}

export function LinkedServiceOrdersPanel({
  workOrderId,
  workOrderNumber,
  workOrderStatus,
}: LinkedServiceOrdersPanelProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: soData, isLoading: soLoading } = useWorkOrderServiceOrders(workOrderId);
  const { data: srData, isLoading: srLoading } = useWorkOrderServiceRequests(workOrderId);

  const serviceOrders = soData?.serviceOrders || [];
  const serviceRequests = srData?.serviceRequests || [];
  const hasActiveServiceOrders = serviceOrders.some(
    (so) => !["completed", "cancelled"].includes(so.status)
  );
  const hasPendingRequests = serviceRequests.some((sr) =>
    ["pending_review", "under_review", "approved"].includes(sr.status)
  );
  const isLoading = soLoading || srLoading;

  return (
    <div data-testid="linked-service-orders-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">External Service</h3>
          {(serviceOrders.length > 0 || serviceRequests.length > 0) && (
            <Badge variant="outline" className="text-[10px]">
              {serviceRequests.length > 0 && `${serviceRequests.length} req`}
              {serviceRequests.length > 0 && serviceOrders.length > 0 && " / "}
              {serviceOrders.length > 0 && `${serviceOrders.length} SO`}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1"
          onClick={() => setCreateDialogOpen(true)}
          data-testid="button-request-service"
        >
          <Plus className="h-3 w-3" /> Request Service
        </Button>
      </div>

      {(workOrderStatus === "awaiting_service" || hasActiveServiceOrders || hasPendingRequests) && (
        <div
          className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 mb-3"
          data-testid="awaiting-service-banner"
        >
          {hasPendingRequests && !hasActiveServiceOrders
            ? "Service request submitted — awaiting procurement review."
            : "This work order is awaiting external service completion."}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : serviceRequests.length === 0 && serviceOrders.length === 0 ? (
        <div
          className="text-center py-4 text-muted-foreground text-xs border rounded-lg"
          data-testid="no-linked-sos"
        >
          No service requests or orders linked.
          <br />
          <span className="text-[11px]">
            Click "Request Service" to submit a request to procurement.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {serviceRequests.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Service Requests
              </div>
              {serviceRequests.map((sr) => (
                <ServiceRequestCard key={sr.id} sr={sr} />
              ))}
            </div>
          )}

          {serviceOrders.length > 0 && (
            <div className="space-y-2">
              {serviceRequests.length > 0 && (
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-3">
                  Service Orders
                </div>
              )}
              {serviceOrders.map((so) => (
                <ServiceOrderCard key={so.id} so={so} />
              ))}
            </div>
          )}
        </div>
      )}

      <CreateServiceRequestDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        workOrderId={workOrderId}
        workOrderNumber={workOrderNumber}
      />
    </div>
  );
}
