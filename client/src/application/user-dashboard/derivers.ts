/**
 * Pure derivers extracted from the user-dashboard view model so they
 * can be unit-tested without importing React, TanStack Query, or any
 * `@/`-aliased module. The view-model re-exports these untouched.
 */

import type {
  ActiveAlertSlot,
  AlertSeverity,
  MyTaskSlot,
  SafetyNoticeSlot,
  SafetyStatusSlot,
  ShiftStatusSlot,
  ShiftStatusSource,
  TaskDayPill,
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
      createdAt: r.createdAt ?? undefined,
    }));

  return { activeAlerts: active, safetyNotices: safety };
}

/**
 * Headline safety posture from the active (unacknowledged) safety-
 * categorised alerts. Used by the "Safety Status" card.
 */
export function deriveSafetyStatus(rows: RawAlert[]): SafetyStatusSlot {
  const safety = rows.filter(
    (r) =>
      r.acknowledged !== true &&
      (r.category ?? "").toLowerCase() === "safety",
  );

  if (safety.length === 0) {
    return { level: "good", label: "Good", activeCount: 0 };
  }

  const hasSevere = safety.some((r) => {
    const sev = normaliseSeverity(r.severity);
    return sev === "high" || sev === "critical";
  });

  return hasSevere
    ? { level: "critical", label: "Action required", activeCount: safety.length }
    : { level: "caution", label: "Caution", activeCount: safety.length };
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

export interface RawShiftTemplate {
  id: string;
  role?: string | null;
  start?: string | null;
  end?: string | null;
  durationH?: number | null;
  vesselId?: string | null;
}

const DEFAULT_SHIFT_START_MIN = 8 * 60;
const DEFAULT_SHIFT_END_MIN = 20 * 60;
const MINUTES_PER_DAY = 24 * 60;

/**
 * Current-shift status for the "My Shift" card.
 *
 * Reads the real shift-template registry (`GET /api/shifts` →
 * `templates`) and resolves the window for the user's vessel (or an
 * org-wide template with no vessel binding). The on-duty flag, window
 * label, remaining time, and progress are all computed against that
 * configured window. A clock-derived default 12-hour window is used as
 * a fallback ONLY when the backend has no shift template at all — the
 * returned slot's `source` discriminates the two cases so the UI can
 * mark the fallback as an estimate. This card is a visual cue only and
 * is never used for compliance reporting.
 */
export function deriveShiftStatus(
  now: Date,
  templates: RawShiftTemplate[] = [],
  vesselId?: string,
): ShiftStatusSlot {
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const minutesIntoDay = now.getHours() * 60 + now.getMinutes();

  const parsed = templates
    .map((t) => ({
      startMin: parseClockToMinutes(t.start),
      endMin: parseClockToMinutes(t.end),
      vesselId: t.vesselId ?? null,
    }))
    .filter(
      (t): t is { startMin: number; endMin: number; vesselId: string | null } =>
        t.startMin !== null && t.endMin !== null && t.startMin !== t.endMin,
    );

  // Prefer windows bound to the user's vessel (plus org-wide windows
  // with no vessel binding); fall back to every parsed template only if
  // none are scoped to this vessel.
  const scoped = vesselId
    ? parsed.filter((t) => t.vesselId === vesselId || t.vesselId === null)
    : parsed;
  const usable = scoped.length > 0 ? scoped : parsed;

  if (usable.length === 0) {
    return buildShiftSlot(
      minutesIntoDay,
      DEFAULT_SHIFT_START_MIN,
      DEFAULT_SHIFT_END_MIN,
      dateLabel,
      "fallback",
    );
  }

  // A window the user is currently inside wins; otherwise show the
  // first configured window as the next/most-recent shift.
  const active = usable.find((t) =>
    isWithinShift(minutesIntoDay, t.startMin, t.endMin),
  );
  const chosen = active ?? usable[0];
  return buildShiftSlot(
    minutesIntoDay,
    chosen.startMin,
    chosen.endMin,
    dateLabel,
    "configured",
  );
}

/** Parse "HH:MM" (or "H:MM", "HHMM") into minutes-into-day, or null. */
function parseClockToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d{1,2})\s*:?\s*(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatWindow(startMin: number, endMin: number): string {
  return `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)} – ${pad2(
    Math.floor(endMin / 60),
  )}:${pad2(endMin % 60)}`;
}

/** True when `minutesIntoDay` is inside [start, end), handling overnight. */
function isWithinShift(
  minutesIntoDay: number,
  startMin: number,
  endMin: number,
): boolean {
  if (endMin > startMin) {
    return minutesIntoDay >= startMin && minutesIntoDay < endMin;
  }
  // Overnight shift spanning midnight (e.g. 20:00 – 08:00).
  return minutesIntoDay >= startMin || minutesIntoDay < endMin;
}

function buildShiftSlot(
  minutesIntoDay: number,
  startMin: number,
  endMin: number,
  dateLabel: string,
  source: ShiftStatusSource,
): ShiftStatusSlot {
  const windowLabel = formatWindow(startMin, endMin);
  const total =
    endMin > startMin ? endMin - startMin : MINUTES_PER_DAY - startMin + endMin;

  if (!isWithinShift(minutesIntoDay, startMin, endMin)) {
    return {
      label: "Off duty",
      windowLabel,
      remainingMinutes: 0,
      progressPercent: 0,
      dateLabel,
      source,
    };
  }

  const elapsed =
    minutesIntoDay >= startMin
      ? minutesIntoDay - startMin
      : MINUTES_PER_DAY - startMin + minutesIntoDay;
  const remaining = Math.max(0, total - elapsed);
  return {
    label: "On duty",
    windowLabel,
    remainingMinutes: remaining,
    progressPercent: total > 0 ? Math.round((elapsed / total) * 100) : 0,
    dateLabel,
    source,
  };
}

interface RawWorkOrder {
  id: string;
  title?: string | null;
  priority?: number | null;
  dueDate?: string | null;
  equipmentName?: string | null;
  vesselName?: string | null;
  equipment?: { name?: string | null } | null;
}

/**
 * Group the user's open work orders into task rows with a Today /
 * Tomorrow / Overdue day pill, relative to `now`. Pure so the day-pill
 * boundary logic is unit-testable.
 */
export function deriveMyTasks(rows: RawWorkOrder[], now: Date): MyTaskSlot[] {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  return rows.slice(0, 5).map<MyTaskSlot>((r) => ({
    id: r.id,
    title: r.title ?? "Untitled task",
    equipmentName: r.equipmentName ?? r.equipment?.name ?? undefined,
    dueDate: r.dueDate ?? null,
    priority: r.priority ?? undefined,
    dayPill: dayPillFor(r.dueDate, startOfToday, ONE_DAY),
  }));
}

function dayPillFor(
  dueDate: string | null | undefined,
  startOfToday: number,
  oneDay: number,
): TaskDayPill {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const startOfDue = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  ).getTime();
  const diffDays = Math.round((startOfDue - startOfToday) / oneDay);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return null;
}
