import { Progress } from "@/components/ui/progress";
import type { SOStatus } from "../types";

const STATUS_PROGRESS: Record<SOStatus, number> = {
  draft: 0,
  sent: 20,
  confirmed: 40,
  in_progress: 70,
  completed: 100,
  cancelled: 0,
};

interface SOProgressBarProps {
  status: SOStatus;
  className?: string;
}

export function SOProgressBar({ status, className = "" }: SOProgressBarProps) {
  const progress = STATUS_PROGRESS[status];
  const isCancelled = status === "cancelled";

  return (
    <div className={`space-y-1 ${className}`} data-testid="so-progress-bar">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{isCancelled ? "Cancelled" : `${progress}% Complete`}</span>
        {!isCancelled && <span>{status.replace("_", " ").toUpperCase()}</span>}
      </div>
      <Progress
        value={isCancelled ? 0 : progress}
        className={isCancelled ? "bg-red-200 dark:bg-red-900" : ""}
      />
    </div>
  );
}
