import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import {
  OperatingParameter,
  InsertOperatingParameter,
} from "@shared/schema";
import { z } from "zod";

export const equipmentTypes = [
  { value: "engine", label: "Engine" },
  { value: "pump", label: "Pump" },
  { value: "compressor", label: "Compressor" },
  { value: "gearbox", label: "Gearbox" },
  { value: "propulsion", label: "Propulsion" },
  { value: "generator", label: "Generator" },
  { value: "hvac", label: "HVAC" },
  { value: "other", label: "Other" },
];

// Hand-rolled to bypass drizzle-zod inference dropping optional columns
// from the inferred form type for `operating_parameters`.
const formSchema = z
  .object({
    equipmentType: z.string().min(1, "Equipment type is required"),
    manufacturer: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    parameterName: z.string().min(1, "Parameter name is required"),
    parameterType: z.string().min(1, "Parameter type is required"),
    unit: z.string().min(1, "Unit is required"),
    optimalMin: z.number().nullable().optional(),
    optimalMax: z.number().nullable().optional(),
    criticalMin: z.number().nullable().optional(),
    criticalMax: z.number().nullable().optional(),
    lifeImpactDescription: z.string().optional().nullable(),
    recommendedAction: z.string().optional().nullable(),
    isActive: z.boolean().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.optimalMin != null && data.optimalMax != null) {
        return data.optimalMin <= data.optimalMax;
      }
      return true;
    },
    {
      message: "Optimal minimum must be less than or equal to optimal maximum",
      path: ["optimalMax"],
    }
  )
  .refine(
    (data) => {
      if (data.criticalMin != null && data.criticalMax != null) {
        return data.criticalMin <= data.criticalMax;
      }
      return true;
    },
    {
      message: "Critical minimum must be less than or equal to critical maximum",
      path: ["criticalMax"],
    }
  )
  .refine(
    (data) => {
      const hasOptimalRange = data.optimalMin != null || data.optimalMax != null;
      const hasCriticalRange = data.criticalMin != null || data.criticalMax != null;
      return hasOptimalRange || hasCriticalRange;
    },
    {
      message: "At least one optimal or critical range value must be provided",
      path: ["optimalMin"],
    }
  )
  .refine(
    (data) => {
      const hasOptimalRange = data.optimalMin != null && data.optimalMax != null;
      const hasCriticalRange = data.criticalMin != null && data.criticalMax != null;
      if (!hasOptimalRange || !hasCriticalRange) {
        return true;
      }
      return data.criticalMax! < data.optimalMin! || data.criticalMin! > data.optimalMax!;
    },
    { message: "Critical range must be outside the optimal range", path: ["criticalMin"] }
  );

export type FormValues = z.infer<typeof formSchema>;

export function useOperatingParametersData() {
  const [selectedType, setSelectedType] = useState("engine");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [selectedParameter, setSelectedParameter] = useState<OperatingParameter | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: parameters = [], isLoading } = useQuery<OperatingParameter[]>({
    queryKey: ["/api/operating-parameters"],
    refetchInterval: 60000,
  });
  const manufacturers = useMemo(() => {
    const unique = new Set(parameters.filter((p) => p.manufacturer).map((p) => p.manufacturer));
    return Array.from(unique).sort((a, b) => (a || "").localeCompare(b || ""));
  }, [parameters]);
  const filteredParameters = useMemo(
    () =>
      parameters.filter((p) => {
        const typeMatch = p.equipmentType === selectedType;
        const manufacturerMatch =
          selectedManufacturer === "all" || p.manufacturer === selectedManufacturer;
        return typeMatch && manufacturerMatch;
      }),
    [parameters, selectedType, selectedManufacturer]
  );

  const createForm = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipmentType: selectedType,
      manufacturer: "",
      model: "",
      parameterName: "",
      parameterType: "",
      unit: "",
      optimalMin: null,
      optimalMax: null,
      criticalMin: null,
      criticalMax: null,
      lifeImpactDescription: "",
      recommendedAction: "",
      isActive: true,
    },
  });
  const editForm = useForm<FormValues, unknown, FormValues>({ resolver: zodResolver(formSchema) });

  const createMutation = useCustomMutation<InsertOperatingParameter, void>({
    mutationFn: (data: InsertOperatingParameter) =>
      apiRequest("POST", "/api/operating-parameters", data, { headers: { "x-org-id": "default-org-id" } }),
    invalidateKeys: ["/api/operating-parameters"],
    successMessage: "Operating parameter created successfully",
    onSuccess: () => {
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
  });
  const updateMutation = useCustomMutation<
    { id: string; data: Partial<InsertOperatingParameter> },
    void
  >({
    mutationFn: ({ id, data }) =>
      apiRequest("PUT", `/api/operating-parameters/${id}`, data, { headers: { "x-org-id": "default-org-id" } }),
    invalidateKeys: ["/api/operating-parameters"],
    successMessage: "Operating parameter updated successfully",
    onSuccess: () => {
      setIsEditDialogOpen(false);
      setSelectedParameter(null);
      editForm.reset();
    },
  });
  const deleteMutation = useCustomMutation<string, void>({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/operating-parameters/${id}`, undefined, {
        headers: { "x-org-id": "default-org-id" },
      }),
    invalidateKeys: ["/api/operating-parameters"],
    successMessage: "Operating parameter deleted successfully",
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
      setSelectedParameter(null);
    },
  });

  const onCreateSubmit = (data: FormValues) => {
    createMutation.mutate(data as InsertOperatingParameter);
  };
  const onEditSubmit = (data: FormValues) => {
    if (!selectedParameter) {
      return;
    }
    updateMutation.mutate({
      id: selectedParameter.id,
      data: data as Partial<InsertOperatingParameter>,
    });
  };
  const handleEdit = (parameter: OperatingParameter) => {
    setSelectedParameter(parameter);
    editForm.reset({
      equipmentType: parameter.equipmentType,
      manufacturer: parameter.manufacturer || "",
      model: parameter.model || "",
      parameterName: parameter.parameterName,
      parameterType: parameter.parameterType,
      unit: parameter.unit,
      optimalMin: parameter.optimalMin,
      optimalMax: parameter.optimalMax,
      criticalMin: parameter.criticalMin,
      criticalMax: parameter.criticalMax,
      lifeImpactDescription: parameter.lifeImpactDescription || "",
      recommendedAction: parameter.recommendedAction || "",
      isActive: parameter.isActive,
    });
    setIsEditDialogOpen(true);
  };
  const handleDelete = (parameter: OperatingParameter) => {
    setSelectedParameter(parameter);
    setIsDeleteDialogOpen(true);
  };
  const handleCreateDialogOpen = () => {
    createForm.setValue("equipmentType", selectedType);
    setIsCreateDialogOpen(true);
  };
  const formatRange = (min: number | null, max: number | null, unit: string) => {
    if (min === null && max === null) {
      return "—";
    }
    if (min !== null && max !== null) {
      return `${min} - ${max} ${unit}`;
    }
    if (min !== null) {
      return `≥ ${min} ${unit}`;
    }
    if (max !== null) {
      return `≤ ${max} ${unit}`;
    }
    return "—";
  };

  return {
    selectedType,
    setSelectedType,
    selectedManufacturer,
    setSelectedManufacturer,
    selectedParameter,
    setSelectedParameter,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    parameters,
    isLoading,
    manufacturers,
    filteredParameters,
    createForm,
    editForm,
    createMutation,
    updateMutation,
    deleteMutation,
    onCreateSubmit,
    onEditSubmit,
    handleEdit,
    handleDelete,
    handleCreateDialogOpen,
    formatRange,
  };
}
