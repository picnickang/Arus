/**
 * Legacy Hours-of-Rest planning utilities shim.
 */

export interface HoRContext {
  crewIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
  history: unknown[];
  summary: string;
}

export async function prepareCrewHoRContext(
  crewIds: string[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<HoRContext> {
  return {
    crewIds,
    rangeStart,
    rangeEnd,
    history: [],
    summary: "Hours-of-rest context unavailable (service not configured).",
  };
}

export function mergeHistoryWithPlan(
  history: unknown[],
  plan: unknown[]
): unknown[] {
  return [...history, ...plan];
}

export function summarizeHoRContext(_ctx: HoRContext): string {
  return "Hours-of-rest summary unavailable.";
}
