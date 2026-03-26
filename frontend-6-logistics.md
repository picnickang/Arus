# ARUS Frontend — Part 6: Logistics (Inventory, Suppliers, Purchasing)
Generated: 2026-03-26T02:38:14Z

### `client/src/pages/inventory-management.tsx` (87 lines)

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Package, DollarSign, TrendingDown, Layers, Download, AlertCircle, Filter, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import VirtualizedInventoryTable from "@/components/inventory/VirtualizedInventoryTable";
import InventoryFilterPanel from "@/components/inventory/InventoryFilterPanel";
import PartDetailDrawer from "@/components/inventory/PartDetailDrawer";
import { SupplierMultiSelect } from "@/components/inventory/SupplierMultiSelect";
import { useInventoryManagementData } from "@/features/inventory";
import { formatCurrency } from "@/lib/formatters";
import { PermissionGate } from "@/components/PermissionGate";

export default function InventoryManagement() {
  const { partsInventory, filteredParts, isLoadingInventory, stats, filterOptions, activeFilterCount, filters, setFilters, sortField, sortDirection, handleSort, handleClearFilters, isAddPartDialogOpen, isEditPartDialogOpen, editingPart, selectedPart, isDrawerOpen, setIsDrawerOpen, isFilterPanelOpen, setIsFilterPanelOpen, isMobileFilterOpen, setIsMobileFilterOpen, partForm, createPartMutation, updatePartMutation, handleAddPart, handleEditPart, handleDeletePart, handleRowClick, onSubmitPart, handleExportCSV, handlePartDialogClose, handlePartDetailEdit } = useInventoryManagementData();

  return (
    <div className="min-h-screen flex flex-col" data-testid="inventory-management-page">
      <div className="flex-none p-4 md:p-6 pb-0 md:pb-0">
        <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setIsMobileFilterOpen(true)} className="md:hidden relative" data-testid="toggle-filters-mobile"><Filter className="h-4 w-4" />{activeFilterCount > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">{activeFilterCount}</span>}</Button>
            <PermissionGate resource="inventory" action="export">
              <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv"><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            </PermissionGate>
            <PermissionGate resource="inventory" action="create">
              <Button onClick={handleAddPart} data-testid="button-add-part"><Plus className="h-4 w-4 mr-2" />Add Part</Button>
            </PermissionGate>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4">
          <Card className="bg-card" data-testid="stat-total-parts"><CardContent className="p-4 md:p-6"><div className="flex items-center justify-between"><div><p className="text-xs md:text-sm font-medium text-muted-foreground">Total Parts</p><h3 className="text-xl md:text-2xl font-bold mt-1">{stats.totalParts}</h3></div><Package className="h-8 w-8 text-muted-foreground opacity-50" /></div></CardContent></Card>
          <Card className="bg-card" data-testid="stat-total-value"><CardContent className="p-4 md:p-6"><div className="flex items-center justify-between"><div><p className="text-xs md:text-sm font-medium text-muted-foreground">Total Value</p><h3 className="text-xl md:text-2xl font-bold mt-1">{formatCurrency(stats.totalValue)}</h3></div><DollarSign className="h-8 w-8 text-green-600 dark:text-green-400 opacity-50" /></div></CardContent></Card>
          <Card className="bg-card" data-testid="stat-critical"><CardContent className="p-4 md:p-6"><div className="flex items-center justify-between"><div><p className="text-xs md:text-sm font-medium text-muted-foreground">Critical/Out</p><h3 className="text-xl md:text-2xl font-bold mt-1 text-destructive">{stats.criticalCount}</h3></div><AlertCircle className="h-8 w-8 text-destructive opacity-50" /></div></CardContent></Card>
          <Card className="bg-card" data-testid="stat-low-stock"><CardContent className="p-4 md:p-6"><div className="flex items-center justify-between"><div><p className="text-xs md:text-sm font-medium text-muted-foreground">Low Stock</p><h3 className="text-xl md:text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{stats.lowStockCount}</h3></div><TrendingDown className="h-8 w-8 text-yellow-600 dark:text-yellow-400 opacity-50" /></div></CardContent></Card>
          <Card className="bg-card" data-testid="stat-categories"><CardContent className="p-4 md:p-6"><div className="flex items-center justify-between"><div><p className="text-xs md:text-sm font-medium text-muted-foreground">Categories</p><h3 className="text-xl md:text-2xl font-bold mt-1">{stats.categories}</h3></div><Layers className="h-8 w-8 text-muted-foreground opacity-50" /></div></CardContent></Card>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 pb-4 md:pb-6 min-h-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-none pb-2">
            <div className="flex items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Parts Catalog & Stock Levels</CardTitle><CardDescription>Showing {filteredParts.length} of {partsInventory.length} parts{activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount} filters active</Badge>}</CardDescription></div>
              <Button variant="ghost" size="sm" onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} className="hidden md:flex" data-testid="toggle-filters">{isFilterPanelOpen ? <><PanelLeftClose className="h-4 w-4 mr-2" />Hide Filters</> : <><PanelLeftOpen className="h-4 w-4 mr-2" />Show Filters</>}</Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 min-h-0">
            <div className="flex h-full">
              {isFilterPanelOpen && <div className="w-64 border-r flex-none hidden md:block"><InventoryFilterPanel filters={filters} onFiltersChange={setFilters} filterOptions={filterOptions} activeFilterCount={activeFilterCount} onClearAll={handleClearFilters} className="h-full" /></div>}
              <div className="flex-1 p-4 overflow-hidden"><VirtualizedInventoryTable items={filteredParts} isLoading={isLoadingInventory} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} onRowClick={handleRowClick} onEdit={handleEditPart} onDelete={handleDeletePart} /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PartDetailDrawer part={selectedPart} open={isDrawerOpen} onOpenChange={setIsDrawerOpen} onEdit={handlePartDetailEdit} />

      <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
          <SheetHeader className="p-4 border-b"><div className="flex items-center justify-between"><SheetTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Filters</SheetTitle>{activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount} active</Badge>}</div></SheetHeader>
          <div className="h-[calc(100vh-80px)] overflow-auto"><InventoryFilterPanel filters={filters} onFiltersChange={setFilters} filterOptions={filterOptions} activeFilterCount={activeFilterCount} onClearAll={handleClearFilters} className="h-full" /></div>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background"><Button className="w-full" onClick={() => setIsMobileFilterOpen(false)} data-testid="button-apply-filters-mobile">Apply Filters ({filteredParts.length} results)</Button></div>
        </SheetContent>
      </Sheet>

      <ResponsiveDialog open={isAddPartDialogOpen || isEditPartDialogOpen} onOpenChange={handlePartDialogClose} title={editingPart ? "Edit Part" : "Add New Part"} description={editingPart ? "Update the details for this part." : "Enter the details for the new part."} footer={<div className="flex gap-2 w-full"><Button variant="outline" onClick={() => handlePartDialogClose(false)} className="flex-1" data-testid="button-cancel-part">Cancel</Button><Button type="submit" onClick={partForm.handleSubmit(onSubmitPart)} disabled={createPartMutation.isPending || updatePartMutation.isPending} className="flex-1" data-testid="button-save-part">{editingPart ? updatePartMutation.isPending ? "Updating..." : "Update Part" : createPartMutation.isPending ? "Adding..." : "Add Part"}</Button></div>}>
        <Form {...partForm}>
          <form onSubmit={partForm.handleSubmit(onSubmitPart)} className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={partForm.control} name="partNumber" render={({ field }) => <FormItem><FormLabel>Part Number *</FormLabel><FormControl><Input placeholder="P12345" {...field} data-testid="input-part-number" /></FormControl><FormMessage /></FormItem>} /><FormField control={partForm.control} name="partName" render={({ field }) => <FormItem><FormLabel>Part Name *</FormLabel><FormControl><Input placeholder="Marine engine filter" {...field} data-testid="input-part-name" /></FormControl><FormMessage /></FormItem>} /></div>
            <FormField control={partForm.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Part description..." {...field} data-testid="input-description" /></FormControl><FormMessage /></FormItem>} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><FormField control={partForm.control} name="category" render={({ field }) => <FormItem><FormLabel>Category *</FormLabel><FormControl><Select onValueChange={field.onChange} value={field.value}><SelectTrigger data-testid="select-category"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectItem value="filters">Filters</SelectItem><SelectItem value="belts">Belts</SelectItem><SelectItem value="fluids">Fluids</SelectItem><SelectItem value="electrical">Electrical</SelectItem><SelectItem value="mechanical">Mechanical</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></FormControl><FormMessage /></FormItem>} /><FormField control={partForm.control} name="unitOfMeasure" render={({ field }) => <FormItem><FormLabel>Unit of Measure</FormLabel><FormControl><Input placeholder="ea, gal, ft" {...field} data-testid="input-unit-measure" /></FormControl><FormMessage /></FormItem>} /><FormField control={partForm.control} name="criticality" render={({ field }) => <FormItem><FormLabel>Criticality</FormLabel><FormControl><Select onValueChange={field.onChange} value={field.value}><SelectTrigger data-testid="select-criticality"><SelectValue placeholder="Select criticality" /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></FormControl><FormMessage /></FormItem>} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={partForm.control} name="standardCost" render={({ field }) => <FormItem><FormLabel>Standard Cost *</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" value={field.value === 0 ? "0" : field.value || ""} onChange={(e) => { const val = e.target.value; if (val === "") { field.onChange(0); } else { const numVal = Number.parseFloat(val); field.onChange(Number.isNaN(numVal) ? 0 : numVal); } }} onBlur={field.onBlur} name={field.name} ref={field.ref} data-testid="input-standard-cost" /></FormControl><FormMessage /></FormItem>} /><FormField control={partForm.control} name="leadTimeDays" render={({ field }) => <FormItem><FormLabel>Lead Time (Days) *</FormLabel><FormControl><Input type="number" placeholder="7" value={field.value === 0 ? "0" : field.value || ""} onChange={(e) => { const val = e.target.value; if (val === "") { field.onChange(1); } else { const numVal = Number.parseInt(val); field.onChange(Number.isNaN(numVal) ? 1 : Math.max(1, numVal)); } }} onBlur={field.onBlur} name={field.name} ref={field.ref} data-testid="input-lead-time" /></FormControl><FormMessage /></FormItem>} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><FormField control={partForm.control} name="quantityOnHand" render={({ field }) => <FormItem><FormLabel>Initial Quantity</FormLabel><FormControl><Input type="number" placeholder="0" value={field.value === 0 ? "0" : field.value || ""} onChange={(e) => { const val = e.target.value; if (val === "") { field.onChange(0); } else { const numVal = Number.parseInt(val); field.onChange(Number.isNaN(numVal) ? 0 : Math.max(0, numVal)); } }} onBlur={field.onBlur} name={field.name} ref={field.ref} data-testid="input-quantity" /></FormControl><FormMessage /></FormItem>} /><FormField control={partForm.control} name="minStockLevel" render={({ field }) => <FormItem><FormLabel>Min Stock</FormLabel><FormControl><Input type="number" placeholder="1" value={field.value === 0 ? "0" : field.value || ""} onChange={(e) => { const val = e.target.value; if (val === "") { field.onChange(0); } else { const numVal = Number.parseInt(val); field.onChange(Number.isNaN(numVal) ? 0 : Math.max(0, numVal)); } }} onBlur={field.onBlur} name={field.name} ref={field.ref} data-testid="input-min-stock" /></FormControl><FormMessage /></FormItem>} /><FormField control={partForm.control} name="maxStockLevel" render={({ field }) => <FormItem><FormLabel>Max Stock</FormLabel><FormControl><Input type="number" placeholder="100" value={field.value === 0 ? "0" : field.value || ""} onChange={(e) => { const val = e.target.value; if (val === "") { field.onChange(1); } else { const numVal = Number.parseInt(val); field.onChange(Number.isNaN(numVal) ? 1 : Math.max(1, numVal)); } }} onBlur={field.onBlur} name={field.name} ref={field.ref} data-testid="input-max-stock" /></FormControl><FormMessage /></FormItem>} /><FormField control={partForm.control} name="location" render={({ field }) => <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="MAIN" {...field} data-testid="input-location" /></FormControl><FormMessage /></FormItem>} /></div>
            <FormField control={partForm.control} name="supplierIds" render={({ field }) => <FormItem><FormLabel>Suppliers</FormLabel><FormControl><SupplierMultiSelect value={field.value || []} preferredSupplierId={partForm.watch("preferredSupplierId")} onChange={field.onChange} onPreferredChange={(id) => partForm.setValue("preferredSupplierId", id)} /></FormControl><FormMessage /></FormItem>} />
          </form>
        </Form>
      </ResponsiveDialog>
    </div>
  );
}

```

### `client/src/components/inventory/InventoryFilterPanel.tsx` (367 lines)

```tsx
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
    <div className={cn("flex flex-col h-full bg-background", className)} data-testid="inventory-filter-panel">
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
                    <div
                      key={option.value}
                      className="flex items-center space-x-2"
                    >
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
                  <div
                    key={option.value}
                    className="flex items-center space-x-2"
                  >
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
                    <div
                      key={option.value}
                      className="flex items-center space-x-2"
                    >
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

```

### `client/src/components/inventory/PartDetailDrawer.tsx` (388 lines)

```tsx
import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  Edit2,
  Clipboard,
  AlertTriangle,
  Clock,
  DollarSign,
  MapPin,
  Truck,
  BarChart3,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { PartsInventoryItem } from "./VirtualizedInventoryTable";
import { SupplierLinksSection } from "./SupplierLinksSection";

interface PartDetailDrawerProps {
  part: PartsInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (part: PartsInventoryItem) => void;
  onAddToWorkOrder?: (part: PartsInventoryItem) => void;
}

function getStockStatus(part: PartsInventoryItem): {
  status: string;
  label: string;
  color: string;
  icon: typeof CheckCircle;
} {
  if (!part.stock) {
    return { status: "unknown", label: "No Stock Data", color: "text-muted-foreground", icon: Package };
  }

  const { quantityOnHand, quantityReserved } = part.stock;
  const available = Math.max(0, quantityOnHand - quantityReserved);
  const minStock = part.minStockLevel;
  const maxStock = part.maxStockLevel;

  if (quantityOnHand <= 0) {
    return { status: "out_of_stock", label: "Out of Stock", color: "text-destructive", icon: XCircle };
  }

  if (available <= 0 || available < minStock * 0.5) {
    return { status: "critical", label: "Critical", color: "text-destructive", icon: AlertTriangle };
  }

  if (available < minStock) {
    return { status: "low_stock", label: "Low Stock", color: "text-yellow-600", icon: AlertTriangle };
  }

  if (available > maxStock) {
    return { status: "excess", label: "Excess Stock", color: "text-blue-600", icon: TrendingUp };
  }
  return { status: "adequate", label: "Adequate", color: "text-green-600", icon: CheckCircle };
}

function formatCurrencyDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined) {return "-";}
  return formatCurrency(value);
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: typeof Package;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  "text-xs",
                  trend === "up" && "text-green-600",
                  trend === "down" && "text-red-600"
                )}
              >
                {trend === "up" ? <TrendingUp className="h-4 w-4" /> : null}
                {trend === "down" ? <TrendingDown className="h-4 w-4" /> : null}
                {trend === "neutral" ? <Minus className="h-4 w-4 text-muted-foreground" /> : null}
              </span>
            )}
            {Icon && <Icon className="h-8 w-8 text-muted-foreground opacity-50" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PartDetailDrawer({
  part,
  open,
  onOpenChange,
  onEdit,
  onAddToWorkOrder,
}: PartDetailDrawerProps) {
  const statusInfo = useMemo(() => (part ? getStockStatus(part) : null), [part]);

  const available = useMemo(() => {
    if (!part?.stock) {return 0;}
    return Math.max(0, part.stock.quantityOnHand - part.stock.quantityReserved);
  }, [part]);

  const totalValue = useMemo(() => {
    if (!part?.stock) {return 0;}
    const unitCost = part.stock.unitCost ?? part.standardCost ?? 0;
    return unitCost * part.stock.quantityOnHand;
  }, [part]);

  const reorderNeeded = useMemo(() => {
    if (!part) {return false;}
    return available < part.minStockLevel;
  }, [part, available]);

  if (!part) {return null;}

  const StatusIcon = statusInfo?.icon ?? Package;
  const unitCost = part.stock?.unitCost ?? part.standardCost ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="part-detail-drawer">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-bold truncate pr-8">
                {part.partName}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                  {part.partNumber}
                </code>
                <Badge variant="outline">{part.category}</Badge>
                {part.criticality && (
                  <Badge
                    variant={part.criticality === "critical" ? "destructive" : "secondary"}
                  >
                    {part.criticality}
                  </Badge>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            statusInfo?.status === "critical" || statusInfo?.status === "out_of_stock"
              ? "bg-destructive/10 border-destructive/20"
              : statusInfo?.status === "low_stock"
              ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
              : statusInfo?.status === "excess"
              ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
              : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
          )}>
            <StatusIcon className={cn("h-5 w-5", statusInfo?.color)} />
            <div className="flex-1">
              <p className={cn("font-medium", statusInfo?.color)}>
                {statusInfo?.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {available} units available of {part.stock?.quantityOnHand ?? 0} on hand
              </p>
            </div>
            {reorderNeeded && (
              <Badge variant="destructive">Reorder Needed</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Available"
              value={available}
              subtitle={`${part.stock?.quantityReserved ?? 0} reserved`}
              icon={Package}
            />
            <StatCard
              title="Unit Cost"
              value={formatCurrencyDisplay(unitCost)}
              icon={DollarSign}
            />
            <StatCard
              title="Total Value"
              value={formatCurrencyDisplay(totalValue)}
              subtitle={`${part.stock?.quantityOnHand ?? 0} units`}
              icon={BarChart3}
            />
            <StatCard
              title="Lead Time"
              value={`${part.leadTimeDays ?? 7} days`}
              icon={Clock}
            />
          </div>

          <div className="flex gap-2">
            {onEdit && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onEdit(part)}
                data-testid="btn-edit-part"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Part
              </Button>
            )}
            {onAddToWorkOrder && (
              <Button
                className="flex-1"
                onClick={() => onAddToWorkOrder(part)}
                disabled={available <= 0}
                data-testid="btn-add-to-work-order"
              >
                <Clipboard className="h-4 w-4 mr-2" />
                Add to Work Order
              </Button>
            )}
          </div>

          <Separator />

          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="stock">Stock Levels</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Part Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Part Number</span>
                    <span className="font-mono">{part.partNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span>{part.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit of Measure</span>
                    <span>{part.unitOfMeasure ?? "ea"}</span>
                  </div>
                  {part.description && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground mb-1">Description</p>
                      <p className="text-sm">{part.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Default Supplier
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supplier</span>
                    <span>{part.supplierName ?? "Not specified"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead Time</span>
                    <span>{part.leadTimeDays ?? 7} days</span>
                  </div>
                </CardContent>
              </Card>

              {part.id && (
                <SupplierLinksSection inventoryItemId={part.id} />
              )}
            </TabsContent>

            <TabsContent value="stock" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Stock by Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{part.stock?.location ?? "MAIN"}</p>
                        <p className="text-sm text-muted-foreground">Primary Location</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{part.stock?.quantityOnHand ?? 0}</p>
                        <p className="text-xs text-muted-foreground">
                          {part.stock?.quantityReserved ?? 0} reserved
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Reorder Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Minimum Stock Level</span>
                    <span className={cn(available < part.minStockLevel && "text-destructive font-medium")}>
                      {part.minStockLevel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Maximum Stock Level</span>
                    <span className={cn(
                      part.stock && part.stock.quantityOnHand > part.maxStockLevel && "text-blue-600 font-medium"
                    )}>
                      {part.maxStockLevel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">On Order</span>
                    <span>{part.stock?.quantityOnOrder ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              <Card>
                <CardContent className="py-8 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Stock movement history will be available here
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default PartDetailDrawer;

```

### `client/src/components/inventory/SupplierLinksSection.tsx` (166 lines)

```tsx
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
    if (a.isPreferred && !b.isPreferred) return -1;
    if (!a.isPreferred && b.isPreferred) return 1;
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

```

### `client/src/components/inventory/SupplierMultiSelect.tsx` (181 lines)

```tsx
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
                      <span className="flex-1">
                        {supplier.name}
                        <span className="text-muted-foreground ml-2 text-sm">
                          ({supplier.code})
                        </span>
                      </span>
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

```

### `client/src/components/inventory/VirtualizedInventoryTable.tsx` (428 lines)

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Edit2,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

export interface PartsInventoryItem {
  id: string;
  partNumber: string;
  partName: string;
  description?: string | null;
  category: string;
  unitOfMeasure?: string | null;
  standardCost?: number | null;
  criticality?: string | null;
  leadTimeDays?: number | null;
  minStockLevel: number;
  maxStockLevel: number;
  supplierName?: string | null;
  stock?: {
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
    quantityOnOrder?: number;
    availableQuantity: number;
    unitCost: number;
    location?: string;
    status: string;
  } | null;
}

interface VirtualizedInventoryTableProps {
  items: PartsInventoryItem[];
  isLoading?: boolean;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  onRowClick?: (item: PartsInventoryItem) => void;
  onEdit?: (item: PartsInventoryItem) => void;
  onDelete?: (item: PartsInventoryItem) => void;
  selectedItems?: Set<string>;
  onSelectionChange?: (itemId: string, selected: boolean) => void;
  rowHeight?: number;
}

const COLUMNS = [
  { key: "partNumber", label: "Part #", width: 120, sortable: true },
  { key: "partName", label: "Name", width: 200, sortable: true },
  { key: "category", label: "Category", width: 120, sortable: true },
  { key: "available", label: "Available", width: 100, sortable: true, align: "right" as const },
  { key: "quantityOnHand", label: "On Hand", width: 80, sortable: true, align: "right" as const },
  { key: "quantityReserved", label: "Reserved", width: 80, sortable: true, align: "right" as const },
  { key: "unitCost", label: "Unit Cost", width: 100, sortable: true, align: "right" as const },
  { key: "totalValue", label: "Total Value", width: 100, sortable: true, align: "right" as const },
  { key: "status", label: "Status", width: 100, sortable: true },
  { key: "actions", label: "", width: 60, sortable: false },
];

function getStockStatus(item: PartsInventoryItem): string {
  if (!item.stock) {return "unknown";}
  const { quantityOnHand, quantityReserved } = item.stock;
  const available = Math.max(0, quantityOnHand - quantityReserved);
  const minStock = item.minStockLevel;
  const maxStock = item.maxStockLevel;

  if (quantityOnHand <= 0) {return "out_of_stock";}
  if (available <= 0) {return "critical";}
  if (available < minStock * 0.5) {return "critical";}
  if (available < minStock) {return "low_stock";}
  if (available > maxStock) {return "excess_stock";}
  return "adequate";
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string; icon: typeof CheckCircle }> = {
    out_of_stock: { variant: "destructive", label: "Out of Stock", icon: XCircle },
    critical: { variant: "destructive", label: "Critical", icon: AlertTriangle },
    low_stock: { variant: "secondary", label: "Low Stock", icon: AlertTriangle },
    excess_stock: { variant: "outline", label: "Excess", icon: Package },
    adequate: { variant: "default", label: "Adequate", icon: CheckCircle },
    unknown: { variant: "outline", label: "Unknown", icon: Package },
  };

  const config = statusConfig[status] || statusConfig.unknown;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 whitespace-nowrap">
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{config.label}</span>
    </Badge>
  );
}

function formatCurrencyDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined) {return "-";}
  return formatCurrency(value);
}

function SortableHeader({
  column,
  sortField,
  sortDirection,
  onSort,
}: {
  column: typeof COLUMNS[0];
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  if (!column.sortable) {
    return <span>{column.label}</span>;
  }

  const isActive = sortField === column.key;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-3 h-8 data-[state=open]:bg-accent",
        column.align === "right" && "justify-end -mr-3"
      )}
      onClick={() => onSort(column.key)}
      data-testid={`sort-${column.key}`}
    >
      {column.label}
      {isActive ? (
        sortDirection === "asc" ? (
          <ChevronUp className="ml-1 h-4 w-4" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4" />
        )
      ) : (
        <ChevronUp className="ml-1 h-4 w-4 opacity-0 group-hover:opacity-50" />
      )}
    </Button>
  );
}

export function VirtualizedInventoryTable({
  items,
  isLoading = false,
  sortField,
  sortDirection,
  onSort,
  onRowClick,
  onEdit,
  onDelete,
  selectedItems = new Set(),
  rowHeight = 48,
}: VirtualizedInventoryTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  if (isLoading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key} style={{ width: column.width }}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={`skeleton-row-${index}`}>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key} style={{ width: column.width }}>
                  <SortableHeader
                    column={column}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No parts found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="border rounded-lg overflow-hidden flex flex-col" data-testid="virtualized-inventory-table">
      <div className="bg-muted/50 flex-none">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width, minWidth: column.width }}
                  className={cn(column.align === "right" && "text-right")}
                >
                  <SortableHeader
                    column={column}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      <div
        ref={parentRef}
        className="overflow-auto flex-1"
        style={{ maxHeight: 600 }}
        data-testid="inventory-scroll-container"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            const status = getStockStatus(item);
            const available = item.stock 
              ? Math.max(0, item.stock.quantityOnHand - item.stock.quantityReserved) 
              : 0;
            const unitCost = item.stock?.unitCost ?? item.standardCost ?? 0;
            const totalValue = unitCost * (item.stock?.quantityOnHand ?? 0);

            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "flex items-center border-b cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedItems.has(item.id) && "bg-primary/5"
                )}
                onClick={() => onRowClick?.(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick?.(item); } }}
                data-testid={`inventory-row-${item.id}`}
              >
                <div className="font-mono text-sm px-4 truncate" style={{ width: 120, minWidth: 120 }}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate block">{item.partNumber}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.partNumber}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="px-4" style={{ width: 200, minWidth: 200 }}>
                  <div className="flex flex-col">
                    <span className="font-medium truncate">{item.partName}</span>
                    {item.supplierName && (
                      <span className="text-xs text-muted-foreground truncate">{item.supplierName}</span>
                    )}
                  </div>
                </div>
                <div className="px-4" style={{ width: 120, minWidth: 120 }}>
                  <Badge variant="outline" className="text-xs">{item.category}</Badge>
                </div>
                <div className="px-4 text-right font-medium" style={{ width: 100, minWidth: 100 }}>
                  <span className={cn(
                    status === "critical" || status === "out_of_stock" ? "text-destructive" : "",
                    status === "low_stock" ? "text-yellow-600" : ""
                  )}>
                    {available}
                  </span>
                </div>
                <div className="px-4 text-right" style={{ width: 80, minWidth: 80 }}>
                  {item.stock?.quantityOnHand ?? 0}
                </div>
                <div className="px-4 text-right" style={{ width: 80, minWidth: 80 }}>
                  {item.stock?.quantityReserved ?? 0}
                </div>
                <div className="px-4 text-right" style={{ width: 100, minWidth: 100 }}>
                  {formatCurrencyDisplay(unitCost)}
                </div>
                <div className="px-4 text-right" style={{ width: 100, minWidth: 100 }}>
                  {formatCurrencyDisplay(totalValue)}
                </div>
                <div className="px-4" style={{ width: 100, minWidth: 100 }}>
                  {getStatusBadge(status)}
                </div>
                <div className="px-4" style={{ width: 60, minWidth: 60 }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`actions-${item.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick?.(item);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {onEdit && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(item);
                          }}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit Part
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedInventoryTable;

```

