import { Badge } from "@/components/ui/badge";
import type { PRStatus } from "../types";
import { PR_STATUS_LABELS, PR_STATUS_COLORS } from "../types";

interface PRStatusBadgeProps {
  status: PRStatus;
}

export function PRStatusBadge({ status }: PRStatusBadgeProps) {
  return (
    <Badge className={PR_STATUS_COLORS[status]} data-testid={`badge-pr-status-${status}`}>
      {PR_STATUS_LABELS[status]}
    </Badge>
  );
}
