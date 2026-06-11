import { useState, type FormEvent } from "react";
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  Trash2,
  User,
  UserCog,
} from "lucide-react";
import {
  dueLabel,
  priorityLabel,
  statusLabel,
  useAddCrewTaskComment,
  useCrewTaskEvents,
  useDeleteCrewTask,
  useUpdateCrewTask,
  type CrewTaskView,
} from "@/features/crew";
import { useToast } from "@/hooks/use-toast";
import type { CrewTaskStatus } from "@shared/schema";
import { ActivityEntry } from "./ActivityEntry";
import { ActionButton, Field, Overlay } from "./dialogChrome";
import { inputClass, PRIORITY_TONE, STATUS_TONE } from "./taskPresentation";
import { TaskFormDialog } from "./TaskFormDialog";
import type { CrewOption, VesselOption } from "./types";

export function TaskDetailDialog({
  task,
  crew,
  vessels,
  crewName,
  vesselName,
  canEdit,
  canDelete,
  onOpenCrewProfile,
  onClose,
  onDeleted,
}: {
  task: CrewTaskView;
  crew: CrewOption[];
  vessels: VesselOption[];
  crewName: Map<string, string>;
  vesselName: Map<string, string>;
  canEdit: boolean;
  canDelete: boolean;
  onOpenCrewProfile?: ((crewId: string) => void) | undefined;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const updateTask = useUpdateCrewTask();
  const deleteTask = useDeleteCrewTask();
  const { data: events = [], isLoading: eventsLoading } = useCrewTaskEvents(task.id);
  const addComment = useAddCrewTaskComment(task.id);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [comment, setComment] = useState("");

  const due = dueLabel(task.dueDate);

  const setStatus = (status: CrewTaskStatus, blockedReason?: string) => {
    updateTask.mutate(
      {
        id: task.id,
        patch: {
          status,
          blockedReason: status === "blocked" ? (blockedReason ?? null) : null,
        },
      },
      {
        onSuccess: () => toast({ title: "Task updated" }),
        onError: () => toast({ title: "Could not update task", variant: "destructive" }),
      }
    );
  };

  const block = () => {
    const reason = window.prompt("Why is this task blocked?")?.trim();
    if (reason === undefined) {
      return;
    }
    setStatus("blocked", reason || undefined);
  };

  const reassign = (crewId: string) => {
    updateTask.mutate(
      { id: task.id, patch: { assignedCrewId: crewId || null } },
      {
        onSuccess: () => {
          setReassignOpen(false);
          toast({ title: "Task reassigned" });
        },
        onError: () => toast({ title: "Could not reassign", variant: "destructive" }),
      }
    );
  };

  const remove = () => {
    deleteTask.mutate(task.id, {
      onSuccess: onDeleted,
      onError: () => toast({ title: "Could not delete task", variant: "destructive" }),
    });
  };

  const submitComment = (e: FormEvent) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text) {
      return;
    }
    addComment.mutate(text, {
      onSuccess: () => setComment(""),
      onError: () => toast({ title: "Could not add comment", variant: "destructive" }),
    });
  };

  if (editOpen) {
    return (
      <TaskFormDialog
        task={task}
        crew={crew}
        vessels={vessels}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          toast({ title: "Task updated" });
        }}
      />
    );
  }

  return (
    <Overlay onClose={onClose} title={task.title} testId="dialog-task-detail">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[task.status]}`}
          >
            {statusLabel(task.status)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_TONE[task.priority]}`}
          >
            {priorityLabel(task.priority)}
          </span>
          {task.assignedCrewId && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] text-slate-200"
              data-testid="chip-detail-crew"
            >
              <User className="h-3 w-3" />
              {crewName.get(task.assignedCrewId) ?? "Unknown"}
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-sm text-slate-300" data-testid="text-detail-description">
            {task.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Due</p>
            <p className="font-medium text-white">{due ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Owner</p>
            <p className="font-medium text-white" data-testid="text-detail-owner">
              {task.assignedTo || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Vessel</p>
            <p className="font-medium text-white">
              {task.vesselId ? (vesselName.get(task.vesselId) ?? "Vessel") : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Crew member</p>
            <p className="font-medium text-white">
              {task.assignedCrewId
                ? (crewName.get(task.assignedCrewId) ?? "Unknown")
                : "Unassigned"}
            </p>
          </div>
        </div>

        {task.status === "blocked" && task.blockedReason && (
          <div
            className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            data-testid="text-detail-blocked"
          >
            Blocked: {task.blockedReason}
          </div>
        )}

        {task.linkedSourceId && (
          <div
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2"
            data-testid="detail-linked-source"
          >
            <Link2 className="h-4 w-4 text-sky-300" />
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Linked source</p>
              <p className="truncate text-sm font-medium text-white">
                {task.linkedSourceLabel ?? "Linked document"}
              </p>
            </div>
          </div>
        )}

        {task.assignedCrewId && onOpenCrewProfile && (
          <button
            type="button"
            onClick={() => onOpenCrewProfile(task.assignedCrewId as string)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 hover:text-sky-200"
            data-testid="button-open-crew-profile"
          >
            <ExternalLink className="h-4 w-4" /> Open crew profile
          </button>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2" data-testid="task-actions">
            {task.status !== "in_progress" && task.status !== "done" && (
              <ActionButton
                icon={<Play className="h-4 w-4" />}
                label="Start"
                onClick={() => setStatus("in_progress")}
                disabled={updateTask.isPending}
                testId="button-action-start"
              />
            )}
            {task.status !== "blocked" && task.status !== "done" && (
              <ActionButton
                icon={<Ban className="h-4 w-4" />}
                label="Block"
                onClick={block}
                disabled={updateTask.isPending}
                testId="button-action-block"
              />
            )}
            <ActionButton
              icon={<UserCog className="h-4 w-4" />}
              label="Reassign"
              onClick={() => setReassignOpen((v) => !v)}
              disabled={updateTask.isPending}
              testId="button-action-reassign"
            />
            {task.status !== "done" && (
              <ActionButton
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Complete"
                onClick={() => setStatus("done")}
                disabled={updateTask.isPending}
                tone="primary"
                testId="button-action-complete"
              />
            )}
          </div>
        )}

        {reassignOpen && canEdit && (
          <Field label="Reassign to">
            <select
              defaultValue={task.assignedCrewId ?? ""}
              onChange={(e) => reassign(e.target.value)}
              className={inputClass}
              data-testid="select-reassign"
            >
              <option value="">Unassigned</option>
              {crew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="border-t border-slate-700 pt-3">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">Activity log</h4>
          {eventsLoading ? (
            <div
              className="flex items-center gap-2 text-sm text-slate-400"
              data-testid="events-loading"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-400" data-testid="events-empty">
              No activity yet.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="event-list">
              {events.map((ev) => (
                <ActivityEntry key={ev.id} event={ev} />
              ))}
            </ul>
          )}

          {canEdit && (
            <form onSubmit={submitComment} className="mt-3 flex items-start gap-2">
              <MessageSquare className="mt-2.5 h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                className={inputClass}
                data-testid="input-comment"
              />
              <button
                type="submit"
                disabled={!comment.trim() || addComment.isPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                data-testid="button-add-comment"
              >
                {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
              </button>
            </form>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-700 pt-3">
          {canDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleteTask.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                  data-testid="button-confirm-delete"
                >
                  {deleteTask.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm font-medium text-slate-300 hover:text-white"
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-300 hover:text-rose-200"
                data-testid="button-delete-task"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )
          ) : (
            <span />
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl ops-card px-3 py-2 text-sm font-medium text-slate-200 hover:border-sky-500/40"
              data-testid="button-edit-task"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}
