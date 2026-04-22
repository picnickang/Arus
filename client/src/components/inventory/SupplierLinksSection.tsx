import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Star, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  useInventoryPartSuppliers,
  useUnlinkSupplier,
  useSetPreferredSupplier,
  type SupplierLink,
} from "@/features/inventory";
import { useToast } from "@/hooks/use-toast";

interface SupplierLinksSectionProps {
  inventoryItemId: string;
  onAddSupplier?: () => void;
  readOnly?: boolean;
}

export function SupplierLinksSection({
  inventoryItemId,
  onAddSupplier,
  readOnly = false,
}: SupplierLinksSectionProps) {
  const { data: links, isLoading } = useInventoryPartSuppliers(inventoryItemId);
  const unlinkMutation = useUnlinkSupplier(inventoryItemId);
  const setPreferredMutation = useSetPreferredSupplier(inventoryItemId);
  const { toast } = useToast();

  const handleUnlink = async (link: SupplierLink) => {
    try {
      await unlinkMutation.mutateAsync(link.id);
      toast({ title: "Supplier unlinked successfully" });
    } catch {
      toast({ title: "Failed to unlink supplier", variant: "destructive" });
    }
  };

  const handleSetPreferred = async (supplierId: string) => {
    try {
      await setPreferredMutation.mutateAsync(supplierId);
      toast({ title: "Preferred supplier updated" });
    } catch {
      toast({ title: "Failed to set preferred supplier", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Linked Suppliers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const sortedLinks = [...(links || [])].sort((a, b) => {
    if (a.isPreferred && !b.isPreferred) {return -1;}
    if (!a.isPreferred && b.isPreferred) {return 1;}
    return 0;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Linked Suppliers ({links?.length || 0})
          </CardTitle>
          {!readOnly && onAddSupplier && (
            <Button variant="outline" size="sm" onClick={onAddSupplier} data-testid="btn-add-supplier">
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No suppliers linked to this part
          </p>
        ) : (
          <div className="space-y-2">
            {sortedLinks.map((link) => (
              <div
                key={link.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  link.isPreferred && "bg-primary/5 border-primary/30"
                )}
                data-testid={`supplier-link-${link.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {link.supplier?.name || "Unknown Supplier"}
                    </span>
                    {link.isPreferred && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Preferred
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                    {link.supplierPartNumber && <span>PN: {link.supplierPartNumber}</span>}
                    {link.unitCost && <span>{formatCurrency(link.unitCost)}</span>}
                    {link.leadTimeDays && <span>{link.leadTimeDays} days lead</span>}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 ml-2">
                    {!link.isPreferred && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSetPreferred(link.supplierId)}
                        disabled={setPreferredMutation.isPending}
                        title="Set as preferred"
                        data-testid={`btn-set-preferred-${link.id}`}
                      >
                        {setPreferredMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Star className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleUnlink(link)}
                      disabled={unlinkMutation.isPending}
                      title="Remove supplier"
                      data-testid={`btn-unlink-${link.id}`}
                    >
                      {unlinkMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
