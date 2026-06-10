import { z } from "zod";

/**
 * Offboarding (retire / cancel-contract) form schema for the crew lifecycle
 * dialog. Reason and end date are mandatory so every structured exit note
 * carries the minimum context; the booleans mirror the offboarding checklist
 * and the safe-offboarding toggles. Reinstate notes and the typed-confirm
 * delete intentionally stay outside this form.
 */
export const lifecycleOffboardSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
  endDate: z.string().min(1, "End date is required"),
  exitNotes: z.string().optional(),
  handoverDocs: z.boolean(),
  returnPpe: z.boolean(),
  finalPayroll: z.boolean(),
  applyPenalty: z.boolean(),
  disableLogin: z.boolean(),
  removeVesselAccess: z.boolean(),
  removeDashboardAccess: z.boolean(),
  removeAdditionalRoles: z.boolean(),
  downgradePrimaryRole: z.boolean(),
  endDutyStatus: z.boolean(),
});

export type LifecycleOffboardFormData = z.infer<typeof lifecycleOffboardSchema>;

/** Fresh values for each dialog open — the safe-offboarding actions start ON. */
export function createDefaultLifecycleOffboardValues(): LifecycleOffboardFormData {
  return {
    reason: "",
    endDate: "",
    exitNotes: "",
    handoverDocs: false,
    returnPpe: false,
    finalPayroll: false,
    applyPenalty: false,
    disableLogin: true,
    removeVesselAccess: true,
    removeDashboardAccess: true,
    removeAdditionalRoles: true,
    downgradePrimaryRole: true,
    endDutyStatus: true,
  };
}
