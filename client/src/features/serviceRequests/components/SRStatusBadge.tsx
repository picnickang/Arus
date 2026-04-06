import { Badge } from "@/components/ui/badge";
import { SR_STATUS_LABELS, SR_STATUS_COLORS, type SRStatus } from "../types";

interface SRStatusBadgeProps {
  status: SRStatus;
}

export function SRStatusBadge({ status }: SRStatusBadgeProps) {
  return (
    <Badge className={SR_STATUS_COLORS[status] || "bg-gray-100 text-gray-700"} data-testid={`badge-sr-status-${status}`}>
      {SR_STATUS_LABELS[status] || status}
    </Badge>
  );
}
