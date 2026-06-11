import { z } from "zod";

/**
 * Quick work order capture (QuickWorkOrderSheet → POST /api/work-orders/quick).
 * Photo stays component-local state — it is optional and never validated.
 */
export const quickWorkOrderSchema = z.object({
  equipmentId: z.string().min(1, "Equipment is required"),
  description: z
    .string()
    .min(1, "Description is required")
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, "Description is required"),
  priority: z.enum(["low", "medium", "high"]),
});

export type QuickWorkOrderData = z.infer<typeof quickWorkOrderSchema>;

export function quickWorkOrderDefaults(defaultEquipmentId?: string): QuickWorkOrderData {
  return {
    equipmentId: defaultEquipmentId || "",
    description: "",
    priority: "medium",
  };
}
