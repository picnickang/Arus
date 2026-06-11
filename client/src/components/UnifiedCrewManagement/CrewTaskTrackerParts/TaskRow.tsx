import { Link2, ListChecks, Ship, User } from "lucide-react";
import {
  dueLabel,
  isBlocked,
  isOverdue,
  priorityLabel,
  statusLabel,
  type CrewTaskView,
} from "@/features/crew";
import { PRIORITY_TONE, STATUS_TONE } from "./taskPresentation";

export function TaskRow({
  task,
  crewName,
  vesselName,
  onOpen,
}: {
  task: CrewTaskView;
  crewName: Map<string, string>;
  vesselName: Map<string, string>;
  onOpen: () => void;
}) {
  const overdue = isOverdue(task);
  const blocked = isBlocked(task);
  const due = dueLabel(task.dueDate);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ops-card flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:border-sky-500/40"
      data-testid={`task-row-${task.id}`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${PRIORITY_TONE[task.priority]}`}
      >
        <ListChecks className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[task.status]}`}
            data-testid={`task-status-${task.id}`}
          >
            {statusLabel(task.status)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_TONE[task.priority]}`}
          >
            {priorityLabel(task.priority)}
          </span>
          {task.assignedCrewId && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <User className="h-3 w-3" />
              {crewName.get(task.assignedCrewId) ?? "Unknown"}
            </span>
          )}
          {task.vesselId && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Ship className="h-3 w-3" />
              {vesselName.get(task.vesselId) ?? "Vessel"}
            </span>
          )}
          {task.linkedSourceId && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Link2 className="h-3 w-3" />
              Linked
            </span>
          )}
        </div>
      </div>
      {due && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            overdue || blocked ? "bg-rose-500/15 text-rose-300" : "bg-slate-500/15 text-slate-300"
          }`}
          data-testid={`task-due-${task.id}`}
        >
          {due}
        </span>
      )}
    </button>
  );
}
