/**
 * Quick Reorder Button
 *
 * UX FIX #4: One-tap reorder for critical/low-stock parts.
 * Pre-fills a purchase request with:
 *   - Same supplier as the part's primary supplier
 *   - Quantity = maxStockLevel - currentStock (or reorder quantity)
 *   - Same unit cost as the part's standard cost
 *
 * Eliminates the 6-step manual PR creation workflow.
 *
 * Usage:
 *   <QuickReorderButton part={part} onReorderCreated={() => refetch()} />
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useCreatePR, useAddPRItem } from "@/features/purchaseRequests/hooks/usePurchaseRequests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Loader2, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface PartForReorder {
  id: string;
  partNumber?: string;
  partName?: string;
  category?: string;
  standardCost?: number;
  supplierId?: string;
  supplierName?: string;
  stock?: {
    quantityOnHand?: number;
    quantityReserved?: number;
  } | null;
  minStockLevel?: number;
  maxStockLevel?: number;
  leadTimeDays?: number;
}

interface QuickReorderButtonProps {
  part: PartForReorder;
  onReorderCreated?: () => void;
  variant?: "icon" | "button" | "compact";
  className?: string;
}

export function QuickReorderButton({
  part,
  onReorderCreated,
  variant = "icon",
  className,
}: QuickReorderButtonProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState<number>(0);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createPR = useCreatePR();
  const addPRItem = useAddPRItem();

  const quantityOnHand = part.stock?.quantityOnHand ?? 0;
  const quantityReserved = part.stock?.quantityReserved ?? 0;
  const availableQuantity = Math.max(0, quantityOnHand - quantityReserved);
  const currentStock = quantityOnHand;
  const maxStock = part.maxStockLevel ?? 100;
  const suggestedQty = Math.max(1, maxStock - availableQuantity);

  const isPending = createPR.isPending || addPRItem.isPending;

  const handleCreatePR = async (data: {
    partId: string;
    quantity: number;
    supplierId?: string;
    notes: string;
  }) => {
    try {
      const pr = await createPR.mutateAsync({
        requestedBy: "Quick Reorder",
        notes: data.notes,
      });
      await addPRItem.mutateAsync({
        prId: pr.id,
        partId: data.partId,
        quantity: data.quantity,
        supplierId: data.supplierId,
        uom: "ea",
        remarks: `Quick reorder: ${part.partName || part.partNumber}`,
      });
      toast({
        title: "Purchase Request Created",
        description: `PR #${pr.prNumber || pr.id} for ${quantity}x ${part.partName || part.partNumber}.`,
        action: (
          <ToastAction
            altText="View Purchase Request"
            onClick={() => navigate(`/purchase-requests/${pr.id}`)}
            data-testid="toast-link-pr"
          >
            View PR
          </ToastAction>
        ),
      });
      setOpen(false);
      onReorderCreated?.();
    } catch (err) {
      toast({
        title: "Reorder Failed",
        description: String(err),
        variant: "destructive",
      });
    }
  };

  const handleOpen = () => {
    setQuantity(suggestedQty);
    setOpen(true);
  };

  const handleReorder = () => {
    if (quantity <= 0) return;
    handleCreatePR({
      partId: part.id,
      quantity,
      supplierId: part.supplierId || undefined,
      notes: `Quick reorder for ${part.partName || part.partNumber}. Available: ${availableQuantity}, target: ${maxStock}.`,
    });
  };

  // Render variants
  if (variant === "icon") {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className={className}
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          title="Quick reorder"
          data-testid={`button-reorder-${part.id}`}
        >
          <ShoppingCart className="h-4 w-4" />
        </Button>
        <ReorderDialog
          open={open}
          onOpenChange={setOpen}
          part={part}
          quantity={quantity}
          setQuantity={setQuantity}
          suggestedQty={suggestedQty}
          currentStock={currentStock}
          maxStock={maxStock}
          onConfirm={handleReorder}
          isPending={isPending}
        />
      </>
    );
  }

  if (variant === "compact") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className={className}
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          data-testid={`button-reorder-${part.id}`}
        >
          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
          Reorder
        </Button>
        <ReorderDialog
          open={open}
          onOpenChange={setOpen}
          part={part}
          quantity={quantity}
          setQuantity={setQuantity}
          suggestedQty={suggestedQty}
          currentStock={currentStock}
          maxStock={maxStock}
          onConfirm={handleReorder}
          isPending={isPending}
        />
      </>
    );
  }

  return (
    <>
      <Button
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        data-testid={`button-reorder-${part.id}`}
      >
        <ShoppingCart className="h-4 w-4 mr-2" />
        Quick Reorder
      </Button>
      <ReorderDialog
        open={open}
        onOpenChange={setOpen}
        part={part}
        quantity={quantity}
        setQuantity={setQuantity}
        suggestedQty={suggestedQty}
        currentStock={currentStock}
        maxStock={maxStock}
        onConfirm={handleReorder}
        isPending={isPending}
      />
    </>
  );
}

// ============================================================================
// Reorder confirmation dialog
// ============================================================================

function ReorderDialog({
  open,
  onOpenChange,
  part,
  quantity,
  setQuantity,
  suggestedQty,
  currentStock,
  maxStock,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: PartForReorder;
  quantity: number;
  setQuantity: (qty: number) => void;
  suggestedQty: number;
  currentStock: number;
  maxStock: number;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const unitCost = part.standardCost ?? 0;
  const totalCost = quantity * unitCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Quick Reorder
          </DialogTitle>
          <DialogDescription>
            Create a purchase request for {part.partName || part.partNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Part summary */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{part.partName || part.partNumber}</span>
              {part.category && (
                <Badge variant="outline" className="text-xs">
                  {part.category}
                </Badge>
              )}
            </div>
            {part.supplierName && (
              <p className="text-xs text-muted-foreground">
                Supplier: {part.supplierName}
              </p>
            )}
          </div>

          {/* Stock levels */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg border">
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-lg font-bold text-destructive">{currentStock}</p>
            </div>
            <div className="p-2 rounded-lg border">
              <p className="text-xs text-muted-foreground">Ordering</p>
              <p className="text-lg font-bold text-primary">{quantity}</p>
            </div>
            <div className="p-2 rounded-lg border">
              <p className="text-xs text-muted-foreground">After</p>
              <p className="text-lg font-bold text-green-500">{currentStock + quantity}</p>
            </div>
          </div>

          {/* Quantity input */}
          <div>
            <Label>Order Quantity</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setQuantity(isNaN(n) || n < 1 ? 1 : n);
                }}
                className="flex-1"
                data-testid="input-reorder-qty"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(suggestedQty)}
                data-testid="btn-suggested-qty"
              >
                Suggested: {suggestedQty}
              </Button>
            </div>
            {currentStock + quantity > maxStock && (
              <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                This will exceed max stock level ({maxStock})
              </p>
            )}
          </div>

          {/* Cost estimate */}
          {unitCost > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <span className="text-sm text-muted-foreground">
                Estimated cost ({quantity} × ${unitCost.toFixed(2)})
              </span>
              <span className="font-semibold">${totalCost.toFixed(2)}</span>
            </div>
          )}

          {part.leadTimeDays && (
            <p className="text-xs text-muted-foreground">
              Expected lead time: ~{part.leadTimeDays} days
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="btn-cancel-reorder"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending || quantity <= 0}
            data-testid="btn-confirm-reorder"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Purchase Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickReorderButton;
