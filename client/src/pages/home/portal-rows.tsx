import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { MyTaskSlot } from "@/application/user-dashboard/user-dashboard-view-model";

function dueLabelForTask(task: MyTaskSlot): string {
  if (task.dayPill === "overdue") {
    return "Overdue";
  }
  if (task.dayPill === "today") {
    return "Due today";
  }
  if (task.dayPill === "tomorrow") {
    return "Due tomorrow";
  }
  return "No due date";
}

function dueDotToneForTask(task: MyTaskSlot): string {
  if (task.dayPill === "overdue") {
    return "bg-rose-400";
  }
  if (task.dayPill === "today") {
    return "bg-amber-400";
  }
  return "bg-sky-400";
}

export function OverviewTile({
  icon: Icon,
  label,
  value,
  tone,
  loading,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: string;
  loading: boolean;
  testId: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] p-3 text-center"
      data-testid={testId}
    >
      <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-5 w-5" />
      </span>
      {loading ? (
        <Skeleton className="h-6 w-8" />
      ) : (
        <span
          className="text-xl font-bold leading-none tabular-nums text-foreground"
          data-testid={`${testId}-value`}
        >
          {value}
        </span>
      )}
      <span className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

export function AssignedTaskRow({
  task,
  onOpen,
}: {
  task: MyTaskSlot;
  onOpen: (id: string) => void;
}) {
  const overdue = task.dayPill === "overdue";
  const dueLabel = dueLabelForTask(task);
  const dotTone = dueDotToneForTask(task);
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      data-testid={`row-assigned-task-${task.id}`}
      className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotTone)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{task.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{dueLabel}</span>
          {task.equipmentName && (
            <>
              <span className="opacity-50">•</span>
              <span className="truncate">{task.equipmentName}</span>
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
          overdue ? "bg-rose-500/15 text-rose-400" : "bg-sky-500/15 text-sky-400"
        )}
      >
        {overdue ? "Overdue" : "Open"}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function AlertNoticeRow({
  icon: Icon,
  tone,
  title,
  meta,
  when,
  onOpen,
  testId,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  meta?: string | null;
  when: string | null;
  onOpen: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testId}
      className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span
        className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone)}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        {(meta || when) && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {meta && <span className="truncate">{meta}</span>}
            {meta && when && <span className="opacity-50">•</span>}
            {when && <span className="shrink-0">{when}</span>}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
