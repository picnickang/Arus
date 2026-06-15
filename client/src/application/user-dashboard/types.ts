/**
 * View-model slot types shared between the React hook and the pure
 * derivers. Kept in a leaf module with zero runtime imports so jest's
 * node resolver can load them without pulling in @/-aliased code.
 */

export type AlertSeverity = "low" | "medium" | "high" | "critical";

interface CurrentVesselSlot {
  id: string;
  name: string;
  /** IMO registration number, when the vessel record carries one. */
  imo?: string | undefined;
}

export interface ActiveAlertSlot {
  id: string;
  title: string;
  severity: AlertSeverity;
  source?: string | undefined;
  /** ISO timestamp the alert was raised — drives the "20m ago" subtext. */
  createdAt?: string | undefined;
}

export interface SafetyNoticeSlot {
  id: string;
  title: string;
  postedAt?: string | undefined;
}

/**
 * Headline safety posture for the user-portal "Safety Status" card.
 * Derived from the active safety bulletins (the real safety-bulletins
 * feed, GET /api/safety-bulletins) — NOT equipment alerts:
 *   - good     → no active bulletins (green "Good").
 *   - caution  → active bulletins exist, none critical (amber).
 *   - critical → at least one critical bulletin (red).
 */
export type SafetyStatusLevel = "good" | "caution" | "critical";

export interface SafetyStatusSlot {
  level: SafetyStatusLevel;
  label: string;
  /** Count of active safety bulletins contributing to the status. */
  activeCount: number;
}

/** Day grouping for an assigned task, relative to "now". */
export type TaskDayPill = "today" | "tomorrow" | "overdue" | null;

export interface MyTaskSlot {
  id: string;
  title: string;
  equipmentName?: string | undefined;
  dueDate?: string | null;
  priority?: number | undefined;
  dayPill: TaskDayPill;
}

/**
 * Headline counts for the user-portal "Today's Overview" completion
 * tile. Derived from all work orders assigned to the user (every
 * status), with cancelled/terminal-non-completed rows excluded from
 * both `active` and the completion math so the numbers stay honest:
 *   - active        → assigned work that is neither completed nor cancelled.
 *   - completed     → assigned work in a terminal "done" state.
 *   - total         → active + completed (the completion denominator).
 *   - completionPct → completed / total, rounded; 0 when no tasks.
 */
export interface AssignedSummary {
  active: number;
  completed: number;
  total: number;
  completionPct: number;
}

interface UpcomingMaintenanceSlot {
  id: string;
  title: string;
  scheduledDate: Date;
  priority: "low" | "medium" | "high" | "critical";
}

/**
 * Where the shift window came from:
 *   - "configured": a real shift template returned by GET /api/shifts
 *     (the crew shift-template registry) — the user's vessel-scoped
 *     window, or an org-wide template with no vessel binding.
 *   - "fallback": no template exists in the backend, so the card shows
 *     a clock-derived default 12-hour window as a visual cue only.
 */
export type ShiftStatusSource = "configured" | "fallback";

export interface ShiftStatusSlot {
  label: string;
  windowLabel: string;
  remainingMinutes: number;
  progressPercent: number;
  /** Human date for the current shift, e.g. "Sat, 30 May". */
  dateLabel: string;
  /** Whether the window is backend-configured or a clock-derived default. */
  source: ShiftStatusSource;
}
