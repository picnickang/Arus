/**
 * LowStockReplenishmentPanel
 * Improvements #6 and #7: Surfaces low-stock parts and provides a
 * one-click "Create Purchase Request" shortcut to close the loop between
 * low-stock detection and the purchasing workflow.
 *
 * Triggered when the user clicks the "Critical/Out" or "Low Stock" stat cards
 * in the inventory management page.
 *
 * Usage:
 *   <LowStockReplenishmentPanel open={open} onOpenChange={setOpen} />
 */

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingDown, ShoppingCart, Package, CheckCircle2, Star, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useSupplierPerformance } from "@/features/suppliers";

interface ReplenishmentSuggestion {
  partId:           string;
  partNumber:       string;
  partName:         string;
  category:         string;
  criticality:      string;
  quantityOnHand:   number;
  minStockLevel:    number;
  suggestedOrderQty: number;
  supplierId?:      string;
  supplierName?:    string;
  leadTimeDays:     number;
  estimatedCost:    number;
}

interface LowStockReplenishmentPanelProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  orgId?:       string;
  requestedBy?: string;
}

const CRITICALITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  low:      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function LowStockReplenishmentPanel({
  open,
  onOpenChange,
  requestedBy = "system",
}: LowStockReplenishmentPanelProps) {
  const { toast }        = useToast();
  const queryClient      = useQueryClient();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const { data: perfData } = useSupplierPerformance();
  const perfMap = new Map(perfData?.map((p) => [p.supplierId, p]) ?? []);

  const { data, isLoading } = useQuery<{
    total: number;
    suggestions: ReplenishmentSuggestion[];
    estimatedTotalCost: number;
  }>({
    queryKey: ["/api/parts-inventory/low-stock-suggestions"],
    enabled:  open,
    staleTime: 60_000,
  });

  // Select all critical parts by default when data loads
  React.useEffect(() => {
    if (data?.suggestions) {
      const criticalIds = data.suggestions
        .filter((s) => s.criticality === "critical" || s.criticality === "high")
        .map((s) => s.partId);
      setSelected(new Set(criticalIds));
    }
  }, [data]);

  const createPRMutation = useMutation({
    mutationFn: async (selectedParts: ReplenishmentSuggestion[]) => {
      // Create a draft PR
      const pr = await apiRequest("POST", "/api/purchase-requests", {
        requestedBy,
        notes: `Auto-generated from low-stock replenishment — ${new Date().toLocaleDateString()}`,
      });

      // Add each selected part as a PR item
      for (const part of selectedParts) {
        await apiRequest("POST", `/api/purchase-requests/${pr.id}/items`, {
          partId:    part.partId,
          supplierId: part.supplierId,
          quantity:  part.suggestedOrderQty,
          uom:       "ea",
          remarks:   `Reorder: current stock ${part.quantityOnHand}, min level ${part.minStockLevel}`,
        });
      }

      return pr;
    },
    onSuccess: (pr) => {
      toast({
        title:       "Purchase Request created",
        description: `Draft PR created with ${selected.size} items. Review and send from the Purchasing tab.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title:       "Failed to create PR",
        description: err instanceof Error ? err.message : "Unknown error",
        variant:     "destructive",
      });
    },
  });

  const selectedSuggestions = data?.suggestions.filter((s) => selected.has(s.partId)) ?? [];
  const selectedCost        = selectedSuggestions.reduce((sum, s) => sum + s.estimatedCost, 0);

  const toggleAll = () => {
    if (selected.size === (data?.suggestions.length ?? 0)) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data?.suggestions.map((s) => s.partId) ?? []));
    }
  };

  const toggle = (partId: string) => {
    const next = new Set(selected);
    if (next.has(partId)) next.delete(partId);
    else                  next.add(partId);
    setSelected(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-600" />
            Low Stock — Replenishment
          </SheetTitle>
          <SheetDescription>
            Select parts to include in a new Purchase Request draft.
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : !data?.suggestions.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="font-medium">All stock levels are adequate</p>
              <p className="text-sm">No replenishment needed at this time.</p>
            </div>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center justify-between pb-2 border-b">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={selected.size === data.suggestions.length}
                    onCheckedChange={toggleAll}
                  />
                  Select all ({data.suggestions.length} parts)
                </label>
                <span className="text-xs text-muted-foreground">
                  {selected.size} selected · {formatCurrency(selectedCost)} est.
                </span>
              </div>

              {data.suggestions.map((s) => (
                <div
                  key={s.partId}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                    selected.has(s.partId)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                  onClick={() => toggle(s.partId)}
                >
                  <Checkbox
                    checked={selected.has(s.partId)}
                    onCheckedChange={() => toggle(s.partId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium truncate">{s.partName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.partNumber}</p>
                      </div>
                      <Badge className={cn("text-[10px] flex-shrink-0", CRITICALITY_COLOR[s.criticality])}>
                        {s.criticality}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        On hand: <span className={s.quantityOnHand === 0 ? "text-destructive font-medium" : ""}>{s.quantityOnHand}</span>
                        &nbsp;/ min {s.minStockLevel}
                      </span>
                      <span>Order: <strong className="text-foreground">{s.suggestedOrderQty}</strong></span>
                      {s.supplierName && s.supplierId && (() => {
                        const perf = perfMap.get(s.supplierId);
                        return (
                          <span className="flex items-center gap-1" data-testid={`supplier-option-${s.supplierId}`}>
                            {s.supplierName}
                            {perf && (
                              <>
                                <span className={cn("inline-block w-1.5 h-1.5 rounded-full", perf.performanceScore >= 80 ? "bg-emerald-500" : perf.performanceScore >= 60 ? "bg-amber-500" : "bg-red-500")} />
                                <span className="font-medium">{perf.performanceScore}</span>
                                <span>{perf.qualityRating.toFixed(1)}q</span>
                                {perf.status === "preferred" && <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />}
                                {perf.performanceScore < 60 && <AlertTriangle className="h-2.5 w-2.5 text-red-500" />}
                              </>
                            )}
                          </span>
                        );
                      })()}
                      {s.supplierName && !s.supplierId && <span>{s.supplierName}</span>}
                      <span>~{s.leadTimeDays}d lead</span>
                    </div>
                    {s.estimatedCost > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Est. {formatCurrency(s.estimatedCost)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {(data?.suggestions.length ?? 0) > 0 && (
          <div className="border-t p-4 space-y-3">
            {selected.size > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{selected.size} part{selected.size !== 1 ? "s" : ""} selected</span>
                <span className="font-medium">{formatCurrency(selectedCost)} estimated</span>
              </div>
            )}
            <Button
              className="w-full"
              disabled={selected.size === 0 || createPRMutation.isPending}
              onClick={() => createPRMutation.mutate(selectedSuggestions)}
              data-testid="button-create-reorder-pr"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {createPRMutation.isPending
                ? "Creating…"
                : `Create Purchase Request (${selected.size} item${selected.size !== 1 ? "s" : ""})`}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
