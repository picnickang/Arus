import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCustomMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useCrudMutations";
import { type TemplateFormData, type ChecklistItemFormData } from "../types";
import { templateSchema, checklistItemSchema } from "../lib/templateUtils";

interface MaintenanceTemplate {
  id: string;
  equipmentType: string;
  name: string;
  description?: string;
  frequency: string;
  estimatedDuration: number;
  priority: string;
}

export function useMaintenanceTemplatesData() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("engine");
  const [selectedTemplate, setSelectedTemplate] = useState<MaintenanceTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItemFormData[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const { data: allTemplates = [], isLoading } = useQuery<MaintenanceTemplate[]>({
    queryKey: ["/api/maintenance-templates"],
    refetchInterval: 60000,
  });
  const { data: templateItems = [] } = useQuery({
    queryKey: ["/api/maintenance-templates", selectedTemplate?.id, "items"],
    queryFn: () => apiRequest("GET", `/api/maintenance-templates/${selectedTemplate?.id}/items`),
    enabled: !!selectedTemplate?.id && isViewDialogOpen,
  });
  const filteredTemplates = allTemplates.filter((t) => t.equipmentType === selectedType);

  const templateForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      equipmentType: "engine",
      name: "",
      description: "",
      frequency: "",
      estimatedDuration: 60,
      priority: "medium",
    },
  });
  const itemForm = useForm<ChecklistItemFormData>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: {
      stepNumber: 1,
      description: "",
      required: false,
      estimatedMinutes: 10,
      imageUrl: "",
    },
  });

  const createTemplateMutation = useCustomMutation<TemplateFormData, MaintenanceTemplate>({
    mutationFn: async (data: TemplateFormData) =>
      apiRequest("POST", "/api/maintenance-templates", data),
    invalidateKeys: ["/api/maintenance-templates"],
    onSuccess: (template) => {
      if (checklistItems.length > 0) {
        Promise.all(
          checklistItems.map((item) =>
            apiRequest("POST", `/api/maintenance-templates/${template.id}/items`, item)
          )
        )
          .then(() => {
            toast({ title: "Template created successfully with checklist items" });
            setIsCreateDialogOpen(false);
            setChecklistItems([]);
            templateForm.reset();
          })
          .catch((error: Error) => {
            toast({
              title: "Template created but failed to add some checklist items",
              description: error.message,
              variant: "destructive",
            });
          });
      } else {
        toast({ title: "Template created successfully" });
        setIsCreateDialogOpen(false);
        templateForm.reset();
      }
    },
  });

  const updateTemplateMutation = useUpdateMutation("/api/maintenance-templates", {
    successMessage: "Template updated successfully",
    onSuccess: () => {
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
    },
  });
  const deleteTemplateMutation = useDeleteMutation("/api/maintenance-templates", {
    successMessage: "Template deleted successfully",
    onSuccess: () => {
      setDeleteTemplateId(null);
    },
  });
  const cloneTemplateMutation = useCustomMutation<string, void>({
    mutationFn: (id: string) => apiRequest("POST", `/api/maintenance-templates/${id}/clone`),
    invalidateKeys: ["/api/maintenance-templates"],
    successMessage: "Template cloned successfully",
  });

  const onTemplateSubmit = (data: TemplateFormData) => {
    if (isEditDialogOpen && selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };
  const handleEdit = (template: MaintenanceTemplate) => {
    setSelectedTemplate(template);
    templateForm.reset({
      equipmentType: template.equipmentType,
      name: template.name,
      description: template.description || "",
      frequency: template.frequency,
      estimatedDuration: template.estimatedDuration,
      priority: template.priority,
    });
    setIsEditDialogOpen(true);
  };
  const handleView = (template: MaintenanceTemplate) => {
    setSelectedTemplate(template);
    setIsViewDialogOpen(true);
  };
  const handleDelete = (id: string) => {
    setDeleteTemplateId(id);
  };
  const handleClone = (id: string) => {
    cloneTemplateMutation.mutate(id);
  };

  const addChecklistItem = (data: ChecklistItemFormData) => {
    if (editingItemIndex !== null) {
      const updated = [...checklistItems];
      updated[editingItemIndex] = data;
      setChecklistItems(updated);
      setEditingItemIndex(null);
    } else {
      setChecklistItems([...checklistItems, data]);
    }
    itemForm.reset({
      stepNumber: checklistItems.length + 2,
      description: "",
      required: false,
      estimatedMinutes: 10,
      imageUrl: "",
    });
  };
  const editChecklistItem = (index: number) => {
    setEditingItemIndex(index);
    itemForm.reset(checklistItems[index]);
  };
  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };
  const openCreateDialog = () => {
    templateForm.reset();
    setChecklistItems([]);
    setIsCreateDialogOpen(true);
  };
  const openCreateForType = (typeValue: string) => {
    templateForm.setValue("equipmentType", typeValue);
    setIsCreateDialogOpen(true);
  };
  const closeDialog = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setSelectedTemplate(null);
    setChecklistItems([]);
    templateForm.reset();
  };
  const confirmDelete = () => {
    if (deleteTemplateId) {
      deleteTemplateMutation.mutate(deleteTemplateId);
    }
  };

  return {
    selectedType,
    setSelectedType,
    selectedTemplate,
    isCreateDialogOpen,
    isEditDialogOpen,
    isViewDialogOpen,
    setIsViewDialogOpen,
    deleteTemplateId,
    setDeleteTemplateId,
    checklistItems,
    editingItemIndex,
    allTemplates,
    filteredTemplates,
    templateItems,
    isLoading,
    templateForm,
    itemForm,
    createTemplateMutation,
    updateTemplateMutation,
    deleteTemplateMutation,
    cloneTemplateMutation,
    onTemplateSubmit,
    handleEdit,
    handleView,
    handleDelete,
    handleClone,
    addChecklistItem,
    editChecklistItem,
    removeChecklistItem,
    openCreateDialog,
    openCreateForType,
    closeDialog,
    confirmDelete,
  };
}

export function getPriorityBadgeConfig(priority: number | string | null | undefined): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  const priorityMap: Record<
    number,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      className: string;
    }
  > = {
    1: { label: "Critical", variant: "destructive", className: "" },
    2: {
      label: "High",
      variant: "default",
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    },
    3: {
      label: "Medium",
      variant: "default",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    4: {
      label: "Low",
      variant: "secondary",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    5: {
      label: "Minimal",
      variant: "secondary",
      className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    },
  };
  const numPriority =
    typeof priority === "number"
      ? priority
      : typeof priority === "string"
        ? Number.parseInt(priority, 10)
        : 3;
  return priorityMap[numPriority] || priorityMap[3];
}
