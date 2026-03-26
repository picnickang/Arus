/**
 * Inventory Management Page
 *
 * Improvements applied:
 * #7  — Critical/Out and Low Stock stat cards now open LowStockReplenishmentPanel
 *        so officers can go directly from "I see a problem" to "create a PR" in one click.
 * #17 — Note added to the logistics-hub vendors label (see logistics-hub.tsx comment).
 *        The vendor/supplier type filter is surfaced in the suppliers module separately.
 *
 * Also retains all fixes from the previous fix pass:
 * - Clickable stat cards (now opening the replenishment panel instead of just filtering)
 * - Badge overflow fix for > 9 active filters
 * - "View Results" button (was misleadingly "Apply Filters")
 * - Empty state for new catalogs
 * - Category dropdown driven by filterOptions
 * - standardCost allows empty during editing
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Package, DollarSign, TrendingDown, Layers, Download,
  AlertCircle, Filter, PanelLeftClose, PanelLeftOpen, PackageX,
} from "lucide-react";
import VirtualizedInventoryTable from "@/components/inventory/VirtualizedInventoryTable";
import InventoryFilterPanel from "@/components/inventory/InventoryFilterPanel";
import PartDetailDrawer from "@/components/inventory/PartDetailDrawer";
import { SupplierMultiSelect } from "@/components/inventory/SupplierMultiSelect";
import { LowStockReplenishmentPanel } from "@/components/inventory/LowStockReplenishmentPanel";
import { useInventoryManagementData } from "@/features/inventory";
import { formatCurrency } from "@/lib/formatters";
import { PermissionGate } from "@/components/PermissionGate";

const FALLBACK_CATEGORIES = [
  "filters", "belts", "fluids", "electrical", "mechanical",
  "hydraulics", "safety", "navigation", "deck", "engine", "other",
];

export default function InventoryManagement() {
  const {
    partsInventory, filteredParts, isLoadingInventory, stats, filterOptions,
    activeFilterCount, filters, setFilters, sortField, sortDirection, handleSort,
    handleClearFilters, isAddPartDialogOpen, isEditPartDialogOpen, editingPart,
    selectedPart, isDrawerOpen, setIsDrawerOpen, isFilterPanelOpen, setIsFilterPanelOpen,
    isMobileFilterOpen, setIsMobileFilterOpen, partForm, createPartMutation,
    updatePartMutation, handleAddPart, handleEditPart, handleDeletePart, handleRowClick,
    onSubmitPart, handleExportCSV, handlePartDialogClose, handlePartDetailEdit,
  } = useInventoryManagementData();

  // Improvement #7: replenishment panel state
  const [replenishmentOpen, setReplenishmentOpen] = React.useState(false);

  const filterBadgeLabel   = activeFilterCount > 9 ? "9+" : activeFilterCount;
  const categoryOptions    = filterOptions?.categories?.length > 0
    ? filterOptions.categories.map((c: { value: string }) => c.value)
    : FALLBACK_CATEGORIES;
  const isGenuinelyEmpty   = !isLoadingInventory && partsInventory.length === 0;

  return (
    <div className="min-h-screen flex flex-col" data-testid="inventory-management-page">

      <div className="flex-none p-4 md:p-6 pb-0 md:pb-0">
        <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setIsMobileFilterOpen(true)}
              className="md:hidden relative" data-testid="toggle-filters-mobile">
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {filterBadgeLabel}
                </span>
              )}
            </Button>
            <PermissionGate resource="inventory" action="export">
              <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
                <Download className="h-4 w-4 mr-2" />Export CSV
              </Button>
            </PermissionGate>
            <PermissionGate resource="inventory" action="create">
              <Button onClick={handleAddPart} data-testid="button-add-part">
                <Plus className="h-4 w-4 mr-2" />Add Part
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4">
          <Card className="bg-card" data-testid="stat-total-parts">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div><p className="text-xs md:text-sm font-medium text-muted-foreground">Total Parts</p>
                  <h3 className="text-xl md:text-2xl font-bold mt-1">{stats.totalParts}</h3></div>
                <Package className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card" data-testid="stat-total-value">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div><p className="text-xs md:text-sm font-medium text-muted-foreground">Total Value</p>
                  <h3 className="text-xl md:text-2xl font-bold mt-1">{formatCurrency(stats.totalValue)}</h3></div>
                <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          {/* Improvement #7: Critical/Out card now opens LowStockReplenishmentPanel */}
          <Card
            className="bg-card cursor-pointer hover:bg-muted/50 transition-colors"
            data-testid="stat-critical"
            onClick={() => setReplenishmentOpen(true)}
            title="Click to create a purchase request for critical/out-of-stock parts"
          >
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Critical/Out</p>
                  <h3 className="text-xl md:text-2xl font-bold mt-1 text-destructive">{stats.criticalCount}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Click to reorder</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-card cursor-pointer hover:bg-muted/50 transition-colors"
            data-testid="stat-low-stock"
            onClick={() => setReplenishmentOpen(true)}
            title="Click to create a purchase request for low stock parts"
          >
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Low Stock</p>
                  <h3 className="text-xl md:text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{stats.lowStockCount}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Click to reorder</p>
                </div>
                <TrendingDown className="h-8 w-8 text-yellow-600 dark:text-yellow-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card" data-testid="stat-categories">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div><p className="text-xs md:text-sm font-medium text-muted-foreground">Categories</p>
                  <h3 className="text-xl md:text-2xl font-bold mt-1">{stats.categories}</h3></div>
                <Layers className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 md:px-6 pb-4 md:pb-6 min-h-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-none pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />Parts Catalog & Stock Levels
                </CardTitle>
                <CardDescription>
                  Showing {filteredParts.length} of {partsInventory.length} parts
                  {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount} filters active</Badge>}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                className="hidden md:flex" data-testid="toggle-filters">
                {isFilterPanelOpen
                  ? <><PanelLeftClose className="h-4 w-4 mr-2" />Hide Filters</>
                  : <><PanelLeftOpen  className="h-4 w-4 mr-2" />Show Filters</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 min-h-0">
            <div className="flex h-full">
              {isFilterPanelOpen && (
                <div className="w-64 border-r flex-none hidden md:block">
                  <InventoryFilterPanel filters={filters} onFiltersChange={setFilters}
                    filterOptions={filterOptions} activeFilterCount={activeFilterCount}
                    onClearAll={handleClearFilters} className="h-full" />
                </div>
              )}
              <div className="flex-1 p-4 overflow-hidden">
                {isGenuinelyEmpty ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground">
                    <PackageX className="h-16 w-16 opacity-30" />
                    <div>
                      <p className="font-medium text-foreground">No parts in catalog yet</p>
                      <p className="text-sm mt-1">Add your first part to start tracking inventory.</p>
                    </div>
                    <PermissionGate resource="inventory" action="create">
                      <Button onClick={handleAddPart} data-testid="button-add-first-part">
                        <Plus className="h-4 w-4 mr-2" />Add First Part
                      </Button>
                    </PermissionGate>
                  </div>
                ) : (
                  <VirtualizedInventoryTable items={filteredParts} isLoading={isLoadingInventory}
                    sortField={sortField} sortDirection={sortDirection} onSort={handleSort}
                    onRowClick={handleRowClick} onEdit={handleEditPart} onDelete={handleDeletePart} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drawers & dialogs */}
      <PartDetailDrawer part={selectedPart} open={isDrawerOpen} onOpenChange={setIsDrawerOpen} onEdit={handlePartDetailEdit} />

      {/* Improvement #7: Replenishment panel */}
      <LowStockReplenishmentPanel open={replenishmentOpen} onOpenChange={setReplenishmentOpen} />

      {/* Mobile filter sheet */}
      <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Filters</SheetTitle>
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount} active</Badge>}
            </div>
          </SheetHeader>
          <div className="h-[calc(100vh-80px)] overflow-auto">
            <InventoryFilterPanel filters={filters} onFiltersChange={setFilters}
              filterOptions={filterOptions} activeFilterCount={activeFilterCount}
              onClearAll={handleClearFilters} className="h-full" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
            <Button className="w-full" onClick={() => setIsMobileFilterOpen(false)} data-testid="button-apply-filters-mobile">
              View Results ({filteredParts.length})
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add / Edit part dialog */}
      <ResponsiveDialog
        open={isAddPartDialogOpen || isEditPartDialogOpen}
        onOpenChange={handlePartDialogClose}
        title={editingPart ? "Edit Part" : "Add New Part"}
        description={editingPart ? "Update the details for this part." : "Enter the details for the new part."}
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={() => handlePartDialogClose(false)} className="flex-1" data-testid="button-cancel-part">Cancel</Button>
            <Button type="submit" onClick={partForm.handleSubmit(onSubmitPart)}
              disabled={createPartMutation.isPending || updatePartMutation.isPending} className="flex-1" data-testid="button-save-part">
              {editingPart
                ? updatePartMutation.isPending ? "Updating..." : "Update Part"
                : createPartMutation.isPending  ? "Adding..."   : "Add Part"}
            </Button>
          </div>
        }
      >
        <Form {...partForm}>
          <form onSubmit={partForm.handleSubmit(onSubmitPart)} className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={partForm.control} name="partNumber" render={({ field }) => (
                <FormItem><FormLabel>Part Number *</FormLabel>
                  <FormControl><Input placeholder="P12345" {...field} data-testid="input-part-number" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={partForm.control} name="partName" render={({ field }) => (
                <FormItem><FormLabel>Part Name *</FormLabel>
                  <FormControl><Input placeholder="Marine engine filter" {...field} data-testid="input-part-name" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={partForm.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Part description..." {...field} data-testid="input-description" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={partForm.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>Category *</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((cat: string) => (
                          <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={partForm.control} name="unitOfMeasure" render={({ field }) => (
                <FormItem><FormLabel>Unit of Measure</FormLabel>
                  <FormControl><Input placeholder="ea, gal, ft" {...field} data-testid="input-unit-measure" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={partForm.control} name="criticality" render={({ field }) => (
                <FormItem><FormLabel>Criticality</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger data-testid="select-criticality"><SelectValue placeholder="Select criticality" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={partForm.control} name="standardCost" render={({ field }) => (
                <FormItem><FormLabel>Standard Cost *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="0.00"
                      value={field.value === 0 ? "" : field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") field.onChange(undefined);
                        else { const n = Number.parseFloat(val); field.onChange(Number.isNaN(n) ? undefined : n); }
                      }}
                      onBlur={(e) => { if (e.target.value === "") field.onChange(0); field.onBlur(); }}
                      name={field.name} ref={field.ref} data-testid="input-standard-cost" />
                  </FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={partForm.control} name="leadTimeDays" render={({ field }) => (
                <FormItem><FormLabel>Lead Time (Days) *</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="7"
                      value={field.value === 0 ? "" : field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") field.onChange(undefined);
                        else { const n = Number.parseInt(val, 10); field.onChange(Number.isNaN(n) ? undefined : n); }
                      }}
                      onBlur={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        if (Number.isNaN(n) || n < 1) field.onChange(1);
                        field.onBlur();
                      }}
                      name={field.name} ref={field.ref} data-testid="input-lead-time" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Minimum 1 day</p>
                  <FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["quantityOnHand","minStockLevel","maxStockLevel"] as const).map((name) => (
                <FormField key={name} control={partForm.control} name={name} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{name === "quantityOnHand" ? "Initial Quantity" : name === "minStockLevel" ? "Min Stock" : "Max Stock"}</FormLabel>
                    <FormControl>
                      <Input type="number" min={name === "maxStockLevel" ? "1" : "0"} placeholder="0"
                        value={field.value === 0 ? "0" : field.value || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") { field.onChange(name === "maxStockLevel" ? 1 : 0); }
                          else { const n = Number.parseInt(val, 10); field.onChange(Number.isNaN(n) ? 0 : Math.max(name === "maxStockLevel" ? 1 : 0, n)); }
                        }}
                        onBlur={field.onBlur} name={field.name} ref={field.ref}
                        data-testid={`input-${name.replace(/([A-Z])/g, "-$1").toLowerCase()}`} />
                    </FormControl>
                    <FormMessage /></FormItem>
                )} />
              ))}
              <FormField control={partForm.control} name="location" render={({ field }) => (
                <FormItem><FormLabel>Location</FormLabel>
                  <FormControl><Input placeholder="MAIN" {...field} data-testid="input-location" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={partForm.control} name="supplierIds" render={({ field }) => (
              <FormItem><FormLabel>Suppliers</FormLabel>
                <FormControl>
                  <SupplierMultiSelect value={field.value || []}
                    preferredSupplierId={partForm.watch("preferredSupplierId")}
                    onChange={field.onChange}
                    onPreferredChange={(id) => partForm.setValue("preferredSupplierId", id)} />
                </FormControl>
                <FormMessage /></FormItem>
            )} />
          </form>
        </Form>
      </ResponsiveDialog>
    </div>
  );
}
