import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Package, Search, ChevronDown, AlertTriangle, Truck } from "lucide-react";
import { useParts } from "@/features/inventory/hooks/useInventory";
import { useInventoryPartSuppliers, type SupplierLink } from "@/features/inventory/hooks/useInventoryPartSuppliers";
import { cn } from "@/lib/utils";

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

interface PartItem {
  id: string;
  inventoryItemId?: string;
  partNumber?: string;
  partName?: string;
  description: string;
  quantity: number;
  notes: string;
  unitCost?: number;
  quantityOnHand?: number;
  isCustom: boolean;
  selectedSupplierId?: string;
  availableSuppliers?: SupplierLink[];
}

export interface SuggestedPart {
  partId: string;
  partNo: string;
  partName: string;
  quantityNeeded: number;
  quantityOnHand: number;
  shortfall: number;
  suggestedOrderQuantity: number;
}

interface MultiLinePartsRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { notes?: string; items: Array<{ partId?: string; description: string; quantity: number; notes?: string; supplierId?: string }> }) => void;
  isPending: boolean;
  suggestions?: SuggestedPart[];
}

export function MultiLinePartsRequestDialog({ open, onOpenChange, onSubmit, isPending, suggestions = [] }: MultiLinePartsRequestDialogProps) {
  const [items, setItems] = useState<PartItem[]>([]);
  const [globalNotes, setGlobalNotes] = useState("");
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const { data: rawParts = [], isLoading: partsLoading } = useParts();
  const inventoryParts = (rawParts as unknown as InventoryPartFromAPI[]).map(mapPartFields);

  const generateId = () => `item-${Date.now()}-${crypto.randomUUID().slice(0, 7)}`;

  const loadSuggestions = useCallback(() => {
    if (suggestions.length > 0 && !suggestionsLoaded) {
      const suggestedItems: PartItem[] = suggestions.map((s) => ({
        id: generateId(),
        inventoryItemId: s.partId,
        partNumber: s.partNo,
        partName: s.partName,
        description: `${s.partNo} - ${s.partName}`,
        quantity: s.suggestedOrderQuantity,
        notes: "",
        quantityOnHand: s.quantityOnHand,
        isCustom: false,
      }));
      setItems(suggestedItems);
      setSuggestionsLoaded(true);
    }
  }, [suggestions, suggestionsLoaded]);

  const addInventoryItem = useCallback((part: { id: string; partNumber: string; partName: string; unitCost?: number; quantityOnHand?: number }) => {
    setItems(prev => [...prev, {
      id: generateId(),
      inventoryItemId: part.id,
      partNumber: part.partNumber,
      partName: part.partName,
      description: `${part.partNumber} - ${part.partName}`,
      quantity: 1,
      notes: "",
      unitCost: part.unitCost,
      quantityOnHand: part.quantityOnHand,
      isCustom: false,
    }]);
  }, []);

  const addCustomItem = useCallback(() => {
    setItems(prev => [...prev, {
      id: generateId(),
      description: "",
      quantity: 1,
      notes: "",
      isCustom: true,
    }]);
  }, []);

  const updateItem = useCallback((id: string, field: keyof PartItem, value: string | number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const resetForm = useCallback(() => {
    setItems([]);
    setGlobalNotes("");
    setSuggestionsLoaded(false);
  }, []);

  if (open && !suggestionsLoaded && suggestions.length > 0) {
    loadSuggestions();
  }

  const handleSubmit = () => {
    const validItems = items.filter(item => item.description.trim() && item.quantity > 0);
    if (validItems.length === 0) {return;}
    onSubmit({
      notes: globalNotes || undefined,
      items: validItems.map(item => ({
        partId: item.inventoryItemId,
        description: item.description,
        quantity: item.quantity,
        notes: item.notes || undefined,
        supplierId: item.selectedSupplierId || undefined,
      })),
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {resetForm();}
    onOpenChange(isOpen);
  };

  const validItemCount = items.filter(item => item.description.trim() && item.quantity > 0).length;
  const canSubmit = validItemCount > 0 && !isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Create Purchase Request</DialogTitle>
          <DialogDescription>Add parts from inventory or enter custom items. You can add multiple items in a single request.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {suggestionsLoaded && suggestions.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                {suggestions.length} out-of-stock part{suggestions.length > 1 ? "s" : ""} pre-filled from work order
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <PartSearchCombobox parts={inventoryParts} isLoading={partsLoading} onSelect={addInventoryItem} />
            <Button variant="outline" onClick={addCustomItem} data-testid="btn-add-custom-item">
              <Plus className="h-4 w-4 mr-1" />Custom Item
            </Button>
          </div>

          {items.length === 0 ? (
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
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.isCustom ? (
                          <Input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="Enter part description..." data-testid={`input-item-desc-${item.id}`} />
                        ) : (
                          <div>
                            <div className="font-medium text-sm">{item.partNumber}</div>
                            <div className="text-xs text-muted-foreground">{item.partName}</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", Number.parseInt(e.target.value) || 1)} className="w-20" data-testid={`input-item-qty-${item.id}`} />
                      </TableCell>
                      <TableCell>
                        {item.isCustom ? (
                          <Badge variant="outline">Custom</Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge className={item.quantityOnHand && item.quantityOnHand > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                              {item.quantityOnHand ?? 0}
                            </Badge>
                            {item.quantityOnHand !== undefined && item.quantity > item.quantityOnHand && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <SupplierSelectCell
                          item={item}
                          onSupplierSelect={(supplierId) => updateItem(item.id, "selectedSupplierId", supplierId)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input value={item.notes} onChange={(e) => updateItem(item.id, "notes", e.target.value)} placeholder="Notes..." className="text-sm" data-testid={`input-item-notes-${item.id}`} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} data-testid={`btn-remove-item-${item.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <Label>General Notes (Optional)</Label>
            <Textarea value={globalNotes} onChange={(e) => setGlobalNotes(e.target.value)} placeholder="Additional notes for this purchase request..." rows={2} data-testid="input-pr-global-notes" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <div className="flex-1 text-sm text-muted-foreground">{validItemCount} item{validItemCount !== 1 ? "s" : ""} ready</div>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="btn-submit-pr">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Purchase Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PartSearchComboboxProps {
  parts: Array<{ id: string; partNumber: string; partName: string; unitCost?: number; quantityOnHand?: number }>;
  isLoading: boolean;
  onSelect: (part: { id: string; partNumber: string; partName: string; unitCost?: number; quantityOnHand?: number }) => void;
}

function PartSearchCombobox({ parts, isLoading, onSelect }: PartSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const searchLower = search.toLowerCase();
  const filteredParts = parts.filter(p =>
    (p.partNumber?.toLowerCase() || "").includes(searchLower) ||
    (p.partName?.toLowerCase() || "").includes(searchLower)
  ).slice(0, 20);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex-1 justify-between" data-testid="btn-search-inventory">
          <span className="flex items-center gap-2"><Search className="h-4 w-4" />Search Inventory...</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by part number or name..." value={search} onValueChange={setSearch} data-testid="input-search-inventory" />
          <CommandList>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
                <CommandEmpty>No parts found.</CommandEmpty>
                <CommandGroup heading="Inventory Parts">
                  {filteredParts.map((part) => (
                    <CommandItem key={part.id} value={`${part.partNumber} ${part.partName}`} onSelect={() => { onSelect(part); setOpen(false); setSearch(""); }} className="cursor-pointer" data-testid={`option-part-${part.id}`}>
                      <div className="flex-1">
                        <div className="font-medium">{part.partNumber}</div>
                        <div className="text-xs text-muted-foreground">{part.partName}</div>
                      </div>
                      <Badge variant="outline" className={cn("ml-2", part.quantityOnHand && part.quantityOnHand > 0 ? "bg-green-50" : "bg-red-50")}>
                        Stock: {part.quantityOnHand ?? 0}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface SupplierSelectCellProps {
  item: PartItem;
  onSupplierSelect: (supplierId: string) => void;
}

function SupplierSelectCell({ item, onSupplierSelect }: SupplierSelectCellProps) {
  const { data: suppliers = [], isLoading } = useInventoryPartSuppliers(
    item.inventoryItemId || "",
    { enabled: !!item.inventoryItemId && !item.isCustom }
  );

  useEffect(() => {
    if (!item.isCustom && suppliers.length > 0 && !item.selectedSupplierId) {
      const preferredSupplier = suppliers.find(s => s.isPreferred);
      const defaultSupplierId = preferredSupplier?.supplierId || suppliers[0].supplierId;
      if (defaultSupplierId) {
        onSupplierSelect(defaultSupplierId);
      }
    }
  }, [suppliers, item.isCustom, item.selectedSupplierId, onSupplierSelect]);

  if (item.isCustom) {
    return <Badge variant="outline" className="text-xs">Manual</Badge>;
  }

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Truck className="h-3 w-3" />
        <span>No suppliers</span>
      </div>
    );
  }

  return (
    <Select value={item.selectedSupplierId || ""} onValueChange={onSupplierSelect}>
      <SelectTrigger className="h-8 text-xs" data-testid={`select-supplier-${item.id}`}>
        <SelectValue placeholder="Select supplier" />
      </SelectTrigger>
      <SelectContent>
        {suppliers.map((supplier) => (
          <SelectItem
            key={supplier.supplierId}
            value={supplier.supplierId}
            data-testid={`option-supplier-${supplier.supplierId}`}
          >
            <div className="flex items-center gap-2">
              <span>{supplier.supplierName}</span>
              {supplier.isPreferred && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Preferred</Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default MultiLinePartsRequestDialog;
