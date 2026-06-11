import { useState } from "react";
import { Plus, Minus, Package, Search, ShoppingCart, X, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMultiPartSelectorData } from "@/features/work-orders/hooks/useMultiPartSelectorData";
import { OutOfStockDialog } from "@/components/OutOfStockDialog";
import { useQuery } from "@tanstack/react-query";

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

type ExistingPartUsage = {
  id?: string;
  partId: string;
  partName?: string | null;
  partNumber?: string | null;
  quantity?: number;
  quantityUsed?: number;
  unitCost?: number;
  totalCost?: number;
  usedBy?: string | null;
};

function getExistingPartId(part: ExistingPartUsage): string {
  return part.id ?? part.partId;
}

function getExistingPartQuantity(part: ExistingPartUsage): number {
  return part.quantityUsed ?? part.quantity ?? 0;
}

interface MultiPartSelectorProps {
  workOrderId: string;
  vesselId?: string;
  onPartsAdded?: () => void;
}

export function MultiPartSelector({ workOrderId, vesselId, onPartsAdded }: MultiPartSelectorProps) {
  const [outOfStockDialogOpen, setOutOfStockDialogOpen] = useState(false);
  const [selectedOutOfStockPartId, setSelectedOutOfStockPartId] = useState<string | null>(null);

  const {
    searchTerm,
    setSearchTerm,
    selectedParts,
    usedBy,
    setUsedBy,
    isLoading,
    engineers,
    existingParts,
    filteredParts,
    hasStockWarnings,
    addPartsMutation,
    removePartMutation,
    addPartToSelection,
    incrementPartQuantity,
    decrementPartQuantity,
    updatePartQuantity,
    updatePartNotes,
    removePartFromSelection,
    getTotalCost,
    getStockStatus,
    getStockWarning,
    clearSelection,
  } = useMultiPartSelectorData(workOrderId, onPartsAdded);

  const { data: outOfStockPartInfo, isLoading: isLoadingStockStatus } = useQuery<PartStockStatus>({
    queryKey: [`/api/parts/${selectedOutOfStockPartId}/stock-status`],
    enabled: !!selectedOutOfStockPartId && outOfStockDialogOpen,
  });

  const handleAddPart = (part: (typeof filteredParts)[0]) => {
    const isOutOfStock = !part.stock || part.stock.availableQuantity === 0;
    if (isOutOfStock) {
      setSelectedOutOfStockPartId(part.id);
      setOutOfStockDialogOpen(true);
    } else {
      addPartToSelection(part);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Available Parts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parts by number or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-parts"
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading parts...
                    </TableCell>
                  </TableRow>
                ) : filteredParts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No parts found matching your search" : "No parts available"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParts.map((part) => {
                    const stockStatus = getStockStatus(part);
                    return (
                      <TableRow key={part.id}>
                        <TableCell className="font-mono text-sm">{part.partNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{part.partName}</div>
                            {part.description && (
                              <div className="text-sm text-muted-foreground">
                                {part.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={`${stockStatus.color} text-white`}>
                              {part.stock?.availableQuantity ?? 0}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {stockStatus.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          ${(part.stock?.unitCost || part.standardCost || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {part.stock?.location || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleAddPart(part)}
                            data-testid={`button-add-part-${part.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedParts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Selected Parts ({selectedParts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Technician / Engineer</label>
              <Select value={usedBy} onValueChange={setUsedBy}>
                <SelectTrigger data-testid="select-technician">
                  <SelectValue placeholder="Select technician..." />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map((engineer) => (
                    <SelectItem
                      key={engineer.id}
                      value={engineer.name}
                      data-testid={`option-engineer-${engineer.id}`}
                    >
                      {engineer.name} {engineer.rank ? `- ${engineer.rank}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-3">
              {selectedParts.map((part) => {
                const warning = getStockWarning(part);
                return (
                  <div key={part.partId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{part.partNumber}</div>
                        <div className="text-sm text-muted-foreground">{part.partName}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removePartFromSelection(part.partId)}
                        data-testid={`button-remove-part-${part.partId}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Quantity (Available: {part.availableStock})
                        </label>
                        <div className="flex items-center gap-1 mt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => decrementPartQuantity(part.partId)}
                            disabled={part.quantity <= 1}
                            data-testid={`button-decrement-${part.partId}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) =>
                              updatePartQuantity(part.partId, Number.parseInt(e.target.value) || 1)
                            }
                            className={`w-16 text-center ${warning?.severity === "error" ? "border-red-500" : ""}`}
                            data-testid={`input-quantity-${part.partId}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => incrementPartQuantity(part.partId)}
                            data-testid={`button-increment-${part.partId}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {warning && (
                          <div
                            className={`flex items-center gap-1 mt-1 text-xs ${warning.severity === "error" ? "text-red-600" : "text-yellow-600"}`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {warning.message}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Unit Cost</label>
                        <div className="text-sm py-2">${part.unitCost.toFixed(2)}</div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Total</label>
                        <div className="text-sm py-2 font-medium">${part.totalCost.toFixed(2)}</div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Notes (Optional)</label>
                      <Input
                        placeholder="Installation notes..."
                        value={part.notes || ""}
                        onChange={(e) => updatePartNotes(part.partId, e.target.value)}
                        data-testid={`input-notes-${part.partId}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator />
            {hasStockWarnings && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  Some parts exceed available stock. You can still proceed, but inventory may show
                  negative values.
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Total Cost: ${getTotalCost().toFixed(2)}</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearSelection}
                  data-testid="button-clear-selection"
                >
                  Clear All
                </Button>
                <Button
                  onClick={() => addPartsMutation.mutate(selectedParts)}
                  disabled={
                    addPartsMutation.isPending || selectedParts.length === 0 || !usedBy.trim()
                  }
                  variant={hasStockWarnings ? "destructive" : "default"}
                  data-testid="button-add-parts"
                >
                  {addPartsMutation.isPending
                    ? "Adding..."
                    : hasStockWarnings
                      ? `Add Anyway (${selectedParts.length})`
                      : `Add ${selectedParts.length} Part${selectedParts.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(existingParts as ExistingPartUsage[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Parts Already Used ({(existingParts as ExistingPartUsage[]).length})</span>
              <span className="text-sm font-normal text-muted-foreground">
                Total: $
                {(existingParts as ExistingPartUsage[])
                  .reduce((sum: number, p: ExistingPartUsage) => sum + (p.totalCost || 0), 0)
                  .toFixed(2)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(existingParts as ExistingPartUsage[]).map((part) => (
                <div
                  key={getExistingPartId(part)}
                  className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-muted/30"
                  data-testid={`existing-part-${getExistingPartId(part)}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {part.partName || part.partNumber || part.partId}
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-1">
                      <span className="inline-flex items-center">
                        Qty: <strong className="ml-1">{getExistingPartQuantity(part)}</strong>
                      </span>
                      <span>•</span>
                      <span>${(part.unitCost || 0).toFixed(2)} each</span>
                      <span>•</span>
                      <span>by {part.usedBy || "Unknown"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold">${(part.totalCost || 0).toFixed(2)}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removePartMutation.mutate(getExistingPartId(part))}
                      disabled={removePartMutation.isPending}
                      data-testid={`button-remove-existing-part-${getExistingPartId(part)}`}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <OutOfStockDialog
        open={outOfStockDialogOpen}
        onOpenChange={(open) => {
          setOutOfStockDialogOpen(open);
          if (!open) {
            setSelectedOutOfStockPartId(null);
          }
        }}
        partInfo={outOfStockPartInfo || null}
        isLoading={isLoadingStockStatus}
        workOrderId={workOrderId}
        vesselId={vesselId}
      />
    </div>
  );
}
