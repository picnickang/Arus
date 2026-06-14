import { z } from "zod";
import {
  decommissionReasonEnum,
  decommissionStatusEnum,
  saleDetailsSchema,
  disposalDetailsSchema,
} from "@shared/schema/equipment";

export const decommissionEquipmentSchema = z.object({
  reason: decommissionReasonEnum,
  status: decommissionStatusEnum.optional().default("decommissioned"),
  authorizedBy: z.string().optional(),
  finalCondition: z.string().optional(),
  notes: z.string().optional(),
  saleDetails: saleDetailsSchema.optional(),
  disposalDetails: disposalDetailsSchema.optional(),
  replacementEquipmentId: z.string().uuid().optional(),
  bookValueAtRemoval: z.number().optional(),
  residualValue: z.number().optional(),
  documentationRefs: z.array(z.string()).optional(),
});

export const reinstateEquipmentSchema = z.object({
  reinstatedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type DecommissionEquipmentInput = z.infer<typeof decommissionEquipmentSchema>;
export type ReinstateEquipmentInput = z.infer<typeof reinstateEquipmentSchema>;
