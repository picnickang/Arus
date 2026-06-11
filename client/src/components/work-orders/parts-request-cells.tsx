import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronDown, Loader2, Truck } from "lucide-react";
import { useInventoryPartSuppliers } from "@/features/inventory/hooks/useInventoryPartSuppliers";
import { cn } from "@/lib/utils";

interface ComboPart {
  id: string;
  partNumber: string;
  partName: string;
  unitCost?: number | undefined;
  quantityOnHand?: number | undefined;
}

interface PartSearchComboboxProps {
  parts: ComboPart[];
  isLoading: boolean;
  onSelect: (part: ComboPart) => void;
}

export function PartSearchCombobox({ parts, isLoading, onSelect }: PartSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const searchLower = search.toLowerCase();
  const filteredParts = parts
    .filter(
      (p) =>
        (p.partNumber?.toLowerCase() || "").includes(searchLower) ||
        (p.partName?.toLowerCase() || "").includes(searchLower)
    )
    .slice(0, 20);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex-1 justify-between"
          data-testid="btn-search-inventory"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search Inventory...
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search by part number or name..."
            value={search}
            onValueChange={setSearch}
            data-testid="input-search-inventory"
          />
          <CommandList>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
                <CommandEmpty>No parts found.</CommandEmpty>
                <CommandGroup heading="Inventory Parts">
                  {filteredParts.map((part) => (
                    <CommandItem
                      key={part.id}
                      value={`${part.partNumber} ${part.partName}`}
                      onSelect={() => {
                        onSelect(part);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="cursor-pointer"
                      data-testid={`option-part-${part.id}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{part.partNumber}</div>
                        <div className="text-xs text-muted-foreground">{part.partName}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-2",
                          part.quantityOnHand && part.quantityOnHand > 0
                            ? "bg-green-50"
                            : "bg-red-50"
                        )}
                      >
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
  rowId: string;
  inventoryItemId: string | undefined;
  isCustom: boolean;
  selectedSupplierId: string | undefined;
  onSupplierSelect: (supplierId: string) => void;
}

export function SupplierSelectCell({
  rowId,
  inventoryItemId,
  isCustom,
  selectedSupplierId,
  onSupplierSelect,
}: SupplierSelectCellProps) {
  const { data: suppliers = [], isLoading } = useInventoryPartSuppliers(inventoryItemId || "", {
    enabled: !!inventoryItemId && !isCustom,
  });

  useEffect(() => {
    if (!isCustom && suppliers.length > 0 && !selectedSupplierId) {
      const preferredSupplier = suppliers.find((s) => s.isPreferred);
      const defaultSupplierId = preferredSupplier?.supplierId || suppliers[0]?.supplierId;
      if (defaultSupplierId) {
        onSupplierSelect(defaultSupplierId);
      }
    }
  }, [suppliers, isCustom, selectedSupplierId, onSupplierSelect]);

  if (isCustom) {
    return (
      <Badge variant="outline" className="text-xs">
        Manual
      </Badge>
    );
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
    <Select value={selectedSupplierId || ""} onValueChange={onSupplierSelect}>
      <SelectTrigger className="h-8 text-xs" data-testid={`select-supplier-${rowId}`}>
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
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  Preferred
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
