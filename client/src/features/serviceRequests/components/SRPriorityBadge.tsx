import { Badge } from "@/components/ui/badge";
import { SR_PRIORITY_LABELS, SR_PRIORITY_COLORS } from "../types";

interface SRPriorityBadgeProps {
  priority: string;
}

export function SRPriorityBadge({ priority }: SRPriorityBadgeProps) {
  return (
    <Badge className={SR_PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-700"} data-testid={`badge-sr-priority-${priority}`}>
      {SR_PRIORITY_LABELS[priority] || priority}
    </Badge>
  );
}
