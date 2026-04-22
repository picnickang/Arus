import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Trash2, Loader2, User, Calendar, Package, CheckCircle, Pencil } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export interface PRItemData {
  id: string;
  partId: string;
  partName?: string;
  partNumber?: string;
  description?: string;
  quantity: number;
  quantityFulfilled?: number;
  fulfillmentStatus?: string;
}

export interface PartsRequestCardData {
  id: string;
  requestNumber?: string;
  prNumber?: string;
  status: string;
  notes?: string;
  requestedBy?: string;
  requiredByDate?: string;
  createdAt?: string;
  itemCount?: number;
  items?: PRItemData[];
}

interface PartsRequestCardProps {
  purchaseRequest: PartsRequestCardData;
  onDelete?: (id: string) => void;
  onEdit?: (purchaseRequest: PartsRequestCardData) => void;
  onFulfillItem?: (prId: string, itemId: string, quantity: number) => void;
  onUpdateStatus?: (prId: string, status: string) => void;
  isDeleting?: boolean;
  isFulfilling?: boolean;
  isUpdatingStatus?: boolean;
  isReadOnly?: boolean;
  canApprove?: boolean;
  canEditPermission?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-purple-100 text-purple-800",
  ordered: "bg-yellow-100 text-yellow-800",
  received: "bg-teal-100 text-teal-800",
  closed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const FULFILLMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  partial: "bg-amber-100 text-amber-700",
  fulfilled: "bg-green-100 text-green-700",
};

const NEXT_STATUS: Record<string, string> = {
  draft: "submitted",
  submitted: "approved",
  approved: "ordered",
  ordered: "received",
  received: "closed",
};

function FulfillmentDialog({
  purchaseRequest,
  onFulfillItem,
  isFulfilling,
}: {
  purchaseRequest: PartsRequestCardData;
  onFulfillItem?: (prId: string, itemId: string, quantity: number) => void;
  isFulfilling?: boolean;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);

  const items = purchaseRequest.items || [];
  const canFulfill = ["approved", "ordered", "received"].includes(purchaseRequest.status);

  if (!canFulfill || items.length === 0) {return null;}

  const handleFulfill = (itemId: string) => {
    const qty = quantities[itemId];
    if (qty && qty > 0 && onFulfillItem) {
      onFulfillItem(purchaseRequest.id, itemId, qty);
      setQuantities((prev) => ({ ...prev, [itemId]: 0 }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs" data-testid={`btn-fulfill-pr-${purchaseRequest.id}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Fulfill Items
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fulfill Items - {purchaseRequest.requestNumber || purchaseRequest.prNumber}</DialogTitle>
          <DialogDescription>
            Enter quantities to fulfill from inventory. Stock will be automatically decremented.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {items.map((item) => {
            const fulfilled = item.quantityFulfilled || 0;
            const remaining = item.quantity - fulfilled;
            const progress = (fulfilled / item.quantity) * 100;
            const isFulfilledComplete = item.fulfillmentStatus === "fulfilled";

            return (
              <div key={item.id} className="p-3 border rounded-lg space-y-2" data-testid={`fulfill-item-${item.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {item.partName || item.description || item.partNumber || "Unknown Part"}
                    </div>
                    {item.partNumber && <div className="text-xs text-muted-foreground">{item.partNumber}</div>}
                  </div>
                  <Badge className={FULFILLMENT_STATUS_COLORS[item.fulfillmentStatus || "pending"] || "bg-gray-100"}>
                    {item.fulfillmentStatus || "pending"}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {fulfilled} / {item.quantity} fulfilled
                    </span>
                    <span>{remaining} remaining</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {!isFulfilledComplete && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      placeholder={`Max ${remaining}`}
                      value={quantities[item.id] || ""}
                      onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                      className="h-8 w-24 text-sm"
                      data-testid={`input-fulfill-qty-${item.id}`}
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={!quantities[item.id] || quantities[item.id] <= 0 || quantities[item.id] > remaining || isFulfilling}
                      onClick={() => handleFulfill(item.id)}
                      data-testid={`btn-fulfill-item-${item.id}`}
                    >
                      {isFulfilling ? <Loader2 className="h-3 w-3 animate-spin" /> : "Fulfill"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PartsRequestCard({
  purchaseRequest,
  onDelete,
  onEdit,
  onFulfillItem,
  onUpdateStatus,
  isDeleting,
  isFulfilling,
  isUpdatingStatus,
  isReadOnly = false,
  canApprove = false,
  canEditPermission = false,
}: PartsRequestCardProps) {
  const requestNumber = purchaseRequest.requestNumber || purchaseRequest.prNumber || "PR";
  const isDraft = purchaseRequest.status === "draft";
  const isDraftOrCancelled = isDraft || purchaseRequest.status === "cancelled";
  const canDelete = isDraftOrCancelled ? canEditPermission : canApprove;
  const canEditRecord = isDraft ? canEditPermission : canApprove;
  const itemCount = purchaseRequest.itemCount || purchaseRequest.items?.length || 0;

  const fulfilledCount = purchaseRequest.items?.filter((i) => i.fulfillmentStatus === "fulfilled").length || 0;
  const hasFulfillmentProgress = purchaseRequest.items && purchaseRequest.items.length > 0;
  const nextStatus = NEXT_STATUS[purchaseRequest.status];
  const canAdvanceStatus = nextStatus && !isReadOnly && onUpdateStatus && (isDraftOrCancelled ? canEditPermission : canApprove);
  const canFulfill = !isDraftOrCancelled && canApprove;

  return (
    <div className="p-4 rounded-lg border bg-muted/30" data-testid={`pr-item-${purchaseRequest.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{requestNumber}</span>
            <Badge className={STATUS_COLORS[purchaseRequest.status] || "bg-gray-100"}>{purchaseRequest.status}</Badge>
            {hasFulfillmentProgress && purchaseRequest.status !== "draft" && (
              <span className="text-xs text-muted-foreground">
                ({fulfilledCount}/{purchaseRequest.items?.length} fulfilled)
              </span>
            )}
          </div>

          {purchaseRequest.notes && <p className="text-sm text-foreground line-clamp-2">{purchaseRequest.notes}</p>}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {itemCount > 0 && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
            )}
            {purchaseRequest.requestedBy && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {purchaseRequest.requestedBy}
              </span>
            )}
            {purchaseRequest.requiredByDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Need by {format(new Date(purchaseRequest.requiredByDate), "MMM d, yyyy")}
              </span>
            )}
            {purchaseRequest.createdAt && (
              <span>Created {formatDistanceToNow(new Date(purchaseRequest.createdAt), { addSuffix: true })}</span>
            )}
          </div>

          {!isReadOnly && (
            <div className="flex flex-wrap gap-2 pt-1">
              {canFulfill && <FulfillmentDialog purchaseRequest={purchaseRequest} onFulfillItem={onFulfillItem} isFulfilling={isFulfilling} />}
              {canAdvanceStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={isUpdatingStatus}
                  onClick={() => onUpdateStatus(purchaseRequest.id, nextStatus)}
                  data-testid={`btn-advance-status-${purchaseRequest.id}`}
                >
                  {isUpdatingStatus ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Move to {nextStatus}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isReadOnly && canEditRecord && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(purchaseRequest)}
              data-testid={`btn-edit-pr-${purchaseRequest.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {!isReadOnly && canDelete && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={isDeleting}
                  data-testid={`btn-delete-pr-${purchaseRequest.id}`}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Purchase Request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete purchase request {requestNumber}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(purchaseRequest.id)} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild data-testid={`btn-view-pr-${purchaseRequest.id}`}>
            <a href={`/purchase-requests/${purchaseRequest.id}`}>
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
