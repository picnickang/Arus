import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusType =
  | "healthy"
  | "warning"
  | "critical"
  | "active"
  | "inactive"
  | "online"
  | "offline"
  | "info"
  | "elevated"
  | "high"
  | "normal"
  | "failed"
  | "completed"
  | "in_progress"
  | "awaiting_service"
  | "pending"
  | "unknown";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    label: string;
    className?: string;
  }
> = {
  // Health statuses - Green for healthy, Amber for warning, Red for critical
  healthy: {
    variant: "secondary",
    label: "Healthy",
    className: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50",
  },
  normal: {
    variant: "secondary",
    label: "Normal",
    className: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50",
  },
  warning: {
    variant: "secondary",
    label: "Warning",
    className: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50",
  },
  elevated: {
    variant: "secondary",
    label: "Elevated",
    className: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50",
  },
  critical: { variant: "destructive", label: "Critical" },
  high: { variant: "destructive", label: "High" },
  failed: { variant: "destructive", label: "Failed" },

  // Equipment statuses - Primary for active, Gray for inactive
  active: { variant: "default", label: "Active" },
  inactive: { variant: "outline", label: "Inactive", className: "text-muted-foreground" },

  // Sensor statuses - Green for online, Red for offline
  online: {
    variant: "secondary",
    label: "Online",
    className: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50",
  },
  offline: { variant: "destructive", label: "Offline" },

  // Anomaly severities - Blue for info, Amber for elevated, Red for high
  info: {
    variant: "default",
    label: "Info",
    className: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/50",
  },

  // Work order statuses - Green for completed, Blue for in-progress, Gray for pending
  completed: {
    variant: "secondary",
    label: "Completed",
    className: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50",
  },
  in_progress: {
    variant: "secondary",
    label: "In Progress",
    className: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/50",
  },
  awaiting_service: {
    variant: "secondary",
    label: "Awaiting Service",
    className: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50",
  },
  pending: { variant: "outline", label: "Pending", className: "text-muted-foreground" },
  unknown: { variant: "outline", label: "Unknown", className: "text-muted-foreground" },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
      data-testid={`badge-status-${status}`}
    >
      {label || config.label}
    </Badge>
  );
}
