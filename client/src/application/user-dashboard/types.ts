/**
 * View-model slot types shared between the React hook and the pure
 * derivers. Kept in a leaf module with zero runtime imports so jest's
 * node resolver can load them without pulling in @/-aliased code.
 */

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface CurrentVesselSlot {
  id: string;
  name: string;
}

export interface ActiveAlertSlot {
  id: string;
  title: string;
  severity: AlertSeverity;
  source?: string;
}

export interface SafetyNoticeSlot {
  id: string;
  title: string;
  postedAt?: string;
}

export interface UpcomingMaintenanceSlot {
  id: string;
  title: string;
  scheduledDate: Date;
  priority: "low" | "medium" | "high" | "critical";
}

export interface ShiftStatusSlot {
  label: string;
  windowLabel: string;
  remainingMinutes: number;
  progressPercent: number;
}
