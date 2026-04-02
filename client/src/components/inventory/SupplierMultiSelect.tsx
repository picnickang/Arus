import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSupplierPerformance, SupplierSelectOption } from "@/features/suppliers";

interface Supplier {
  id: string;
  name: string;
  code: string;
  isPreferred?: boolean;
}

interface SupplierMultiSelectProps {
  value: string[];
  preferredSupplierId?: string;
  onChange: (supplierIds: string[]) => void;
  onPreferredChange?: (supplierId: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function SupplierMultiSelect({
  value = [],
  preferredSupplierId,
  onChange,
  onPreferredChange,
  disabled = false,
  placeholder = "Select suppliers...",
  className,
}: SupplierMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    staleTime: 5 * 60 * 1000,
  });
  const { data: perfData } = useSupplierPerformance();
  const perfMap = new Map(perfData?.map((p) => [p.supplierId, p]) ?? []);

  const selectedSuppliers = suppliers.filter((s) => value.includes(s.id));

  const handleSelect = useCallback(
    (supplierId: string) => {
      const isSelected = value.includes(supplierId);
      if (isSelected) {
        const newValue = value.filter((id) => id !== supplierId);
        onChange(newValue);
        if (preferredSupplierId === supplierId) {
          onPreferredChange?.(newValue.length > 0 ? newValue[0] : undefined);
        }
      } else {
        const newValue = [...value, supplierId];
        onChange(newValue);
        if (newValue.length === 1) {
          onPreferredChange?.(supplierId);
        }
      }
    },
    [value, onChange, preferredSupplierId, onPreferredChange]
  );

  const handleSetPreferred = useCallback(
    (supplierId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onPreferredChange?.(supplierId);
    },
    [onPreferredChange]
  );

  const handleRemove = useCallback(
    (supplierId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newValue = value.filter((id) => id !== supplierId);
      onChange(newValue);
      if (preferredSupplierId === supplierId) {
        onPreferredChange?.(newValue.length > 0 ? newValue[0] : undefined);
      }
    },
    [value, onChange, preferredSupplierId, onPreferredChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className="w-full justify-between h-auto min-h-10"
            data-testid="btn-supplier-multiselect"
          >
            <span className="truncate text-muted-foreground">
              {selectedSuppliers.length > 0
                ? `${selectedSuppliers.length} supplier(s) selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search suppliers..." data-testid="input-search-suppliers" />
            <CommandList>
              <CommandEmpty>No suppliers found.</CommandEmpty>
              <CommandGroup>
                {suppliers.map((supplier) => {
                  const isSelected = value.includes(supplier.id);
                  return (
                    <CommandItem
                      key={supplier.id}
                      value={`${supplier.name} ${supplier.code}`}
                      onSelect={() => handleSelect(supplier.id)}
                      data-testid={`option-supplier-${supplier.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <SupplierSelectOption supplierId={supplier.id} name={supplier.name} code={supplier.code} performance={perfMap.get(supplier.id)} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedSuppliers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedSuppliers.map((supplier) => {
            const isPreferred = supplier.id === preferredSupplierId;
            return (
              <Badge
                key={supplier.id}
                variant={isPreferred ? "default" : "secondary"}
                className="flex items-center gap-1 pr-1"
                data-testid={`badge-supplier-${supplier.id}`}
              >
                {isPreferred && <Star className="h-3 w-3 fill-current" />}
                <span>{supplier.name}</span>
                {!isPreferred && onPreferredChange && (
                  <button
                    type="button"
                    onClick={(e) => handleSetPreferred(supplier.id, e)}
                    className="ml-1 p-0.5 hover:bg-muted rounded"
                    title="Set as preferred"
                    data-testid={`btn-set-preferred-${supplier.id}`}
                  >
                    <Star className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleRemove(supplier.id, e)}
                  className="ml-1 p-0.5 hover:bg-muted rounded"
                  title="Remove supplier"
                  data-testid={`btn-remove-supplier-${supplier.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
