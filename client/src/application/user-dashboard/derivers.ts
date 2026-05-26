/**
 * Pure derivers extracted from the user-dashboard view model so they
 * can be unit-tested without importing React, TanStack Query, or any
 * `@/`-aliased module. The view-model re-exports these untouched.
 */

import type {
  ActiveAlertSlot,
  AlertSeverity,
  SafetyNoticeSlot,
  ShiftStatusSlot,
} from "./types";

interface RawAlert {
  id: string;
  title?: string | null;
  message?: string | null;
  severity?: string | null;
  acknowledged?: boolean | null;
  category?: string | null;
  source?: string | null;
  equipmentName?: string | null;
  createdAt?: string | null;
}

export function deriveAlertSlots(rows: RawAlert[]): {
  activeAlerts: ActiveAlertSlot[];
  safetyNotices: SafetyNoticeSlot[];
} {
  const unacknowledged = rows.filter((r) => r.acknowledged !== true);

  const safety = unacknowledged
    .filter((r) => (r.category ?? "").toLowerCase() === "safety")
    .slice(0, 3)
    .map<SafetyNoticeSlot>((r) => ({
      id: r.id,
      title: r.title ?? r.message ?? "Safety notice",
      postedAt: r.createdAt ?? undefined,
    }));

  const active = unacknowledged
    .filter((r) => (r.category ?? "").toLowerCase() !== "safety")
    .slice(0, 4)
    .map<ActiveAlertSlot>((r) => ({
      id: r.id,
      title: r.title ?? r.message ?? "Unnamed alert",
      severity: normaliseSeverity(r.severity),
      source: r.equipmentName ?? r.source ?? undefined,
    }));

  return { activeAlerts: active, safetyNotices: safety };
}

function normaliseSeverity(raw: string | null | undefined): AlertSeverity {
  switch ((raw ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
    case "warning":
      return "medium";
    default:
      return "low";
  }
}

export function deriveShiftStatus(now: Date): ShiftStatusSlot {
  const SHIFT_START_HOUR = 8;
  const SHIFT_END_HOUR = 20;
  const minutesInShift = (SHIFT_END_HOUR - SHIFT_START_HOUR) * 60;

  const minutesIntoDay = now.getHours() * 60 + now.getMinutes();
  const minutesFromStart = minutesIntoDay - SHIFT_START_HOUR * 60;

  if (minutesFromStart < 0 || minutesFromStart >= minutesInShift) {
    return {
      label: "Off duty",
      windowLabel: "08:00 – 20:00",
      remainingMinutes: 0,
      progressPercent: 0,
    };
  }

  const remaining = minutesInShift - minutesFromStart;
  return {
    label: "On duty",
    windowLabel: "08:00 – 20:00",
    remainingMinutes: remaining,
    progressPercent: Math.round((minutesFromStart / minutesInShift) * 100),
  };
}
