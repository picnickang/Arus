import { Clock, CheckCircle2, XCircle, Pause, Wrench, Building2 } from "lucide-react";

export const COLUMNS = [
  { key: "woNumber", label: "WO #", width: 120 },
  { key: "vessel", label: "Vessel", width: 140 },
  { key: "equipment", label: "Equipment", width: 180 },
  { key: "reason", label: "Reason", width: 220, flex: true },
  { key: "priority", label: "Priority", width: 100 },
  { key: "status", label: "Status", width: 130 },
  { key: "assignedTo", label: "Assigned To", width: 140 },
  { key: "dueDate", label: "Due Date", width: 110 },
  { key: "createdAt", label: "Created", width: 100 },
  { key: "actions", label: "Actions", width: 110 },
] as const;

export type ColumnConfig = (typeof COLUMNS)[number];

export const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; className: string }
> = {
  open: {
    label: "Open",
    icon: Clock,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  },
  in_progress: {
    label: "In Progress",
    icon: Wrench,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-800",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className:
      "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  },
  awaiting_service: {
    label: "Awaiting Service",
    icon: Building2,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  },
  deferred: {
    label: "Deferred",
    icon: Pause,
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  },
};

export const PRIORITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: {
    label: "High",
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-800",
  },
  2: {
    label: "Medium",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  },
  3: {
    label: "Low",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
  },
};

export const ROW_HEIGHT = 60;

export function getTotalWidth(): number {
  return COLUMNS.reduce((sum, col) => sum + col.width, 0);
}
