import { z } from "zod";

export const homeAttentionSummaryResponseSchema = z.object({
  overdueWorkOrders: z.number().int().nonnegative(),
  unacknowledgedAlerts: z.number().int().nonnegative(),
  highRiskEquipment: z.number().int().nonnegative(),
  newSinceLastVisit: z
    .object({
      newAlerts: z.number().int().nonnegative(),
      newWorkOrders: z.number().int().nonnegative(),
      completedWorkOrders: z.number().int().nonnegative(),
    })
    .optional(),
});

export type HomeAttentionSummaryResponse = z.infer<typeof homeAttentionSummaryResponseSchema>;
