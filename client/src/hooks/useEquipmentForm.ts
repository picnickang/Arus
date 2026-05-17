// @ts-nocheck
import { useForm, UseFormReturn } from "react-hook-form";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEquipmentSchema, InsertEquipment, Equipment } from "@shared/schema";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useEquipmentForm(
  defaultValues?: Partial<InsertEquipment>
): UseFormReturn<InsertEquipment> {
  const { currentOrgId } = useOrganization();

  return useForm<InsertEquipment>({
    resolver: zodResolver(insertEquipmentSchema),
    defaultValues: {
      orgId: currentOrgId || "",
      name: "",
      type: "",
      manufacturer: "",
      model: "",
      serialNumber: "",
      location: "",
      vesselId: "",
      vesselName: "",
      isActive: true,
      specifications: null,
      operatingParameters: null,
      maintenanceSchedule: null,
      purchaseValue: undefined,
      purchaseDate: undefined,
      purchaseCurrency: "USD",
      serviceLifeHours: undefined,
      serviceLifeYears: undefined,
      depreciationMethod: "straight_line",
      depreciationRate: undefined,
      salvageValue: undefined,
      ...defaultValues,
    },
  });
}

export function useEquipmentEditForm(
  equipment?: Equipment | null
): UseFormReturn<InsertEquipment> {
  const { currentOrgId } = useOrganization();
  const form = useForm<InsertEquipment>({
    resolver: zodResolver(insertEquipmentSchema),
    defaultValues: {
      orgId: currentOrgId || "",
      name: "",
      type: "",
      manufacturer: "",
      model: "",
      serialNumber: "",
      location: "",
      vesselId: "unassigned",
      vesselName: "",
      isActive: true,
      specifications: null,
      operatingParameters: null,
      maintenanceSchedule: null,
      purchaseValue: undefined,
      purchaseDate: undefined,
      purchaseCurrency: "USD",
      serviceLifeHours: undefined,
      serviceLifeYears: undefined,
      depreciationMethod: "straight_line",
      depreciationRate: undefined,
      salvageValue: undefined,
    },
  });

  // Reset form when equipment changes (using useEffect to avoid render-time side effects)
  useEffect(() => {
    if (equipment) {
      form.reset({
        orgId: equipment.orgId || currentOrgId || "",
        name: equipment.name,
        type: equipment.type,
        manufacturer: equipment.manufacturer || "",
        model: equipment.model || "",
        serialNumber: equipment.serialNumber || "",
        location: equipment.location || "",
        vesselId: equipment.vesselId || "unassigned",
        vesselName: equipment.vesselName || "",
        isActive: equipment.isActive,
        purchaseValue: equipment.purchaseValue ?? undefined,
        purchaseDate: equipment.purchaseDate
          ? typeof equipment.purchaseDate === "string"
            ? equipment.purchaseDate
            : new Date(equipment.purchaseDate).toISOString()
          : undefined,
        purchaseCurrency: equipment.purchaseCurrency || "USD",
        serviceLifeHours: equipment.serviceLifeHours ?? undefined,
        serviceLifeYears: equipment.serviceLifeYears ?? undefined,
        depreciationMethod: equipment.depreciationMethod || "straight_line",
        depreciationRate: equipment.depreciationRate ?? undefined,
        salvageValue: equipment.salvageValue ?? undefined,
      });
    }
  }, [currentOrgId, equipment, form]);

  return form;
}

/**
 * Prepare equipment data for submission
 * Converts "unassigned" back to null for vesselId
 */
export function prepareEquipmentSubmission(data: InsertEquipment | Partial<InsertEquipment>) {
  return {
    ...data,
    vesselId: data.vesselId === "unassigned" ? undefined : data.vesselId,
  };
}
