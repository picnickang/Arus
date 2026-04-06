import { Badge } from "@/components/ui/badge";
import { SR_URGENCY_LABELS, SR_URGENCY_COLORS } from "../types";

interface SRPriorityBadgeProps {
  priority: string;
}

export function SRPriorityBadge({ priority }: SRPriorityBadgeProps) {
  return (
    <Badge className={SR_URGENCY_COLORS[priority] || "bg-gray-100 text-gray-700"} data-testid={`badge-sr-urgency-${priority}`}>
      {SR_URGENCY_LABELS[priority] || priority}
    </Badge>
  );
}
