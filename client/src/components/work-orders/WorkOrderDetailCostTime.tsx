import { Clock, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Separator } from "@/components/ui/separator";
import type { ProcurementCosts } from "@/features/work-orders";
import type { WorkOrder } from "@shared/schema";

interface CostBreakdownProps {
  workOrder: WorkOrder;
  totalPartsCost: number;
  totalLaborCost: number;
  totalProcurementCost: number;
  downtimeCost: number;
  procurementCosts: ProcurementCosts | null;
  grandTotal: number;
  assignedCrewRate: number | null;
  calculatedLaborCost: number | null;
}

export function CostBreakdown({
  workOrder,
  totalPartsCost,
  totalLaborCost,
  totalProcurementCost,
  downtimeCost,
  procurementCosts,
  grandTotal,
  assignedCrewRate,
  calculatedLaborCost,
}: CostBreakdownProps) {
  return (
    <div>
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        Cost Breakdown
      </h4>
      <div className="space-y-2 text-sm">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">
          Internal Costs
        </div>
        <div className="flex justify-between" data-testid="cost-internal-parts">
          <span className="text-muted-foreground">Internal Parts</span>
          <span>${totalPartsCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center" data-testid="cost-internal-labor">
          <span className="text-muted-foreground">Internal Labor</span>
          <div className="text-right">
            <span>${totalLaborCost.toFixed(2)}</span>
            {calculatedLaborCost !== null &&
              calculatedLaborCost !== totalLaborCost &&
              assignedCrewRate !== null && (
                <span className="text-xs text-muted-foreground block">
                  Est: ${calculatedLaborCost.toFixed(2)} ({workOrder.laborHours}h x $
                  {assignedCrewRate.toFixed(2)}/hr)
                </span>
              )}
          </div>
        </div>
        {downtimeCost > 0 && (
          <div className="flex justify-between" data-testid="cost-downtime">
            <span className="text-muted-foreground">Downtime</span>
            <span>${downtimeCost.toFixed(2)}</span>
          </div>
        )}
        {totalProcurementCost > 0 && (
          <>
            <Separator className="my-1" />
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              External Procurement
            </div>
            {procurementCosts && procurementCosts.serviceOrderCosts > 0 && (
              <div className="flex justify-between" data-testid="cost-service-orders">
                <span className="text-muted-foreground">
                  Service Orders ({procurementCosts.serviceOrderDetails.length})
                </span>
                <span>${procurementCosts.serviceOrderCosts.toFixed(2)}</span>
              </div>
            )}
            <div
              className="flex justify-between font-medium text-muted-foreground"
              data-testid="cost-procurement-subtotal"
            >
              <span>Procurement Subtotal</span>
              <span>${totalProcurementCost.toFixed(2)}</span>
            </div>
          </>
        )}
        <Separator />
        <div className="flex justify-between font-medium" data-testid="cost-grand-total">
          <span>Total Cost</span>
          <span>${grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export function TimeTracking({ workOrder }: { workOrder: WorkOrder }) {
  return (
    <div>
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Time Tracking
      </h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground block">Estimated Hours</span>
          <span>{workOrder.estimatedDowntimeHours ?? "—"}h</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Actual Hours</span>
          <span>{workOrder.actualDowntimeHours ?? "—"}h</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Created</span>
          <span>
            {workOrder.createdAt
              ? formatDistanceToNow(new Date(workOrder.createdAt), { addSuffix: true })
              : "Unknown"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Last Updated</span>
          <span>
            {workOrder.updatedAt
              ? formatDistanceToNow(new Date(workOrder.updatedAt), { addSuffix: true })
              : "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );
}
