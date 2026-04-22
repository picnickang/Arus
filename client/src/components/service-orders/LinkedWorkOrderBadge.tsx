/**
 * LinkedWorkOrderBadge
 *
 * Shows inside Service Order detail views and SO cards.
 * Displays the originating work order with a clickable link.
 *
 * Usage:
 *   <LinkedWorkOrderBadge serviceOrderId={so.id} />
 *
 * Or if you already have the WO data on the SO record:
 *   <LinkedWorkOrderBadge
 *     workOrderId={so.workOrderId}
 *     workOrderNumber={so.workOrderNumber}
 *   />
 */

import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, ExternalLink, LinkIcon } from "lucide-react";
import { useServiceOrderWorkOrder } from "@/features/work-orders/hooks/useWoSoBridge";

// ─── Props variants ─────────────────────────────────────────────────────────

interface LinkedWorkOrderBadgePropsWithFetch {
  serviceOrderId: string;
  workOrderId?: never;
  workOrderNumber?: never;
}

interface LinkedWorkOrderBadgePropsWithData {
  serviceOrderId?: never;
  workOrderId: string | null | undefined;
  workOrderNumber: string | null | undefined;
}

type LinkedWorkOrderBadgeProps =
  | LinkedWorkOrderBadgePropsWithFetch
  | LinkedWorkOrderBadgePropsWithData;

// ─── Compact badge (for use in card views and tables) ───────────────────────

export function LinkedWorkOrderBadge(props: LinkedWorkOrderBadgeProps) {
  // If we have the WO data directly (from the SO record), use it
  if ("workOrderId" in props && props.workOrderId) {
    return (
      <Link
        href={`/work-orders?id=${props.workOrderId}`}
        className="inline-flex items-center gap-1 no-underline"
        data-testid={`linked-wo-badge-${props.workOrderId}`}
      >
        <Badge variant="outline" className="text-[10px] gap-1 hover:bg-accent cursor-pointer">
          <Wrench className="h-2.5 w-2.5" />
          {props.workOrderNumber || "Work Order"}
        </Badge>
      </Link>
    );
  }

  // Otherwise fetch via the API
  if ("serviceOrderId" in props && props.serviceOrderId) {
    return <FetchedWorkOrderBadge serviceOrderId={props.serviceOrderId} />;
  }

  return null;
}

function FetchedWorkOrderBadge({ serviceOrderId }: { serviceOrderId: string }) {
  const { data, isLoading } = useServiceOrderWorkOrder(serviceOrderId);

  if (isLoading) {
    return <Skeleton className="h-5 w-20 inline-block" />;
  }

  if (!data?.linked || !data.workOrder) {
    return null;
  }

  return (
    <Link
      href={`/work-orders?id=${data.workOrder.id}`}
      className="inline-flex items-center gap-1 no-underline"
      data-testid={`linked-wo-badge-${data.workOrder.id}`}
    >
      <Badge variant="outline" className="text-[10px] gap-1 hover:bg-accent cursor-pointer">
        <Wrench className="h-2.5 w-2.5" />
        {data.workOrder.workOrderNumber || "Work Order"}
      </Badge>
    </Link>
  );
}

// ─── Full panel (for use in SO detail drawer) ───────────────────────────────

export function LinkedWorkOrderPanel({ serviceOrderId }: { serviceOrderId: string }) {
  const { data, isLoading } = useServiceOrderWorkOrder(serviceOrderId);

  if (isLoading) {
    return <Skeleton className="h-20" />;
  }

  if (!data?.linked || !data.workOrder) {
    return (
      <div
        className="text-center py-3 text-muted-foreground text-xs border rounded-lg"
        data-testid="no-linked-wo"
      >
        <LinkIcon className="h-4 w-4 mx-auto mb-1 opacity-50" />
        No linked work order
      </div>
    );
  }

  const wo = data.workOrder;
  const statusColors: Record<string, string> = {
    open: "bg-blue-500/15 text-blue-600",
    in_progress: "bg-yellow-500/15 text-yellow-600",
    awaiting_service: "bg-amber-500/15 text-amber-600",
    completed: "bg-green-500/15 text-green-600",
    cancelled: "bg-red-500/15 text-red-600",
  };

  return (
    <div data-testid="linked-wo-panel">
      <div className="flex items-center gap-2 mb-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Originating Work Order</h3>
      </div>

      <div
        className="p-3 rounded-lg border hover:bg-accent/30 transition-colors"
        data-testid={`linked-wo-detail-${wo.id}`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{wo.workOrderNumber}</span>
            <Badge className={`text-[10px] ${statusColors[wo.status] || ""}`}>{wo.status}</Badge>
          </div>
          <Link
            href={`/work-orders?id=${wo.id}`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
            data-testid={`link-wo-${wo.id}`}
          >
            Open <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {wo.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{wo.description}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          {wo.equipmentName && <span>{wo.equipmentName}</span>}
          {wo.vesselName && <span>· {wo.vesselName}</span>}
        </div>
      </div>
    </div>
  );
}
