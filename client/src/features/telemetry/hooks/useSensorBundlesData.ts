import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface SensorBundle {
  id: string;
  orgId: string | null;
  bundleId: string;
  name: string;
  description?: string;
  equipmentType?: string;
  templateIds: string[];
  isSystemDefault: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BundleFormData {
  bundleId: string;
  name: string;
  description: string;
  equipmentType: string;
  templateIds: string[];
}

export const EQUIPMENT_TYPES = [
  "engine",
  "pump",
  "compressor",
  "generator",
  "gearbox",
  "thruster",
  "crane",
  "winch",
  "boiler",
  "hvac",
  "navigation",
  "communication",
  "safety",
  "other",
];

export function useSensorBundlesData() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<SensorBundle | null>(null);
  const [deleteBundle, setDeleteBundle] = useState<SensorBundle | null>(null);
  const [formData, setFormData] = useState<BundleFormData>({
    bundleId: "",
    name: "",
    description: "",
    equipmentType: "",
    templateIds: [],
  });
  const [templateIdsInput, setTemplateIdsInput] = useState("");

  const { data: bundles = [], isLoading } = useQuery<SensorBundle[]>({
    queryKey: ["/api/sensor-bundles"],
    queryFn: async () => apiRequest("GET", "/api/sensor-bundles"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: BundleFormData) => apiRequest("POST", "/api/sensor-bundles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensor-bundles"] });
      toast({ title: "Success", description: "Bundle created successfully" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create bundle",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BundleFormData> }) =>
      apiRequest("PUT", `/api/sensor-bundles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensor-bundles"] });
      toast({ title: "Success", description: "Bundle updated successfully" });
      setIsEditOpen(false);
      setEditingBundle(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update bundle",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/sensor-bundles/${id}`, null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensor-bundles"] });
      toast({ title: "Success", description: "Bundle deleted successfully" });
      setDeleteBundle(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete bundle",
        variant: "destructive",
      });
    },
  });

  const resetForm = useCallback(() => {
    setFormData({ bundleId: "", name: "", description: "", equipmentType: "", templateIds: [] });
    setTemplateIdsInput("");
  }, []);

  const parseTemplateIds = useCallback(
    (input: string): string[] =>
      input
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    []
  );

  const handleCreate = useCallback(() => {
    const templateIds = parseTemplateIds(templateIdsInput);
    if (templateIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one template ID",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({ ...formData, templateIds });
  }, [templateIdsInput, formData, createMutation, parseTemplateIds, toast]);

  const handleEdit = useCallback((bundle: SensorBundle) => {
    setEditingBundle(bundle);
    setFormData({
      bundleId: bundle.bundleId,
      name: bundle.name,
      description: bundle.description || "",
      equipmentType: bundle.equipmentType || "",
      templateIds: bundle.templateIds,
    });
    setTemplateIdsInput(bundle.templateIds.join(", "));
    setIsEditOpen(true);
  }, []);

  const handleUpdate = useCallback(() => {
    if (!editingBundle) {
      return;
    }
    const templateIds = parseTemplateIds(templateIdsInput);
    if (templateIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one template ID",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      id: editingBundle.id,
      data: {
        name: formData.name,
        description: formData.description,
        equipmentType: formData.equipmentType,
        templateIds,
      },
    });
  }, [editingBundle, templateIdsInput, formData, updateMutation, parseTemplateIds, toast]);

  const handleDelete = useCallback(() => {
    if (!deleteBundle) {
      return;
    }
    deleteMutation.mutate(deleteBundle.id);
  }, [deleteBundle, deleteMutation]);

  const systemBundles = useMemo(() => bundles.filter((b) => b.isSystemDefault), [bundles]);
  const customBundles = useMemo(() => bundles.filter((b) => !b.isSystemDefault), [bundles]);

  return {
    bundles,
    isLoading,
    isCreateOpen,
    setIsCreateOpen,
    isEditOpen,
    setIsEditOpen,
    editingBundle,
    setEditingBundle,
    deleteBundle,
    setDeleteBundle,
    formData,
    setFormData,
    templateIdsInput,
    setTemplateIdsInput,
    createMutation,
    updateMutation,
    deleteMutation,
    resetForm,
    handleCreate,
    handleEdit,
    handleUpdate,
    handleDelete,
    systemBundles,
    customBundles,
  };
}
