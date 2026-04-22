import { useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ShoppingCart, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PartStockStatus {
  partId: string;
  partName: string;
  partNumber: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
  isOutOfStock: boolean;
  preferredSupplier?: { id: string; name: string; leadTimeDays: number | null };
  estimatedLeadTimeDays: number;
}

interface OutOfStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partInfo: PartStockStatus | null;
  isLoading?: boolean;
  workOrderId: string;
  vesselId?: string;
  quantityNeeded?: number;
}

export function OutOfStockDialog({ open, onOpenChange, partInfo, isLoading, workOrderId, vesselId, quantityNeeded = 1 }: OutOfStockDialogProps) {
  const [, setLocation] = useLocation();
  const [isCreatingPR, setIsCreatingPR] = useState(false);

  const createPRMutation = useMutation({
    mutationFn: async () => {
      if (!partInfo) {throw new Error("Part information not loaded");}
      const response = await apiRequest("POST", "/api/purchase-requests", {
        requestedBy: "Current User",
        vesselId,
        workOrderId,
        notes: `Auto-created for work order. Part needed: ${partInfo.partNumber} - ${partInfo.partName}. Quantity: ${quantityNeeded}`,
      });
      return (response as Response).json();
    },
    onSuccess: (pr) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      onOpenChange(false);
      setLocation(`/purchasing/pr/${pr.id}`);
    },
    onError: (error) => {
      console.error("Failed to create purchase request:", error);
      setIsCreatingPR(false);
    },
  });

  const extendCompletionDateMutation = useMutation({
    mutationFn: async () => {
      if (!partInfo) {throw new Error("Part information not loaded");}
      const additionalDays = partInfo.estimatedLeadTimeDays || 14;
      const response = await apiRequest("PATCH", `/api/work-orders/${workOrderId}/extend-completion-date`, {
        additionalDays,
        reason: `Extended for pending parts delivery. Part: ${partInfo.partNumber}, estimated ${additionalDays} day lead time.`,
      });
      return (response as Response).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId] });
    },
  });

  const handleCreatePR = async () => {
    if (!partInfo) {return;}
    setIsCreatingPR(true);
    try {
      await createPRMutation.mutateAsync();
      await extendCompletionDateMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to complete purchase request flow:", error);
    } finally {
      setIsCreatingPR(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Part Out of Stock
          </DialogTitle>
          <DialogDescription>
            The selected part is currently unavailable in inventory.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading part information...</div>
        ) : !partInfo ? (
          <div className="py-8 text-center text-muted-foreground">Part information not available</div>
        ) : (
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">{partInfo.partName}</div>
              <div className="text-sm text-muted-foreground font-mono">{partInfo.partNumber}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 border rounded-lg">
              <div className="text-muted-foreground">On Hand</div>
              <div className="text-lg font-semibold">{partInfo.quantityOnHand}</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-muted-foreground">Reserved</div>
              <div className="text-lg font-semibold">{partInfo.quantityReserved}</div>
            </div>
          </div>

          {partInfo.preferredSupplier && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div className="text-sm">
                <span className="font-medium">{partInfo.preferredSupplier.name}</span>
                {partInfo.estimatedLeadTimeDays > 0 && (
                  <span className="text-muted-foreground"> - Estimated {partInfo.estimatedLeadTimeDays} day lead time</span>
                )}
              </div>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Would you like to create a purchase request for this part? The work order completion date will be extended by{" "}
            <strong>{partInfo.estimatedLeadTimeDays} days</strong> to account for delivery time.
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-pr">
              Cancel
            </Button>
            <Button
              onClick={handleCreatePR}
              disabled={isCreatingPR || createPRMutation.isPending || !partInfo}
              data-testid="button-create-pr"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isCreatingPR ? "Creating..." : "Create Purchase Request"}
            </Button>
          </DialogFooter>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
