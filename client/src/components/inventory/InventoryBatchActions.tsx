import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MultiLinePartsRequestDialog } from "@/components/work-orders/MultiLinePartsRequestDialog";
import type { SuggestedPart } from "@/components/work-orders/MultiLinePartsRequestDialog";
import type { PartsInventoryItem } from "./VirtualizedInventoryTable";

interface InventoryBatchActionsProps {
  selectedItems: Set<string>;
  parts: PartsInventoryItem[];
  onClearSelection: () => void;
  className?: string;
}

export function InventoryBatchActions({
  selectedItems,
  parts,
  onClearSelection,
  className,
}: InventoryBatchActionsProps) {
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedParts = parts.filter((p) => selectedItems.has(p.id));
  const count = selectedItems.size;

  if (count === 0) return null;

  const suggestions: SuggestedPart[] = selectedParts.map((part) => {
    const available = part.stock
      ? Math.max(0, part.stock.quantityOnHand - part.stock.quantityReserved)
      : 0;
    const quantityOnHand = part.stock?.quantityOnHand ?? 0;
    const suggestedOrderQuantity = Math.max(1, part.maxStockLevel - available);

    return {
      partId: part.id,
      partNo: part.partNumber,
      partName: part.partName,
      quantityNeeded: part.maxStockLevel,
      quantityOnHand,
      shortfall: Math.max(0, part.minStockLevel - available),
      suggestedOrderQuantity,
    };
  });

  const createPRMutation = useMutation({
    mutationFn: async (data: { notes?: string; items: Array<{ partId?: string; description: string; quantity: number; notes?: string; supplierId?: string }> }) => {
      const pr = await apiRequest("POST", "/api/purchase-requests", {
        requestedBy: "Batch Reorder",
        notes: data.notes || `Batch reorder for ${data.items.length} parts`,
      });

      for (const item of data.items) {
        await apiRequest("POST", `/api/purchase-requests/${pr.id}/items`, {
          partId: item.partId,
          quantity: item.quantity,
          uom: "ea",
          remarks: item.notes || item.description,
          supplierId: item.supplierId,
        });
      }

      return pr;
    },
    onSuccess: (pr) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Purchase Request Created",
        description: `PR #${pr.prNumber || pr.id} created with ${selectedParts.length} items. View in Purchasing tab.`,
      });
      setPrDialogOpen(false);
      onClearSelection();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    },
  });

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
            onClick={() => setPrDialogOpen(true)}
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

      <MultiLinePartsRequestDialog
        open={prDialogOpen}
        onOpenChange={setPrDialogOpen}
        onSubmit={(data) => createPRMutation.mutate(data)}
        isPending={createPRMutation.isPending}
        suggestions={suggestions}
      />
    </>
  );
}

export default InventoryBatchActions;
