import { z } from "zod";

export const updateWorkOrderSchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  estimatedCompletion: z.string().max(64).optional(),
  actualCompletion: z.string().max(64).optional(),
  notes: z.string().max(4000).optional(),
  assignedTo: z.string().max(128).optional(),
  reason: z.string().max(2000).optional(),
  description: z.string().max(4000).optional(),
  vesselId: z.string().max(64).optional(),
  equipmentId: z.string().max(64).optional(),
  maintenanceType: z.string().max(64).optional(),
  assignedCrewId: z.string().max(64).nullable().optional(),
  plannedStartDate: z.union([z.string(), z.date()]).nullable().optional(),
  plannedEndDate: z.union([z.string(), z.date()]).nullable().optional(),
  actualStartDate: z.union([z.string(), z.date()]).nullable().optional(),
  estimatedHours: z.number().finite().min(0).max(100000).nullable().optional(),
  estimatedDowntimeHours: z.number().finite().min(0).max(100000).nullable().optional(),
  affectsVesselDowntime: z.boolean().optional(),
  costJustification: z.string().max(2000).nullable().optional(),
  actualHours: z.number().finite().min(0).max(100000).nullable().optional(),
  totalLaborCost: z.number().finite().min(0).nullable().optional(),
  totalPartsCost: z.number().finite().min(0).nullable().optional(),
  actualEndDate: z.union([z.string(), z.date()]).nullable().optional(),
  actualDowntimeHours: z.number().finite().min(0).max(100000).nullable().optional(),
});

export const updatePartSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional(),
  partNumber: z.string().max(128).optional(),
  manufacturer: z.string().max(256).optional(),
  unitCost: z.number().finite().min(0).max(1e9).optional(),
  category: z.string().max(128).optional(),
  isActive: z.boolean().optional(),
});

export const updateStockSchema = z.object({
  quantityOnHand: z.number().int().min(0).max(1e9).optional(),
  reorderPoint: z.number().int().min(0).max(1e9).optional(),
  reorderQuantity: z.number().int().min(0).max(1e9).optional(),
  location: z.string().max(256).optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  contactName: z.string().max(256).optional(),
  contactEmail: z.string().email().max(320).optional(),
  contactPhone: z.string().max(64).optional(),
  address: z.string().max(1024).optional(),
  isActive: z.boolean().optional(),
});

export const updatePartSubstitutionSchema = z.object({
  isPreferred: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});
