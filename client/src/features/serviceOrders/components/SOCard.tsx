import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SOStatusBadge } from "./SOStatusBadge";
import { SOProgressBar } from "./SOProgressBar";
import { Calendar, Clock, DollarSign, Building2, Ship } from "lucide-react";
import { format } from "date-fns";
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
  isLoading?: boolean;
}

export function SOCard({ order, onView, onEdit, onSend, onConfirm, onStart, onComplete, onCancel, isLoading }: SOCardProps) {
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) {return "—";}
    return format(new Date(date), "MMM d, yyyy");
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) {return "—";}
    return `${order.currency || "USD"} ${formatNumber(amount)}`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-so-${order.id}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{order.soNumber}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{order.workOrderNumber || "—"}</p>
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
        {order.scope && (
          <p className="text-sm text-muted-foreground line-clamp-2">{order.scope}</p>
        )}
        <div className="flex gap-2 pt-2">
          {onView && (
            <Button variant="outline" size="sm" onClick={() => onView(order)} data-testid={`button-view-so-${order.id}`}>
              View
            </Button>
          )}
          {order.status === "draft" && onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(order)} data-testid={`button-edit-so-${order.id}`}>
              Edit
            </Button>
          )}
          {order.status === "draft" && onSend && (
            <Button size="sm" onClick={() => onSend(order.id)} disabled={isLoading} data-testid={`button-send-so-${order.id}`}>
              Send
            </Button>
          )}
          {order.status === "sent" && onConfirm && (
            <Button size="sm" onClick={() => onConfirm(order.id)} disabled={isLoading} data-testid={`button-confirm-so-${order.id}`}>
              Confirm
            </Button>
          )}
          {order.status === "confirmed" && onStart && (
            <Button size="sm" onClick={() => onStart(order.id)} disabled={isLoading} data-testid={`button-start-so-${order.id}`}>
              Start
            </Button>
          )}
          {order.status === "in_progress" && onComplete && (
            <Button size="sm" onClick={() => onComplete(order.id)} disabled={isLoading} data-testid={`button-complete-so-${order.id}`}>
              Complete
            </Button>
          )}
          {!["completed", "cancelled"].includes(order.status) && onCancel && (
            <Button variant="destructive" size="sm" onClick={() => onCancel(order.id)} disabled={isLoading} data-testid={`button-cancel-so-${order.id}`}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
