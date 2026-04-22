import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InventoryFilters {
  search: string;
  categories: string[];
  criticalities: string[];
  stockStatus: string;
  suppliers: string[];
}

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface InventoryFilterPanelProps {
  filters: InventoryFilters;
  onFiltersChange: (filters: InventoryFilters) => void;
  filterOptions: {
    categories: FilterOption[];
    suppliers: FilterOption[];
    criticalities: FilterOption[];
  };
  activeFilterCount: number;
  onClearAll: () => void;
  className?: string;
}

const STOCK_STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Status" },
  { value: "adequate", label: "Adequate" },
  { value: "low", label: "Low Stock" },
  { value: "critical", label: "Critical" },
  { value: "zero", label: "Out of Stock" },
  { value: "excess", label: "Excess" },
];

const CRITICALITY_OPTIONS: FilterOption[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function getStockStatusIcon(status: string) {
  switch (status) {
    case "critical":
    case "zero":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "low":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "adequate":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "excess":
      return <Boxes className="h-4 w-4 text-blue-500" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

export function InventoryFilterPanel({
  filters,
  onFiltersChange,
  filterOptions,
  activeFilterCount,
  onClearAll,
  className,
}: InventoryFilterPanelProps) {
  const updateFilter = useCallback(
    <K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const toggleArrayFilter = useCallback(
    (key: "categories" | "criticalities" | "suppliers", value: string) => {
      const current = filters[key];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      updateFilter(key, updated);
    },
    [filters, updateFilter]
  );

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div
      className={cn("flex flex-col h-full bg-background", className)}
      data-testid="inventory-filter-panel"
    >
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h3 className="font-semibold">Filters</h3>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-8 px-2 text-xs"
              data-testid="clear-all-filters"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parts..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-9"
            data-testid="filter-search-input"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => updateFilter("search", "")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Stock Status</Label>
            <Select
              value={filters.stockStatus}
              onValueChange={(value) => updateFilter("stockStatus", value)}
            >
              <SelectTrigger data-testid="filter-stock-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                {STOCK_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {getStockStatusIcon(option.value)}
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium py-1">
              <span>Categories</span>
              <ChevronDown className="h-4 w-4 transition-transform ui-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {filterOptions.categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No categories available</p>
                ) : (
                  filterOptions.categories.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${option.value}`}
                        checked={filters.categories.includes(option.value)}
                        onCheckedChange={() => toggleArrayFilter("categories", option.value)}
                        data-testid={`filter-category-${option.value}`}
                      />
                      <label
                        htmlFor={`category-${option.value}`}
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                      >
                        {option.label}
                      </label>
                      {option.count !== undefined && (
                        <Badge variant="secondary" className="text-xs">
                          {option.count}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium py-1">
              <span>Part Criticality</span>
              <ChevronDown className="h-4 w-4 transition-transform ui-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2">
                {CRITICALITY_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`criticality-${option.value}`}
                      checked={filters.criticalities.includes(option.value)}
                      onCheckedChange={() => toggleArrayFilter("criticalities", option.value)}
                      data-testid={`filter-criticality-${option.value}`}
                    />
                    <label
                      htmlFor={`criticality-${option.value}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium py-1">
              <span>Suppliers</span>
              <ChevronDown className="h-4 w-4 transition-transform ui-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {filterOptions.suppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No suppliers available</p>
                ) : (
                  filterOptions.suppliers.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`supplier-${option.value}`}
                        checked={filters.suppliers.includes(option.value)}
                        onCheckedChange={() => toggleArrayFilter("suppliers", option.value)}
                        data-testid={`filter-supplier-${option.value}`}
                      />
                      <label
                        htmlFor={`supplier-${option.value}`}
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer truncate"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {hasActiveFilters && (
        <div className="p-4 border-t">
          <div className="flex flex-wrap gap-1">
            {filters.categories.map((cat) => (
              <Badge key={cat} variant="secondary" className="pr-1">
                {cat}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent"
                  onClick={() => toggleArrayFilter("categories", cat)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.criticalities.map((crit) => (
              <Badge key={crit} variant="secondary" className="pr-1">
                {crit}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent"
                  onClick={() => toggleArrayFilter("criticalities", crit)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.suppliers.map((sup) => (
              <Badge key={sup} variant="secondary" className="pr-1 max-w-[150px]">
                <span className="truncate">{sup}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent flex-shrink-0"
                  onClick={() => toggleArrayFilter("suppliers", sup)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.stockStatus !== "all" && (
              <Badge variant="secondary" className="pr-1">
                {STOCK_STATUS_OPTIONS.find((o) => o.value === filters.stockStatus)?.label}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent"
                  onClick={() => updateFilter("stockStatus", "all")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryFilterPanel;
