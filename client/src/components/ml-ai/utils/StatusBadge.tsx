import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusType =
  | "active"
  | "deployed"
  | "training"
  | "pending"
  | "configured"
  | "not-configured"
  | "archived"
  | "critical"
  | "warning"
  | "normal"
  | "offline";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  "data-testid"?: string;
}

const statusConfig: Record<StatusType, { color: string; defaultLabel: string }> = {
  active: { color: "bg-green-500 hover:bg-green-600", defaultLabel: "Active" },
  deployed: { color: "bg-green-500 hover:bg-green-600", defaultLabel: "Deployed" },
  training: { color: "bg-blue-500 hover:bg-blue-600", defaultLabel: "Training" },
  pending: { color: "bg-yellow-500 hover:bg-yellow-600", defaultLabel: "Pending" },
  configured: { color: "bg-blue-500 hover:bg-blue-600", defaultLabel: "Configured" },
  "not-configured": { color: "bg-gray-400 hover:bg-gray-500", defaultLabel: "Not Configured" },
  archived: { color: "bg-gray-400 hover:bg-gray-500", defaultLabel: "Archived" },
  critical: { color: "bg-red-500 hover:bg-red-600", defaultLabel: "Critical" },
  warning: { color: "bg-orange-500 hover:bg-orange-600", defaultLabel: "Warning" },
  normal: { color: "bg-green-500 hover:bg-green-600", defaultLabel: "Normal" },
  offline: { color: "bg-gray-400 hover:bg-gray-500", defaultLabel: "Offline" },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

export function StatusBadge({
  status,
  label,
  size = "md",
  className,
  "data-testid": testId,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.defaultLabel;

  return (
    <Badge
      className={cn(config.color, sizeClasses[size], "text-white font-medium", className)}
      data-testid={testId || `badge-${status}`}
    >
      {displayLabel}
    </Badge>
  );
}
