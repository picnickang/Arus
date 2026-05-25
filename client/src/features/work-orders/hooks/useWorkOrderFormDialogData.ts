import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WorkOrder, MaintenanceTemplate } from "@shared/schema";
import {
  MAINTENANCE_TYPES,
  WORK_ORDER_FORM_STATUS_OPTIONS,
  WORK_ORDER_FORM_PRIORITY_OPTIONS,
} from "../constants";

export {
  MAINTENANCE_TYPES,
  WORK_ORDER_FORM_STATUS_OPTIONS as STATUS_OPTIONS,
  WORK_ORDER_FORM_PRIORITY_OPTIONS as PRIORITY_OPTIONS,
};

const workOrderFormSchema = z
  .object({
    vesselId: z.string().min(1, "Vessel is required"),
    equipmentId: z.string().min(1, "Equipment is required"),
    reason: z.string().min(1, "Reason is required"),
    description: z.string().optional(),
    priority: z.coerce.number().min(1).max(4).default(3),
    status: z.string().default("open"),
    maintenanceType: z.string().optional(),
    assignedCrewId: z.string().optional(),
    plannedStartDate: z.date().optional().nullable(),
    plannedEndDate: z.date().optional().nullable(),
    estimatedHours: z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
      z.number().min(0).optional()
    ),
    estimatedDowntimeHours: z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
      z.number().min(0).optional()
    ),
    affectsVesselDowntime: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.plannedStartDate && data.plannedEndDate) {
        return data.plannedEndDate >= data.plannedStartDate;
      }
      return true;
    },
    { message: "Planned end date must be on or after start date", path: ["plannedEndDate"] }
  );
export type WorkOrderFormData = z.infer<typeof workOrderFormSchema>;

interface UseWorkOrderFormDialogDataProps {
  open: boolean;
  mode: "create" | "edit";
  workOrder?: WorkOrder | null;
  defaultVesselId?: string;
  defaultEquipmentId?: string;
}
interface VesselItem {
  id: string;
  name: string;
}
interface EquipmentItem {
  id: string;
  name: string;
  vesselId: string;
  type?: string;
}
interface CrewMember {
  id: string;
  name: string;
  rank?: string;
  hourlyRate?: number;
}

const fetchVessels = () => apiRequest<VesselItem[]>("GET", "/api/vessels");
const fetchEquipment = () => apiRequest<EquipmentItem[]>("GET", "/api/equipment");
const fetchCrew = (vesselId?: string) =>
  vesselId
    ? apiRequest<CrewMember[]>("GET", `/api/crew?vessel_id=${vesselId}`)
    : apiRequest<CrewMember[]>("GET", "/api/crew");
const fetchTemplates = () =>
  apiRequest<MaintenanceTemplate[]>("GET", "/api/maintenance-templates?isActive=true");

export function useWorkOrderFormDialogData({
  open,
  mode,
  workOrder,
  defaultVesselId,
  defaultEquipmentId,
}: UseWorkOrderFormDialogDataProps) {
  const isEditMode = mode === "edit";
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const form = useForm<WorkOrderFormData, unknown, WorkOrderFormData>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues: {
      vesselId: "",
      equipmentId: "",
      reason: "",
      description: "",
      priority: 3,
      status: "open",
      maintenanceType: "",
      assignedCrewId: "",
      plannedStartDate: null,
      plannedEndDate: null,
      estimatedHours: undefined,
      estimatedDowntimeHours: undefined,
      affectsVesselDowntime: false,
    },
  });

  const selectedVesselId = form.watch("vesselId");
  const selectedEquipmentId = form.watch("equipmentId");

  const { data: vessels = [] } = useQuery({
    queryKey: ["/api/vessels"],
    queryFn: fetchVessels,
    refetchInterval: 60000,
  });
  const { data: allEquipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
    queryFn: fetchEquipment,
    refetchInterval: 60000,
  });
  const { data: crewMembers = [] } = useQuery({
    queryKey: ["/api/crew", selectedVesselId ? { vessel_id: selectedVesselId } : "all"],
    queryFn: () => fetchCrew(selectedVesselId),
    enabled: !!selectedVesselId,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["/api/maintenance-templates"],
    queryFn: fetchTemplates,
    enabled: !isEditMode,
  });

  const filteredEquipment = useMemo(() => {
    if (isEditMode) {
      return allEquipment;
    }
    return selectedVesselId
      ? allEquipment.filter((eq) => eq.vesselId === selectedVesselId)
      : allEquipment;
  }, [selectedVesselId, allEquipment, isEditMode]);
  const selectedEquipment = useMemo(
    () => allEquipment.find((eq) => eq.id === selectedEquipmentId),
    [allEquipment, selectedEquipmentId]
  );
  const filteredTemplates = useMemo(
    () =>
      selectedEquipment
        ? templates.filter(
            (t) =>
              t.isActive && t.equipmentType?.toLowerCase() === selectedEquipment.type?.toLowerCase()
          )
        : templates.filter((t) => t.isActive),
    [selectedEquipment, templates]
  );

  const clearTemplate = useCallback(() => {
    setSelectedTemplateId("");
    form.setValue("maintenanceType", "");
    form.setValue("reason", "");
    form.setValue("description", "");
    form.setValue("priority", 3);
    form.setValue("estimatedHours", undefined);
  }, [form]);
  const applyTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (!template) {
        setSelectedTemplateId("");
        return;
      }
      setSelectedTemplateId(templateId);
      form.setValue("maintenanceType", template.maintenanceType || "preventive");
      form.setValue(
        "reason",
        `${template.name} - ${template.maintenanceType || "Preventive"} Maintenance`
      );
      form.setValue("description", template.description || "");
      form.setValue("priority", template.priority || 3);
      if (template.estimatedDurationHours) {
        form.setValue("estimatedHours", template.estimatedDurationHours);
      }
    },
    [templates, form]
  );

  const vesselInferredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!open) {
      setSelectedTemplateId("");
      vesselInferredRef.current = false;
      return;
    }
    if (isEditMode && workOrder) {
      form.reset({
        vesselId: workOrder.vesselId || "",
        equipmentId: workOrder.equipmentId || "",
        reason: workOrder.reason || "",
        description: workOrder.description || "",
        priority: workOrder.priority || 3,
        status: workOrder.status || "open",
        maintenanceType: workOrder.maintenanceType || "",
        assignedCrewId: workOrder.assignedCrewId || "",
        plannedStartDate: workOrder.plannedStartDate ? new Date(workOrder.plannedStartDate) : null,
        plannedEndDate: workOrder.plannedEndDate ? new Date(workOrder.plannedEndDate) : null,
        estimatedHours: workOrder.estimatedHours || undefined,
        estimatedDowntimeHours: workOrder.estimatedDowntimeHours || undefined,
        affectsVesselDowntime: workOrder.affectsVesselDowntime || false,
      });
      vesselInferredRef.current = false;
    } else {
      form.reset({
        vesselId: defaultVesselId || "",
        equipmentId: defaultEquipmentId || "",
        reason: "",
        description: "",
        priority: 3,
        status: "open",
        maintenanceType: "",
        assignedCrewId: "",
        plannedStartDate: null,
        plannedEndDate: null,
        estimatedHours: undefined,
        estimatedDowntimeHours: undefined,
        affectsVesselDowntime: false,
      });
    }
  }, [open, isEditMode, workOrder, defaultVesselId, defaultEquipmentId, form]);

  useEffect(() => {
    if (!open || !isEditMode || !workOrder || vesselInferredRef.current) {
      return;
    }
    const currentVesselId = form.getValues("vesselId");
    if (currentVesselId) {
      return;
    }
    if (!workOrder.equipmentId || allEquipment.length === 0) {
      return;
    }
    const eq = allEquipment.find((e) => e.id === workOrder.equipmentId);
    if (eq?.vesselId) {
      form.setValue("vesselId", eq.vesselId);
      vesselInferredRef.current = true;
    }
  }, [open, isEditMode, workOrder, allEquipment, form]);

  useEffect(() => {
    if (!isEditMode && selectedVesselId) {
      const currentEquipmentId = form.getValues("equipmentId");
      const equipmentBelongsToVessel = filteredEquipment.some((eq) => eq.id === currentEquipmentId);
      if (!equipmentBelongsToVessel) {
        form.setValue("equipmentId", "");
        form.setValue("assignedCrewId", "");
      }
    }
  }, [selectedVesselId, filteredEquipment, isEditMode, form]);

  const prevEquipmentIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (isEditMode) {
      return;
    }
    const prevEquipmentId = prevEquipmentIdRef.current;
    prevEquipmentIdRef.current = selectedEquipmentId;
    if (
      prevEquipmentId !== undefined &&
      prevEquipmentId !== selectedEquipmentId &&
      selectedTemplateId
    ) {
      clearTemplate();
      return;
    }
    if (selectedTemplateId) {
      const templateStillValid = filteredTemplates.some((t) => t.id === selectedTemplateId);
      if (!templateStillValid) {
        clearTemplate();
      }
    }
  }, [selectedEquipmentId, selectedTemplateId, filteredTemplates, isEditMode, clearTemplate]);

  return {
    form,
    isEditMode,
    selectedVesselId,
    selectedEquipmentId,
    selectedTemplateId,
    vessels,
    filteredEquipment,
    crewMembers,
    filteredTemplates,
    applyTemplate,
    clearTemplate,
  };
}
