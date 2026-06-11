import { Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignmentStatusBadgeProps {
  status?: string | null;
  assignedTo?: string | null;
  className?: string;
  testId?: string;
}

const CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  assigned: {
    label: "Awaiting response",
    icon: Clock,
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  accepted: {
    label: "Accepted",
    icon: Check,
    className: "bg-green-500/15 text-green-600 dark:text-green-400",
  },
  declined: {
    label: "Declined",
    icon: X,
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
};

/**
 * Small badge that surfaces the two-sided assignment acknowledgement
 * (assigned/accepted/declined) so supervisors can see whether the assignee
 * has responded. Renders nothing when there is no assignment status or when
 * the work order was never assigned to a crew member.
 */
export function AssignmentStatusBadge({
  status,
  assignedTo,
  className,
  testId,
}: AssignmentStatusBadgeProps) {
  if (!status || !assignedTo) {
    return null;
  }
  const config = CONFIG[status];
  if (!config) {
    return null;
  }
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        config.className,
        className
      )}
      data-testid={testId}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export default AssignmentStatusBadge;
