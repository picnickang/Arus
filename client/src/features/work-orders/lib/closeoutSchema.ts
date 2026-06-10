import { z } from "zod";

/**
 * Closeout form contract (WorkOrderCloseoutWizard). Fields validate in place
 * (form input type = output type, as the shared FormField typing requires);
 * `parseCloseout` converts the validated values to the persisted shape —
 * trimmed strings and `number | null` hours (empty/unparseable → null,
 * matching the wizard's previous toNumberOrNull).
 */

const requiredText = (message: string) => z.string().refine((v) => v.trim().length > 0, message);

const hoursText = z
  .string()
  .refine((v) => v.trim() === "" || Number.isFinite(Number(v)), "Enter a number — e.g. 1.5")
  .refine((v) => v.trim() === "" || Number(v) >= 0, "Hours cannot be negative");

const mustBeChecked = (message: string) => z.boolean().refine((v) => v, message);

export function makeCloseoutSchema(isPredictive: boolean) {
  return z.object({
    workPerformed: requiredText("Work performed is required"),
    causeFound: requiredText("Cause found is required"),
    partsUsed: z.string(),
    laborHours: hoursText,
    downtimeHours: hoursText,
    evidenceNote: requiredText("Evidence is required"),
    checklistVerified: mustBeChecked("Confirm the checklist before closing"),
    supervisorVerified: mustBeChecked("Supervisor verification is required"),
    hasPredictionFeedback: z
      .boolean()
      .refine((v) => !isPredictive || v, "Record the PdM outcome before closing"),
  });
}

export type CloseoutFormValues = z.infer<ReturnType<typeof makeCloseoutSchema>>;

/** Persisted closeout shape (trimmed strings, numeric hours). */
export interface CloseoutParsed {
  workPerformed: string;
  causeFound: string;
  partsUsed: string;
  laborHours: number | null;
  downtimeHours: number | null;
  evidenceNote: string;
  checklistVerified: boolean;
  supervisorVerified: boolean;
}

function toNumberOrNull(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
}

export function parseCloseout(values: CloseoutFormValues): CloseoutParsed {
  return {
    workPerformed: values.workPerformed.trim(),
    causeFound: values.causeFound.trim(),
    partsUsed: values.partsUsed.trim(),
    laborHours: toNumberOrNull(values.laborHours),
    downtimeHours: toNumberOrNull(values.downtimeHours),
    evidenceNote: values.evidenceNote.trim(),
    checklistVerified: values.checklistVerified,
    supervisorVerified: values.supervisorVerified,
  };
}

export const CLOSEOUT_DEFAULTS: CloseoutFormValues = {
  workPerformed: "",
  causeFound: "",
  partsUsed: "",
  laborHours: "",
  downtimeHours: "",
  evidenceNote: "",
  checklistVerified: false,
  supervisorVerified: false,
  hasPredictionFeedback: false,
};
