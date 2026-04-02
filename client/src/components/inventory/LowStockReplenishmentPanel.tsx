import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingDown, ShoppingCart, Package, CheckCircle2, Wrench } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useSupplierPerformance, SupplierSelectOption } from "@/features/suppliers";

interface SmartReplenishmentSuggestion {
  partId: string;
  partNumber: string;
  partName: string;
  category: string;
  criticality: string;
  quantityOnHand: number;
  minStockLevel: number;
  suggestedOrderQty: number;
  supplierId?: string;
  supplierName?: string;
  leadTimeDays: number;
  estimatedCost: number;
  upcomingWOCount: number;
  upcomingWOIds: string[];
  upcomingWONumbers: (string | null)[];
  urgencyScore: number;
}

interface LowStockReplenishmentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId?: string;
  requestedBy?: string;
}

const CRITICALITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function LowStockReplenishmentPanel({
  open,
  onOpenChange,
  requestedBy = "system",
}: LowStockReplenishmentPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const { data: perfData } = useSupplierPerformance();
  const perfMap = new Map(perfData?.map((p) => [p.supplierId, p]) ?? []);

  const smartQuery = useQuery<{
    total: number;
    suggestions: SmartReplenishmentSuggestion[];
    estimatedTotalCost: number;
  }>({
    queryKey: ["/api/parts-inventory/smart-replenishment"],
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });

  const fallbackQuery = useQuery<{
    total: number;
    suggestions: SmartReplenishmentSuggestion[];
    estimatedTotalCost: number;
  }>({
    queryKey: ["/api/parts-inventory/low-stock-suggestions"],
    enabled: open && smartQuery.isError,
    staleTime: 60_000,
  });

  const data = smartQuery.data ?? fallbackQuery.data;
  const isLoading = smartQuery.isLoading || (smartQuery.isError && fallbackQuery.isLoading);

  React.useEffect(() => {
    if (data?.suggestions) {
      const criticalIds = data.suggestions
        .filter((s) => s.criticality === "critical" || s.criticality === "high" || s.upcomingWOCount > 0)
        .map((s) => s.partId);
      setSelected(new Set(criticalIds));
    }
  }, [data]);

  const createPRMutation = useMutation({
    mutationFn: async (selectedParts: SmartReplenishmentSuggestion[]) => {
      const pr = await apiRequest("POST", "/api/purchase-requests", {
        requestedBy,
        notes: `Auto-generated from smart replenishment — ${new Date().toLocaleDateString()}`,
      });

      for (const part of selectedParts) {
        const woContext = part.upcomingWOCount > 0
          ? ` | Needed for ${part.upcomingWOCount} WO(s)`
          : "";
        await apiRequest("POST", `/api/purchase-requests/${pr.id}/items`, {
          partId: part.partId,
          supplierId: part.supplierId,
          quantity: part.suggestedOrderQty,
          uom: "ea",
          remarks: `Reorder: current stock ${part.quantityOnHand}, min level ${part.minStockLevel}${woContext}`,
        });
      }

      return pr;
    },
    onSuccess: () => {
      toast({
        title: "Purchase Request created",
        description: `Draft PR created with ${selected.size} items. Review and send from the Purchasing tab.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: "Failed to create PR",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const selectedSuggestions = data?.suggestions.filter((s) => selected.has(s.partId)) ?? [];
  const selectedCost = selectedSuggestions.reduce((sum, s) => sum + s.estimatedCost, 0);

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
    else next.add(partId);
    setSelected(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-600" />
            Smart Replenishment
          </SheetTitle>
          <SheetDescription>
            Parts sorted by urgency — work order demand and criticality considered.
          </SheetDescription>
        </SheetHeader>

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
              <p className="font-medium" data-testid="text-no-suggestions">All stock levels are adequate</p>
              <p className="text-sm">No replenishment needed at this time.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-2 border-b">
                <label className="flex items-center gap-2 cursor-pointer text-sm" data-testid="checkbox-select-all">
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
                  data-testid={`card-suggestion-${s.partId}`}
                >
                  <Checkbox
                    checked={selected.has(s.partId)}
                    onCheckedChange={() => toggle(s.partId)}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`checkbox-part-${s.partId}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium truncate" data-testid={`text-part-name-${s.partId}`}>{s.partName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.partNumber}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {s.upcomingWOCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            data-testid={`badge-wo-demand-${s.partId}`}
                            title={s.upcomingWOIds.join(", ")}
                          >
                            <Wrench className="h-2.5 w-2.5 mr-0.5" />
                            {(() => {
                              const woNums = (s.upcomingWONumbers ?? []).filter(Boolean) as string[];
                              if (woNums.length === 0) return `${s.upcomingWOCount} WO${s.upcomingWOCount !== 1 ? "s" : ""}`;
                              if (woNums.length === 1) return woNums[0];
                              return `${woNums[0]} +${woNums.length - 1}`;
                            })()}
                          </Badge>
                        )}
                        <Badge className={cn("text-[10px]", CRITICALITY_COLOR[s.criticality])} data-testid={`badge-criticality-${s.partId}`}>
                          {s.criticality}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        On hand: <span className={s.quantityOnHand === 0 ? "text-destructive font-medium" : ""} data-testid={`text-stock-${s.partId}`}>{s.quantityOnHand}</span>
                        &nbsp;/ min {s.minStockLevel}
                      </span>
                      <span data-testid={`text-order-qty-${s.partId}`}>Order: <strong className="text-foreground">{s.suggestedOrderQty}</strong></span>
                      {s.supplierName && s.supplierId ? (
                        <SupplierSelectOption
                          supplierId={s.supplierId}
                          name={s.supplierName}
                          performance={perfMap.get(s.supplierId)}
                        />
                      ) : s.supplierName ? (
                        <span>{s.supplierName}</span>
                      ) : null}
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
