import { Badge } from "@/components/ui/badge";
import { SO_STATUS_LABELS, SO_STATUS_COLORS, type SOStatus } from "../types";

interface SOStatusBadgeProps {
  status: SOStatus;
  className?: string;
}

export function SOStatusBadge({ status, className = "" }: SOStatusBadgeProps) {
  return (
    <Badge
      className={`${SO_STATUS_COLORS[status]} ${className}`}
      data-testid={`badge-so-status-${status}`}
    >
      {SO_STATUS_LABELS[status]}
    </Badge>
  );
}
