import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SOStatusBadge } from "./SOStatusBadge";
import { SOProgressBar } from "./SOProgressBar";
import { LinkedWorkOrderBadge } from "@/components/service-orders/LinkedWorkOrderBadge";
import { Calendar, Clock, DollarSign, Building2, Ship, Undo2, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import type { ServiceOrder } from "../types";
import { formatNumber } from "@/lib/formatters";

interface SOCardProps {
  order: ServiceOrder;
  onView?: (order: ServiceOrder) => void;
  onEdit?: (order: ServiceOrder) => void;
  onSend?: (id: string) => void;
  onConfirm?: (id: string) => void;
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRevert?: (id: string) => void;
  isLoading?: boolean;
  highlighted?: boolean;
}

export function SOCard({
  order,
  onView,
  onEdit,
  onSend,
  onConfirm,
  onStart,
  onComplete,
  onCancel,
  onRevert,
  isLoading,
  highlighted,
}: SOCardProps) {
  const [, setLocation] = useLocation();
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) {
      return "—";
    }
    return format(new Date(date), "MMM d, yyyy");
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) {
      return "—";
    }
    return `${order.currency || "USD"} ${formatNumber(amount)}`;
  };

  const isRevertible =
    !!order.originatingRequestId && ["draft", "sent", "confirmed"].includes(order.status);

  return (
    <Card
      id={`so-card-${order.id}`}
      className={`hover:shadow-md transition-shadow ${
        highlighted ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
      data-testid={`card-so-${order.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{order.soNumber}</CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {order.workOrderId ? (
                <LinkedWorkOrderBadge
                  workOrderId={order.workOrderId}
                  workOrderNumber={order.workOrderNumber}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{order.workOrderNumber || "—"}</p>
              )}
              {order.originatingRequestId && order.originatingRequestNumber && (
                <Badge
                  variant="outline"
                  className="cursor-pointer gap-1 hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(
                      `/logistics?tab=inventory&subtab=service-requests&focus=${order.originatingRequestId}`
                    );
                  }}
                  data-testid={`badge-from-sr-${order.id}`}
                >
                  <ClipboardList className="h-3 w-3" />
                  From {order.originatingRequestNumber}
                </Badge>
              )}
            </div>
          </div>
          <SOStatusBadge status={order.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <SOProgressBar status={order.status} />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{order.serviceProviderName || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-muted-foreground" />
            <span>{order.vesselName || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDate(order.scheduledStartDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{order.estimatedDurationHours ? `${order.estimatedDurationHours}h` : "—"}</span>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>Quote: {formatCurrency(order.quotedAmount)}</span>
          </div>
        </div>
        {order.scope && <p className="text-sm text-muted-foreground line-clamp-2">{order.scope}</p>}
        <div className="flex gap-2 pt-2">
          {onView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(order)}
              data-testid={`button-view-so-${order.id}`}
            >
              View
            </Button>
          )}
          {order.status === "draft" && onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(order)}
              data-testid={`button-edit-so-${order.id}`}
            >
              Edit
            </Button>
          )}
          {order.status === "draft" && onSend && (
            <Button
              size="sm"
              onClick={() => onSend(order.id)}
              disabled={isLoading}
              data-testid={`button-send-so-${order.id}`}
            >
              Send
            </Button>
          )}
          {order.status === "sent" && onConfirm && (
            <Button
              size="sm"
              onClick={() => onConfirm(order.id)}
              disabled={isLoading}
              data-testid={`button-confirm-so-${order.id}`}
            >
              Confirm
            </Button>
          )}
          {order.status === "confirmed" && onStart && (
            <Button
              size="sm"
              onClick={() => onStart(order.id)}
              disabled={isLoading}
              data-testid={`button-start-so-${order.id}`}
            >
              Start
            </Button>
          )}
          {order.status === "in_progress" && onComplete && (
            <Button
              size="sm"
              onClick={() => onComplete(order.id)}
              disabled={isLoading}
              data-testid={`button-complete-so-${order.id}`}
            >
              Complete
            </Button>
          )}
          {isRevertible && onRevert && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRevert(order.id)}
              disabled={isLoading}
              data-testid={`button-revert-so-${order.id}`}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Revert to Request
            </Button>
          )}
          {!["completed", "cancelled"].includes(order.status) && onCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(order.id)}
              disabled={isLoading}
              data-testid={`button-cancel-so-${order.id}`}
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
