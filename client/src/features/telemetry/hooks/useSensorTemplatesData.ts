import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { sensorTemplateKeys } from "@/utils/queryKeys";
import { SENSOR_KIND_PRESETS, getDefaultUnit, getDefaultFields } from "@shared/sensorKindPresets";

export interface SensorTemplate {
  id: string;
  orgId: string;
  templateId: string;
  name: string;
  kind: string;
  unit?: string;
  equipmentTypes?: string[];
  fields: Record<string, unknown>;
  notes?: string;
  isSystemDefault: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
export interface TemplateFormData {
  templateId: string;
  name: string;
  kind: string;
  unit: string;
  equipmentTypes: string[];
  fields: Record<string, unknown>;
  notes: string;
}

export const EQUIPMENT_TYPES = [
  "main_engine",
  "auxiliary_engine",
  "gearbox",
  "marine_pump",
  "compressor",
  "generator",
  "boiler",
  "heat_exchanger",
  "propeller",
  "rudder",
  "thruster",
  "winch",
  "crane",
  "ballast_pump",
  "fire_pump",
  "hvac",
  "navigation_system",
];
export const SENSOR_KINDS = [
  "vibration",
  "pressure",
  "temperature",
  "flow",
  "level",
  "voltage",
  "current",
  "frequency",
  "rpm",
  "oil_debris",
  "acoustic",
  "position",
];

export function useSensorTemplatesData() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SensorTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<SensorTemplate | null>(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>({
    templateId: "",
    name: "",
    kind: "",
    unit: "",
    equipmentTypes: [],
    fields: {},
    notes: "",
  });
  const [fieldsJson, setFieldsJson] = useState("{}");

  const { data: templates = [], isLoading } = useQuery<SensorTemplate[]>({
    queryKey: sensorTemplateKeys.lists(),
    queryFn: async () => {
      const response = await fetch("/api/sensor-templates");
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      return response.json();
    },
  });

  const resetForm = useCallback(() => {
    setFormData({
      templateId: "",
      name: "",
      kind: "",
      unit: "",
      equipmentTypes: [],
      fields: {},
      notes: "",
    });
    setFieldsJson("{}");
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => apiRequest("POST", "/api/sensor-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sensorTemplateKeys.all });
      toast({ title: "Success", description: "Template created successfully" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) =>
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateFormData> }) =>
      apiRequest("PUT", `/api/sensor-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sensorTemplateKeys.all });
      toast({ title: "Success", description: "Template updated successfully" });
      setIsEditOpen(false);
      setEditingTemplate(null);
      resetForm();
    },
    onError: (error: Error) =>
      toast({
        title: "Error",
        description: error.message || "Failed to update template",
        variant: "destructive",
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/sensor-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sensorTemplateKeys.all });
      toast({ title: "Success", description: "Template deleted successfully" });
      setDeleteTemplate(null);
    },
    onError: (error: Error) =>
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      }),
  });

  const handleCreate = useCallback(() => {
    try {
      const fields = JSON.parse(fieldsJson);
      createMutation.mutate({ ...formData, fields });
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON for fields",
        variant: "destructive",
      });
    }
  }, [fieldsJson, formData, createMutation, toast]);
  const handleEdit = useCallback((template: SensorTemplate) => {
    setEditingTemplate(template);
    setFormData({
      templateId: template.templateId,
      name: template.name,
      kind: template.kind,
      unit: template.unit || "",
      equipmentTypes: template.equipmentTypes ?? [],
      fields: template.fields,
      notes: template.notes || "",
    });
    setFieldsJson(JSON.stringify(template.fields, null, 2));
    setIsEditOpen(true);
  }, []);
  const handleUpdate = useCallback(() => {
    if (!editingTemplate) {
      return;
    }
    try {
      const fields = JSON.parse(fieldsJson);
      updateMutation.mutate({ id: editingTemplate.id, data: { ...formData, fields } });
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON for fields",
        variant: "destructive",
      });
    }
  }, [editingTemplate, fieldsJson, formData, updateMutation, toast]);
  const handleDelete = useCallback(() => {
    if (!deleteTemplate) {
      return;
    }
    deleteMutation.mutate(deleteTemplate.id);
  }, [deleteTemplate, deleteMutation]);
  const handleKindChange = useCallback(
    (value: string) => {
      type SensorKind = keyof typeof SENSOR_KIND_PRESETS;
      const defaultUnit = getDefaultUnit(value as SensorKind);
      const defaultFields = getDefaultFields(value as SensorKind);
      setFormData({ ...formData, kind: value, unit: defaultUnit, fields: defaultFields });
      setFieldsJson(JSON.stringify(defaultFields, null, 2));
      toast({
        title: "Defaults Applied",
        description: `Auto-filled with ${SENSOR_KIND_PRESETS[value as SensorKind]?.label} preset defaults`,
      });
    },
    [formData, toast]
  );

  const getKindBadge = useCallback((kind: string) => {
    const colorMap: Record<string, string> = {
      vibration: "bg-blue-100 text-blue-800",
      pressure: "bg-green-100 text-green-800",
      temperature: "bg-red-100 text-red-800",
      flow: "bg-cyan-100 text-cyan-800",
      level: "bg-yellow-100 text-yellow-800",
      voltage: "bg-purple-100 text-purple-800",
      current: "bg-indigo-100 text-indigo-800",
      frequency: "bg-pink-100 text-pink-800",
      rpm: "bg-orange-100 text-orange-800",
      oil_debris: "bg-amber-100 text-amber-800",
      acoustic: "bg-teal-100 text-teal-800",
    };
    return colorMap[kind] || "bg-gray-100 text-gray-800";
  }, []);

  const systemTemplates = useMemo(() => templates.filter((t) => t.isSystemDefault), [templates]);
  const customTemplates = useMemo(() => templates.filter((t) => !t.isSystemDefault), [templates]);

  return {
    isCreateOpen,
    setIsCreateOpen,
    isEditOpen,
    setIsEditOpen,
    editingTemplate,
    setEditingTemplate,
    deleteTemplate,
    setDeleteTemplate,
    advancedMode,
    setAdvancedMode,
    formData,
    setFormData,
    fieldsJson,
    setFieldsJson,
    templates,
    isLoading,
    systemTemplates,
    customTemplates,
    createMutation,
    updateMutation,
    deleteMutation,
    resetForm,
    handleCreate,
    handleEdit,
    handleUpdate,
    handleDelete,
    handleKindChange,
    getKindBadge,
  };
}
