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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Trash2, Loader2, Package, AlertTriangle } from "lucide-react";
import { useParts } from "@/features/inventory/hooks/useInventory";
import { useDiscardGuard, DiscardConfirmDialog } from "@/hooks/useDiscardGuard";
import {
  useMultiLinePartsForm,
  toPartsRequestPayload,
  type PartsRequestValues,
  type PartsRequestPayload,
  type SuggestedPart,
} from "@/features/work-orders/hooks/useMultiLinePartsForm";
import { PartSearchCombobox, SupplierSelectCell } from "./parts-request-cells";

interface InventoryPartFromAPI {
  id: string;
  partNo: string;
  name: string;
  standardCost?: number;
  quantityOnHand?: number;
}

function mapPartFields(part: InventoryPartFromAPI) {
  return {
    id: part.id,
    partNumber: part.partNo,
    partName: part.name,
    unitCost: part.standardCost,
    quantityOnHand: part.quantityOnHand,
  };
}

interface MultiLinePartsRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PartsRequestPayload) => void;
  isPending: boolean;
  suggestions?: SuggestedPart[] | undefined;
}

export function MultiLinePartsRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  suggestions = [],
}: MultiLinePartsRequestDialogProps) {
  const { data: rawParts = [], isLoading: partsLoading } = useParts();
  const inventoryParts = (rawParts as object as InventoryPartFromAPI[]).map(mapPartFields);

  const {
    form,
    fields,
    removeItem,
    addInventoryItem,
    addCustomItem,
    resetForm,
    suggestionsLoaded,
  } = useMultiLinePartsForm(open, suggestions);

  const closeWith = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };
  const guard = useDiscardGuard({ isDirty: form.formState.isDirty, onOpenChange: closeWith });

  function submit(data: PartsRequestValues) {
    onSubmit(toPartsRequestPayload(data));
  }

  const itemsError = form.formState.errors.items?.root ?? form.formState.errors.items;

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] md:w-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Purchase Request
          </DialogTitle>
          <DialogDescription>
            Add parts from inventory or enter custom items. You can add multiple items in a single
            request.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            {suggestionsLoaded && suggestions.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  {suggestions.length} out-of-stock part{suggestions.length > 1 ? "s" : ""}{" "}
                  pre-filled from work order
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <PartSearchCombobox
                parts={inventoryParts}
                isLoading={partsLoading}
                onSelect={addInventoryItem}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomItem}
                data-testid="btn-add-custom-item"
              >
                <Plus className="h-4 w-4 mr-1" />
                Custom Item
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No items added yet. Search inventory or add a custom item.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Item</TableHead>
                      <TableHead className="w-[10%]">Qty</TableHead>
                      <TableHead className="w-[10%]">Stock</TableHead>
                      <TableHead className="w-[25%]">Supplier</TableHead>
                      <TableHead className="w-[20%]">Notes</TableHead>
                      <TableHead className="w-[5%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((row, index) => {
                      const item = form.watch(`items.${index}`);
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            {item.isCustom ? (
                              <FormField
                                control={form.control}
                                name={`items.${index}.description`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        placeholder="Enter part description..."
                                        data-testid={`input-item-desc-${item.rowId}`}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            ) : (
                              <div>
                                <div className="font-medium text-sm">{item.partNumber}</div>
                                <div className="text-xs text-muted-foreground">{item.partName}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      className="w-20"
                                      data-testid={`input-item-qty-${item.rowId}`}
                                      value={field.value}
                                      onChange={(e) =>
                                        field.onChange(Number.parseInt(e.target.value) || 0)
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            {item.isCustom ? (
                              <Badge variant="outline">Custom</Badge>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge
                                  className={
                                    item.quantityOnHand && item.quantityOnHand > 0
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }
                                >
                                  {item.quantityOnHand ?? 0}
                                </Badge>
                                {item.quantityOnHand !== undefined &&
                                  item.quantity > item.quantityOnHand && (
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <SupplierSelectCell
                              rowId={item.rowId}
                              inventoryItemId={item.inventoryItemId}
                              isCustom={item.isCustom}
                              selectedSupplierId={item.selectedSupplierId}
                              onSupplierSelect={(supplierId) =>
                                form.setValue(`items.${index}.selectedSupplierId`, supplierId, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.notes`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder="Notes..."
                                      className="text-sm"
                                      data-testid={`input-item-notes-${item.rowId}`}
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              data-testid={`btn-remove-item-${item.rowId}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {itemsError?.message && (
              <p className="text-sm font-medium text-destructive">{itemsError.message}</p>
            )}

            <FormField
              control={form.control}
              name="globalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes for this purchase request..."
                      rows={2}
                      data-testid="input-pr-global-notes"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <div className="flex-1 text-sm text-muted-foreground">
                {fields.length} item{fields.length !== 1 ? "s" : ""} added
              </div>
              <Button type="button" variant="outline" onClick={() => guard.handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="btn-submit-pr">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Purchase Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      <DiscardConfirmDialog
        open={guard.confirmOpen}
        onConfirm={guard.onConfirm}
        onCancel={guard.onCancel}
      />
    </Dialog>
  );
}

export default MultiLinePartsRequestDialog;
