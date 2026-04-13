import { z } from "zod";

export const updateWorkOrderSchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  estimatedCompletion: z.string().optional(),
  actualCompletion: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
  reason: z.string().optional(),
  description: z.string().optional(),
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
  maintenanceType: z.string().optional(),
  assignedCrewId: z.string().nullable().optional(),
  plannedStartDate: z.union([z.string(), z.date()]).nullable().optional(),
  plannedEndDate: z.union([z.string(), z.date()]).nullable().optional(),
  actualStartDate: z.union([z.string(), z.date()]).nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  estimatedDowntimeHours: z.number().nullable().optional(),
  affectsVesselDowntime: z.boolean().optional(),
  costJustification: z.string().nullable().optional(),
  actualHours: z.number().nullable().optional(),
  totalLaborCost: z.number().nullable().optional(),
  totalPartsCost: z.number().nullable().optional(),
  actualEndDate: z.union([z.string(), z.date()]).nullable().optional(),
  actualDowntimeHours: z.number().nullable().optional(),
});

export const updatePartSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  partNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  unitCost: z.number().min(0).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateStockSchema = z.object({
  quantityOnHand: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(0).optional(),
  location: z.string().optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updatePartSubstitutionSchema = z.object({
  isPreferred: z.boolean().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});
