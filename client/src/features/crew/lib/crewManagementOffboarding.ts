export type RehireStatusKey = "rehire_ok" | "review" | "no_rehire";

export interface RehireStatus {
  key: RehireStatusKey;
  label: string;
}

export interface FormerEmploymentLike {
  terminationType: "retired" | "cancelled" | null;
  contractPenalty: number | null;
  endDate?: string | null;
  vesselId?: string | null;
  rank?: string | null;
}

export function deriveRehireStatus(latestPeriod: FormerEmploymentLike | undefined): RehireStatus {
  const terminationType = latestPeriod?.terminationType ?? null;
  const penalty = latestPeriod?.contractPenalty ?? 0;
  if (terminationType === "retired") {
    return { key: "rehire_ok", label: "Rehire OK" };
  }
  if (terminationType === "cancelled" && penalty > 0) {
    return { key: "no_rehire", label: "No rehire" };
  }
  return { key: "review", label: "Review" };
}

export const OFFBOARD_REASONS = [
  { value: "end_of_contract", label: "End of contract" },
  { value: "resignation", label: "Resignation" },
  { value: "performance", label: "Performance" },
  { value: "medical", label: "Medical" },
  { value: "redundancy", label: "Redundancy" },
  { value: "contract_breach", label: "Contract breach" },
  { value: "other", label: "Other" },
] as const;

export function offboardReasonLabel(value?: string | null): string {
  if (!value) {
    return "";
  }
  return OFFBOARD_REASONS.find((r) => r.value === value)?.label ?? value;
}

export function previewRehireFromAction(
  action: string,
  effectivePenalty: number
): RehireStatus | null {
  if (action === "retire") {
    return deriveRehireStatus({ terminationType: "retired", contractPenalty: null });
  }
  if (action === "cancel") {
    return deriveRehireStatus({
      terminationType: "cancelled",
      contractPenalty: effectivePenalty,
    });
  }
  return null;
}

export interface OffboardingNoteInput {
  reason?: string | null;
  endDate?: string | null;
  vesselName?: string | null | undefined;
  handoverDocs?: boolean;
  returnPpe?: boolean;
  finalPayroll?: boolean;
  exitNotes?: string | null | undefined;
}

export function composeOffboardingNote(input: OffboardingNoteInput): string | undefined {
  const lines: string[] = [];
  if (input.reason) {
    lines.push(`Reason: ${offboardReasonLabel(input.reason)}`);
  }
  if (input.endDate) {
    lines.push(`End date: ${input.endDate}`);
  }
  if (input.vesselName) {
    lines.push(`Final vessel: ${input.vesselName}`);
  }
  const checklist = [
    input.handoverDocs && "Handed over documents",
    input.returnPpe && "Returned PPE / access card",
    input.finalPayroll && "Final payroll settled",
  ].filter(Boolean) as string[];
  if (checklist.length > 0) {
    lines.push(`Checklist: ${checklist.join("; ")}`);
  }
  const trimmedExit = input.exitNotes?.trim();
  if (trimmedExit) {
    lines.push(`Exit notes: ${trimmedExit}`);
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}
