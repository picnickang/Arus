/**
 * Status + priority badge presentation maps for the work-order detail drawer.
 * Extracted from WorkOrderDetailDrawerParts.tsx to keep that file under the
 * long-file ceiling (the repo-wide Prettier reformat re-expanded it past 500).
 */
export const DEFAULT_STATUS_CONFIG = {
  label: "Open",
  className: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
};

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: DEFAULT_STATUS_CONFIG,
  in_progress: {
    label: "In Progress",
    className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  },
  completed: {
    label: "Completed",
    className: "bg-green-500/20 text-green-700 dark:text-green-300",
  },
  cancelled: { label: "Cancelled", className: "bg-gray-500/20 text-gray-700 dark:text-gray-300" },
  awaiting_service: {
    label: "Awaiting Service",
    className: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  },
  deferred: {
    label: "Deferred",
    className: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  },
};

export const DEFAULT_PRIORITY_CONFIG = {
  label: "Medium Priority",
  className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
};

export const PRIORITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: "Critical", className: "bg-red-500/20 text-red-700 dark:text-red-300" },
  2: { label: "High Priority", className: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
  3: DEFAULT_PRIORITY_CONFIG,
  4: { label: "Low Priority", className: "bg-green-500/20 text-green-700 dark:text-green-300" },
};
