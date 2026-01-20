import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { StatusBadge, StatusType } from "./StatusBadge";

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  status?: StatusType;
  normalizedValue?: number; // 0-100 for progress bar
  timestamp?: Date | string;
  icon?: React.ReactNode;
  thresholds?: {
    warning?: number;
    critical?: number;
  };
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  status,
  normalizedValue,
  timestamp,
  icon,
  thresholds,
  className,
}: MetricCardProps) {
  const statusClassName = cn(
    "p-4 transition-colors",
    status === "critical" && "border-destructive bg-destructive/10",
    status === "warning" && "border-amber-500 bg-amber-500/10",
    status === "elevated" && "border-amber-500 bg-amber-500/10"
  );

  return (
    <Card
      className={cn(statusClassName, className)}
      data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      <div className="mb-2">
        <p
          className="text-2xl font-bold"
          data-testid={`metric-value-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {value}
          {unit && <span className="text-lg text-muted-foreground ml-1">{unit}</span>}
        </p>
      </div>

      {normalizedValue !== undefined && (
        <div className="mb-2">
          <Progress
            value={normalizedValue}
            className={cn(
              status === "critical" && "[&>div]:bg-destructive",
              status === "warning" && "[&>div]:bg-amber-500",
              status === "elevated" && "[&>div]:bg-amber-500"
            )}
          />
        </div>
      )}

      {timestamp && (
        <p className="text-xs text-muted-foreground" data-testid="metric-timestamp">
          Last reading: {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </p>
      )}

      {thresholds && (
        <div className="text-xs text-muted-foreground mt-2 space-y-1">
          {thresholds.warning !== undefined && (
            <div className="flex justify-between">
              <span>Warning:</span>
              <span className="font-medium">
                {thresholds.warning}
                {unit}
              </span>
            </div>
          )}
          {thresholds.critical !== undefined && (
            <div className="flex justify-between">
              <span>Critical:</span>
              <span className="font-medium text-destructive">
                {thresholds.critical}
                {unit}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
