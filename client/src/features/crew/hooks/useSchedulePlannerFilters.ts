import { addMonths, addWeeks } from "date-fns";
import type { DateRangePreset } from "./useSchedulePlannerDataTypes";

const STORAGE_KEY = "arus-schedule-planner-filters";

export function getDateRangeFromPreset(start: Date, preset: DateRangePreset): Date {
  switch (preset) {
    case "2w":
      return addWeeks(start, 2);
    case "1m":
      return addMonths(start, 1);
    case "3m":
      return addMonths(start, 3);
    default:
      return addWeeks(start, 2);
  }
}

export function loadPersistedFilters(): {
  vesselId: string | null;
  preset: DateRangePreset;
} | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return {
          vesselId: parsed.vesselId || null,
          preset: ["2w", "1m", "3m"].includes(parsed.preset) ? parsed.preset : "2w",
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function persistFilters(vesselId: string | null, preset: DateRangePreset) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ vesselId, preset }));
  } catch {
    // Ignore storage errors
  }
}
