import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import { apiRequest } from "@/lib/queryClient";
import { exportToCSV } from "@/lib/exportUtils";
import { useInventoryParts, getStockStatus, calculateInventoryStats, sortParts, filterParts, parseFiltersFromUrl, serializeFiltersToUrl, countActiveFilters, deriveFilterOptions, createDefaultFilters } from "../index";
import type { InventoryFilters } from "@/components/inventory/InventoryFilterPanel";
import type { PartsInventoryItem } from "@/components/inventory/VirtualizedInventoryTable";

export const partFormSchema = z.object({
  partNumber: z.string().min(1, "Part number is required"), partName: z.string().min(1, "Part name is required"), description: z.string().optional(), category: z.string().min(1, "Category is required"), unitOfMeasure: z.string().optional(),
  standardCost: z.number({ required_error: "Standard cost is required", invalid_type_error: "Standard cost must be a number" }).min(0, "Standard cost cannot be negative"),
  criticality: z.string().optional(), leadTimeDays: z.number({ required_error: "Lead time is required", invalid_type_error: "Lead time must be a number" }).min(1, "Lead time must be at least 1 day"),
  quantityOnHand: z.number({ required_error: "Quantity is required", invalid_type_error: "Quantity must be a number" }).min(0, "Quantity cannot be negative"),
  minStockLevel: z.number({ required_error: "Min stock is required", invalid_type_error: "Min stock must be a number" }).min(0, "Minimum stock cannot be negative"),
  maxStockLevel: z.number({ required_error: "Max stock is required", invalid_type_error: "Max stock must be a number" }).min(1, "Maximum stock must be at least 1"),
  location: z.string().optional(),
  supplierIds: z.array(z.string()).optional().default([]),
  preferredSupplierId: z.string().optional(),
});
export type PartFormData = z.infer<typeof partFormSchema>;

export function useInventoryManagementData() {
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const orgId = "default-org-id";

  const [filters, setFilters] = useState<InventoryFilters>(() => parseFiltersFromUrl(searchParams));
  const [sortField, setSortField] = useState<string>("partName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isAddPartDialogOpen, setIsAddPartDialogOpen] = useState(false);
  const [isEditPartDialogOpen, setIsEditPartDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<PartsInventoryItem | null>(null);
  const [selectedPart, setSelectedPart] = useState<PartsInventoryItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  useEffect(() => {
    const basePath = location.split("?")[0];
    const currentParams = new URLSearchParams(searchParams);
    const tabParam = currentParams.get("tab");

    const filterQuery = serializeFiltersToUrl(filters);
    const newParams = new URLSearchParams(filterQuery);
    if (tabParam) {newParams.set("tab", tabParam);}

    const newQueryString = newParams.toString();
    const newPath = newQueryString ? `${basePath}?${newQueryString}` : basePath;
    const currentPath = `${basePath}${searchParams ? `?${searchParams}` : ""}`;
    if (newPath !== currentPath) { setLocation(newPath, { replace: true }); }
  }, [filters, location, searchParams, setLocation]);

  const partForm = useForm<PartFormData>({ resolver: zodResolver(partFormSchema), defaultValues: { partNumber: "", partName: "", description: "", category: "", unitOfMeasure: "ea", standardCost: 0, criticality: "medium", leadTimeDays: 7, quantityOnHand: 0, minStockLevel: 1, maxStockLevel: 100, location: "MAIN", supplierIds: [], preferredSupplierId: undefined } });

  const { data: partsInventory = [], isLoading: isLoadingInventory, error } = useInventoryParts() as { data: PartsInventoryItem[]; isLoading: boolean; error: Error | null };
  const filterOptions = useMemo(() => deriveFilterOptions(partsInventory), [partsInventory]);
  const filteredParts = useMemo(() => { const filtered = filterParts(partsInventory, filters); return sortParts(filtered, sortField, sortDirection); }, [partsInventory, filters, sortField, sortDirection]);
  const stats = useMemo(() => calculateInventoryStats(partsInventory), [partsInventory]);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const createPartMutation = useCustomMutation({
    mutationFn: async (data: PartFormData) => {
      const result = await apiRequest("POST", "/api/parts-inventory", { partNumber: data.partNumber, partName: data.partName, category: data.category, unitCost: data.standardCost, quantityOnHand: data.quantityOnHand, minStockLevel: data.minStockLevel, maxStockLevel: data.maxStockLevel, leadTimeDays: data.leadTimeDays, supplierName: "TBD", description: data.description || "", location: data.location || "MAIN", orgId });
      if (result?.id) {
        const supplierIds = data.supplierIds || [];
        const preferredSupplierId = supplierIds.includes(data.preferredSupplierId || "") ? data.preferredSupplierId : (supplierIds[0] || undefined);
        await apiRequest("PUT", `/api/inventory/${result.id}/suppliers`, { supplierIds, preferredSupplierId });
      }
      return result;
    },
    invalidateKeys: ["/api/parts-inventory", "/api/parts-inventory/filters"],
    successMessage: "Part added successfully",
    onSuccess: () => { setIsAddPartDialogOpen(false); partForm.reset(); }
  });

  const updatePartMutation = useCustomMutation({
    mutationFn: async ({ id, data }: { id: string; data: PartFormData }) => {
      const result = await apiRequest("PUT", `/api/parts-inventory/${id}`, { partNumber: data.partNumber, partName: data.partName, category: data.category, unitCost: data.standardCost, quantityOnHand: data.quantityOnHand, minStockLevel: data.minStockLevel, maxStockLevel: data.maxStockLevel, leadTimeDays: data.leadTimeDays, description: data.description || "", location: data.location || "MAIN" });
      const supplierIds = data.supplierIds || [];
      const preferredSupplierId = supplierIds.includes(data.preferredSupplierId || "") ? data.preferredSupplierId : (supplierIds[0] || undefined);
      await apiRequest("PUT", `/api/inventory/${id}/suppliers`, { supplierIds, preferredSupplierId });
      return result;
    },
    invalidateKeys: ["/api/parts-inventory", "/api/parts-inventory/filters"],
    successMessage: "Part updated successfully",
    onSuccess: () => { setIsEditPartDialogOpen(false); setEditingPart(null); partForm.reset(); }
  });
  const deletePartMutation = useCustomMutation({ mutationFn: async (id: string) => apiRequest("DELETE", `/api/parts-inventory/${id}`), invalidateKeys: ["/api/parts-inventory", "/api/parts-inventory/filters"], successMessage: "Part deleted successfully" });

  const handleSort = useCallback((field: string) => { if (sortField === field) { setSortDirection((prev) => (prev === "asc" ? "desc" : "asc")); } else { setSortField(field); setSortDirection("asc"); } }, [sortField]);
  const handleClearFilters = useCallback(() => { setFilters(createDefaultFilters()); }, []);
  const handleAddPart = useCallback(() => { partForm.reset(); setIsAddPartDialogOpen(true); }, [partForm]);
  const handleEditPart = useCallback(async (part: PartsInventoryItem) => {
    setEditingPart(part);
    let supplierIds: string[] = [];
    let preferredSupplierId: string | undefined;
    try {
      const links = await apiRequest("GET", `/api/inventory/${part.id}/suppliers`);
      if (Array.isArray(links)) {
        supplierIds = links.map((l: { supplierId: string }) => l.supplierId);
        const preferred = links.find((l: { isPreferred?: boolean }) => l.isPreferred);
        preferredSupplierId = preferred?.supplierId;
      }
    } catch {
      console.warn("Failed to fetch supplier links for editing");
    }
    partForm.reset({ partNumber: part.partNumber, partName: part.partName, description: part.description || "", category: part.category, unitOfMeasure: part.unitOfMeasure || "ea", standardCost: part.standardCost ?? 0, criticality: part.criticality || "medium", leadTimeDays: part.leadTimeDays || 7, quantityOnHand: part.stock?.quantityOnHand ?? 0, minStockLevel: part.minStockLevel ?? 1, maxStockLevel: part.maxStockLevel ?? 100, location: part.stock?.location || "MAIN", supplierIds, preferredSupplierId });
    setIsEditPartDialogOpen(true);
  }, [partForm]);
  const handleDeletePart = useCallback((part: PartsInventoryItem) => { if (confirm(`Are you sure you want to delete "${part.partName}" (${part.partNumber})?`)) { deletePartMutation.mutate(part.id); } }, [deletePartMutation]);
  const handleRowClick = useCallback((part: PartsInventoryItem) => { setSelectedPart(part); setIsDrawerOpen(true); }, []);
  const onSubmitPart = useCallback((data: PartFormData) => { if (editingPart) { updatePartMutation.mutate({ id: editingPart.id, data }); } else { createPartMutation.mutate(data); } }, [editingPart, updatePartMutation, createPartMutation]);

  const handleExportCSV = useCallback(() => {
    const exportData = filteredParts.map((part) => { const available = (part.stock?.quantityOnHand || 0) - (part.stock?.quantityReserved || 0); const unitCost = part.stock?.unitCost || part.standardCost || 0; const totalValue = unitCost * (part.stock?.quantityOnHand || 0); const status = getStockStatus(part); return { partNumber: part.partNumber, partName: part.partName, category: part.category, available, onHand: part.stock?.quantityOnHand || 0, reserved: part.stock?.quantityReserved || 0, unitCost: unitCost.toFixed(2), totalValue: totalValue.toFixed(2), location: part.stock?.location || "MAIN", status: status.replace("_", " ").toUpperCase() }; });
    const success = exportToCSV(exportData, { filename: `inventory-export-${new Date().toISOString().split("T")[0]}.csv`, columns: ["partNumber", "partName", "category", "available", "onHand", "reserved", "unitCost", "totalValue", "location", "status"], headers: { partNumber: "Part Number", partName: "Part Name", category: "Category", available: "Available Qty", onHand: "On Hand", reserved: "Reserved", unitCost: "Unit Cost", totalValue: "Total Value", location: "Location", status: "Status" } });
    if (success) { toast({ title: "Export Successful", description: `Exported ${filteredParts.length} parts to CSV` }); } else { toast({ title: "No Data", description: "No inventory data to export", variant: "destructive" }); }
  }, [filteredParts, toast]);

  const handlePartDialogClose = useCallback((open: boolean) => { if (!open) { setIsAddPartDialogOpen(false); setIsEditPartDialogOpen(false); setEditingPart(null); partForm.reset(); } }, [partForm]);
  const handlePartDetailEdit = useCallback((part: PartsInventoryItem) => { setIsDrawerOpen(false); handleEditPart(part); }, [handleEditPart]);

  return {
    partsInventory, filteredParts, isLoadingInventory, error, stats, filterOptions, activeFilterCount,
    filters, setFilters, sortField, sortDirection, handleSort, handleClearFilters,
    isAddPartDialogOpen, setIsAddPartDialogOpen, isEditPartDialogOpen, setIsEditPartDialogOpen, editingPart,
    selectedPart, isDrawerOpen, setIsDrawerOpen, isFilterPanelOpen, setIsFilterPanelOpen, isMobileFilterOpen, setIsMobileFilterOpen,
    partForm, createPartMutation, updatePartMutation, deletePartMutation,
    handleAddPart, handleEditPart, handleDeletePart, handleRowClick, onSubmitPart, handleExportCSV, handlePartDialogClose, handlePartDetailEdit,
  };
}
