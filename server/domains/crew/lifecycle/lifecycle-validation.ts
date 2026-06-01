import { z } from "zod";

export const retireCrewSchema = z.object({
  notes: z.string().optional(),
  disableLogin: z.boolean().optional().default(true),
  removeVesselAccess: z.boolean().optional().default(true),
  removeDashboardAccess: z.boolean().optional().default(true),
  removeAdditionalRoles: z.boolean().optional().default(true),
  downgradePrimaryRole: z.boolean().optional().default(true),
  endDutyStatus: z.boolean().optional().default(true),
  preserveRecords: z.boolean().optional().default(true),
});

export const cancelCrewContractSchema = z.object({
  notes: z.string().optional().default(""),
  applyPenalty: z.boolean().optional().default(false),
  disableLogin: z.boolean().optional().default(true),
  removeVesselAccess: z.boolean().optional().default(true),
  removeDashboardAccess: z.boolean().optional().default(true),
  removeAdditionalRoles: z.boolean().optional().default(true),
  downgradePrimaryRole: z.boolean().optional().default(true),
  endDutyStatus: z.boolean().optional().default(true),
  preserveRecords: z.boolean().optional().default(true),
});

export const reinstateCrewSchema = z.object({
  startDate: z.string().datetime().optional(),
  reinstatedBy: z.string().optional(),
  notes: z.string().optional(),
});

export const bulkDeleteCrewSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one ID is required"),
});

export const updateEmploymentHistorySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  terminationType: z.enum(["retired", "cancelled"]).optional(),
  terminationNotes: z.string().optional(),
  contractPenalty: z.number().nullable().optional(),
  vesselId: z.string().nullable().optional(),
  rank: z.string().nullable().optional(),
});

export type RetireCrewInput = z.infer<typeof retireCrewSchema>;
export type CancelCrewContractInput = z.infer<typeof cancelCrewContractSchema>;
export type ReinstateCrewInput = z.infer<typeof reinstateCrewSchema>;
export type BulkDeleteCrewInput = z.infer<typeof bulkDeleteCrewSchema>;
export type UpdateEmploymentHistoryInput = z.infer<typeof updateEmploymentHistorySchema>;
