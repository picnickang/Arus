/**
 * Inventory Batch Actions Bar
 *
 * UX FIX #7: Floating action bar that appears when inventory items are selected.
 * Enables:
 *   - Create multi-line PR from selected parts
 *   - Export selected parts to CSV
 *   - Mark selected parts inactive
 *
 * Renders as a sticky bar at the bottom of the inventory table.
 *
 * Usage:
 *   <InventoryBatchActions
 *     selectedItems={selectedItems}
 *     parts={allParts}
 *     onClearSelection={() => setSelectedItems(new Set())}
 *     onBatchReorder={handleBatchReorder}
 *   />
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Download, X, Loader2, Package, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface InventoryPart {
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
}

interface BatchReorderItem {
  partId: string;
  partNumber: string;
  partName: string;
  quantity: number;
  suggestedQty: number;
  unitCost: number;
  currentStock: number;
  maxStock: number;
  supplierName?: string;
}

interface InventoryBatchActionsProps {
  selectedItems: Set<string>;
  parts: InventoryPart[];
  onClearSelection: () => void;
  className?: string;
}

export function InventoryBatchActions({
  selectedItems,
  parts,
  onClearSelection,
  className,
}: InventoryBatchActionsProps) {
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [reorderItems, setReorderItems] = useState<BatchReorderItem[]>([]);
  const { toast } = useToast();

  const selectedParts = parts.filter((p) => selectedItems.has(p.id));
  const count = selectedItems.size;

  if (count === 0) return null;

  const handleOpenReorder = () => {
    const items: BatchReorderItem[] = selectedParts.map((part) => {
      const currentStock = part.stock?.quantityOnHand ?? 0;
      const maxStock = part.maxStockLevel ?? 100;
      const suggestedQty = Math.max(1, maxStock - currentStock);

      return {
        partId: part.id,
        partNumber: part.partNumber || "N/A",
        partName: part.partName || "Unknown",
        quantity: suggestedQty,
        suggestedQty,
        unitCost: part.standardCost ?? 0,
        currentStock,
        maxStock,
        supplierName: part.supplierName,
      };
    });

    setReorderItems(items);
    setReorderDialogOpen(true);
  };

  const handleExportSelected = () => {
    const headers = ["Part Number", "Part Name", "Category", "Current Stock", "Min Stock", "Max Stock", "Unit Cost", "Supplier"];
    const rows = selectedParts.map((p) => [
      p.partNumber || "",
      p.partName || "",
      p.category || "",
      String(p.stock?.quantityOnHand ?? 0),
      String(p.minStockLevel ?? 0),
      String(p.maxStockLevel ?? 0),
      String(p.standardCost ?? 0),
      p.supplierName || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exported", description: `${count} parts exported to CSV` });
  };

  return (
    <>
      {/* Floating action bar */}
      <div
        className={cn(
          "fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto",
          "z-30 flex items-center gap-3 px-4 py-3 rounded-xl",
          "bg-primary text-primary-foreground shadow-2xl",
          "animate-in slide-in-from-bottom duration-200",
          className
        )}
        data-testid="batch-actions-bar"
      >
        <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground text-sm">
          {count} selected
        </Badge>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenReorder}
            className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
            data-testid="button-batch-create-pr"
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Create PR
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportSelected}
            className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
            data-testid="button-batch-export"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 ml-auto"
          data-testid="btn-clear-selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Batch reorder dialog */}
      <BatchReorderDialog
        open={reorderDialogOpen}
        onOpenChange={setReorderDialogOpen}
        items={reorderItems}
        setItems={setReorderItems}
        onSuccess={() => {
          setReorderDialogOpen(false);
          onClearSelection();
        }}
      />
    </>
  );
}

// ============================================================================
// Batch reorder dialog
// ============================================================================

function BatchReorderDialog({
  open,
  onOpenChange,
  items,
  setItems,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BatchReorderItem[];
  setItems: (items: BatchReorderItem[]) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();

  const totalCost = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  const updateQuantity = (partId: string, qty: number) => {
    setItems(items.map((i) => (i.partId === partId ? { ...i, quantity: Math.max(1, qty) } : i)));
  };

  const removeItem = (partId: string) => {
    setItems(items.filter((i) => i.partId !== partId));
  };

  const createBatchPR = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/purchase-requests", {
        requestedBy: "Batch Reorder",
        notes: `Batch reorder for ${items.length} parts`,
        items: items.map((item) => ({
          partId: item.partId,
          quantity: item.quantity,
          remarks: `Reorder: current ${item.currentStock}, target ${item.maxStock}`,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Purchase Request Created",
        description: `PR with ${items.length} line items created successfully.`,
      });
      onSuccess();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: String(err),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Batch Purchase Request — {items.length} parts
          </DialogTitle>
          <DialogDescription>
            Review quantities and create a multi-line purchase request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.partId}
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
              data-testid={`batch-item-${item.partId}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.partName}</div>
                <div className="text-xs text-muted-foreground">
                  {item.partNumber}
                  {item.supplierName && ` · ${item.supplierName}`}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Stock: {item.currentStock} → {item.currentStock + item.quantity}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.partId, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.partId, parseInt(e.target.value, 10) || 1)}
                  className="w-16 h-7 text-center text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.partId, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="text-right min-w-[70px]">
                <div className="text-sm font-medium">${(item.quantity * item.unitCost).toFixed(2)}</div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => removeItem(item.partId)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No items in order</p>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="text-sm text-muted-foreground">
              {totalItems} items across {items.length} parts
            </div>
            <div className="text-lg font-semibold">Total: ${totalCost.toFixed(2)}</div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createBatchPR.mutate()}
            disabled={createBatchPR.isPending || items.length === 0}
            data-testid="btn-create-batch-pr"
          >
            {createBatchPR.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create Purchase Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InventoryBatchActions;
