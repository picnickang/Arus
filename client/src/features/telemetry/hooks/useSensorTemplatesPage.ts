import { useState, useMemo, useEffect, useCallback } from "react";
import { useSensorTemplates, useDeleteSensorTemplate } from "@/hooks/useSensorData";
import type { SensorTemplate } from "@shared/schema";

export function useSensorTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<SensorTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteTemplate, setDeleteTemplate] = useState<SensorTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const {
    data: allTemplates = [],
    isLoading,
    error,
  } = useSensorTemplates({
    ...(kindFilter !== "all" && { kind: kindFilter }),
    ...(equipmentTypeFilter !== "all" && { equipmentType: equipmentTypeFilter }),
  });
  const deleteMutation = useDeleteSensorTemplate({
    successMessage: "Template deleted successfully",
    onSuccess: () => setDeleteTemplate(null),
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, kindFilter, equipmentTypeFilter]);

  const filteredTemplates = useMemo(() => {
    let filtered = allTemplates;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.templateId.toLowerCase().includes(query) ||
          t.kind.toLowerCase().includes(query) ||
          (t.notes && t.notes.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [allTemplates, searchQuery]);
  const systemTemplates = useMemo(
    () => filteredTemplates.filter((t) => t.isSystemDefault),
    [filteredTemplates]
  );
  const customTemplates = useMemo(
    () => filteredTemplates.filter((t) => !t.isSystemDefault),
    [filteredTemplates]
  );
  const paginatedCustomTemplates = useMemo(() => {
    const start = (page - 1) * pageSize;
    return customTemplates.slice(start, start + pageSize);
  }, [customTemplates, page, pageSize]);
  const paginationMeta = useMemo(
    () => ({
      total: customTemplates.length,
      page,
      pageSize,
      totalPages: Math.ceil(customTemplates.length / pageSize),
    }),
    [customTemplates.length, page, pageSize]
  );

  const handleEdit = useCallback((template: SensorTemplate) => {
    setSelectedTemplate(template);
    setIsEditDialogOpen(true);
  }, []);
  const handleDelete = useCallback(() => {
    if (deleteTemplate) {
      deleteMutation.mutate(deleteTemplate.id);
    }
  }, [deleteTemplate, deleteMutation]);
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setKindFilter("all");
    setEquipmentTypeFilter("all");
    setPage(1);
  }, []);

  const hasActiveFilters = searchQuery || kindFilter !== "all" || equipmentTypeFilter !== "all";

  return {
    selectedTemplate,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    deleteTemplate,
    setDeleteTemplate,
    searchQuery,
    setSearchQuery,
    kindFilter,
    setKindFilter,
    equipmentTypeFilter,
    setEquipmentTypeFilter,
    page,
    setPage,
    isLoading,
    error,
    systemTemplates,
    customTemplates,
    paginatedCustomTemplates,
    paginationMeta,
    handleEdit,
    handleDelete,
    clearFilters,
    hasActiveFilters,
    deleteMutation,
  };
}
