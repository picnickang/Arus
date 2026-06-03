import { useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  AlertTriangle,
  CalendarClock,
  Ban,
  Plus,
  Search,
  Loader2,
  Ship,
  User,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import {
  useCrewTasks,
  useCreateCrewTask,
  useUpdateCrewTask,
  useDeleteCrewTask,
  invalidateCrewTasks,
  countTasks,
  filterTasks,
  sortTasks,
  isOverdue,
  isBlocked,
  statusLabel,
  priorityLabel,
  dueLabel,
  type CrewTaskView,
  type CrewTaskFilter,
} from "@/features/crew";
import {
  CREW_TASK_STATUSES,
  CREW_TASK_PRIORITIES,
  type CrewTaskStatus,
  type CrewTaskPriority,
} from "@shared/schema";

interface CrewOption {
  id: string;
  name: string;
  rank?: string;
}

interface VesselOption {
  id: string;
  name: string;
}

interface MeTaskItem {
  id: string;
  source: string;
}

interface CrewTaskTrackerProps {
  crew: CrewOption[];
  vessels: VesselOption[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Pre-select this vessel in the "By vessel" filter when provided. */
  initialVesselId?: string | null;
  /** Open this task's detail on mount (deep-link from the me/tasks feed). */
  initialTaskId?: string | null;
  onBack: () => void;
}

const PRIORITY_TONE: Record<CrewTaskPriority, string> = {
  urgent: "bg-rose-500/15 text-rose-300",
  high: "bg-amber-500/15 text-amber-300",
  medium: "bg-sky-500/15 text-sky-300",
  low: "bg-slate-500/15 text-slate-300",
};

const STATUS_TONE: Record<CrewTaskStatus, string> = {
  open: "bg-sky-500/15 text-sky-300",
  in_progress: "bg-emerald-500/15 text-emerald-300",
  blocked: "bg-rose-500/15 text-rose-300",
  done: "bg-slate-500/15 text-slate-400",
};

const FILTERS: { key: CrewTaskFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My Tasks" },
  { key: "overdue", label: "Overdue" },
  { key: "by_vessel", label: "By vessel" },
];

function StatCard({
  icon,
  value,
  label,
  tone,
  testId,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: string;
  testId: string;
}) {
  return (
    <div className="ops-card flex items-center gap-3 rounded-2xl p-3" data-testid={testId}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-white">{value}</p>
        <p className="mt-1 text-sm font-medium text-slate-200">{label}</p>
      </div>
    </div>
  );
}

export function CrewTaskTracker({
  crew,
  vessels,
  canCreate,
  canEdit,
  canDelete,
  initialVesselId,
  initialTaskId,
  onBack,
}: CrewTaskTrackerProps) {
  const { toast } = useToast();
  const { lastMessage, subscribe } = useWebSocket();
  const [filter, setFilter] = useState<CrewTaskFilter>("all");
  const [search, setSearch] = useState("");
  const [vesselFilter, setVesselFilter] = useState<string>(initialVesselId ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialTaskId ?? null);

  const { data: tasks = [], isLoading, isError, refetch } = useCrewTasks({ includeDone: true });
  const { data: meTasks = [] } = useQuery<MeTaskItem[]>({
    queryKey: ["/api/me/tasks"],
    queryFn: () => apiRequest<MeTaskItem[]>("/api/me/tasks"),
  });

  // Near-real-time refresh: the server broadcasts crew_task.* on the
  // per-org channel; invalidate the list on any such frame.
  useEffect(() => {
    subscribe("crew_task.created");
    subscribe("crew_task.updated");
    subscribe("crew_task.deleted");
  }, [subscribe]);
  useEffect(() => {
    if (lastMessage?.channel?.startsWith("crew_task")) {
      invalidateCrewTasks();
    }
  }, [lastMessage]);

  const myTaskIds = useMemo(
    () => new Set(meTasks.filter((t) => t.source === "crew_tasks").map((t) => t.id)),
    [meTasks],
  );

  const crewName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of crew) map.set(c.id, c.name);
    return map;
  }, [crew]);
  const vesselName = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vessels) map.set(v.id, v.name);
    return map;
  }, [vessels]);

  const counts = useMemo(() => countTasks(tasks), [tasks]);
  const dueThisWeekCount = counts.dueThisWeek;

  const visible = useMemo(() => {
    const filtered = filterTasks(tasks, {
      filter,
      search,
      myTaskIds,
      vesselId: vesselFilter || null,
    });
    // Hide completed tasks unless explicitly searching/viewing them.
    const activeOnly = filtered.filter((t) => t.status !== "done");
    return sortTasks(activeOnly);
  }, [tasks, filter, search, myTaskIds, vesselFilter]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId],
  );

  return (
    <div className="space-y-4" data-testid="crew-task-tracker">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-white"
        data-testid="button-tasks-back"
      >
        <ArrowLeft className="h-4 w-4" /> Crew registry
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Tasks</h2>
          <p className="text-sm text-slate-400" data-testid="text-task-summary">
            {counts.active} active · {counts.overdue} overdue · {dueThisWeekCount} due this week
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-500/90 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
            data-testid="button-create-task"
          >
            <Plus className="h-4 w-4" /> Create task
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-rose-300" />}
          value={counts.overdue}
          label="Overdue"
          tone="bg-rose-500/15"
          testId="stat-overdue"
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5 text-amber-300" />}
          value={dueThisWeekCount}
          label="Due this week"
          tone="bg-amber-500/15"
          testId="stat-due-week"
        />
        <StatCard
          icon={<Ban className="h-5 w-5 text-sky-300" />}
          value={counts.blocked}
          label="Blocked"
          tone="bg-sky-500/15"
          testId="stat-blocked"
        />
      </div>

      <div className="flex flex-wrap gap-2" data-testid="task-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-sky-500/90 text-white"
                : "ops-card text-slate-300 hover:border-sky-500/40"
            }`}
            data-testid={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === "by_vessel" && (
        <select
          value={vesselFilter}
          onChange={(e) => setVesselFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
          data-testid="select-vessel-filter"
        >
          <option value="">All vessels</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500"
          data-testid="input-task-search"
        />
      </div>

      {isLoading ? (
        <div className="ops-card flex items-center gap-2 rounded-2xl p-4 text-sm text-slate-400" data-testid="tasks-loading">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
        </div>
      ) : isError ? (
        <div className="ops-card rounded-2xl p-4 text-sm text-rose-300" data-testid="tasks-error">
          Could not load tasks.{" "}
          <button type="button" onClick={() => refetch()} className="underline" data-testid="button-tasks-retry">
            Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="ops-card rounded-2xl p-6 text-center text-sm text-slate-400" data-testid="tasks-empty">
          No tasks match this view.
        </div>
      ) : (
        <div className="space-y-2" data-testid="task-list">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              crewName={crewName}
              vesselName={vesselName}
              onOpen={() => setSelectedId(task.id)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateTaskDialog
          crew={crew}
          vessels={vessels}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            toast({ title: "Task created" });
          }}
        />
      )}

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          crewName={crewName}
          vesselName={vesselName}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setSelectedId(null)}
          onDeleted={() => {
            setSelectedId(null);
            toast({ title: "Task deleted" });
          }}
        />
      )}
    </div>
  );
}

function TaskRow({
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
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[task.status]}`}>
            {statusLabel(task.status)}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_TONE[task.priority]}`}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500";

function CreateTaskDialog({
  crew,
  vessels,
  onClose,
  onCreated,
}: {
  crew: CrewOption[];
  vessels: VesselOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const createTask = useCreateCrewTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CrewTaskPriority>("medium");
  const [assignedCrewId, setAssignedCrewId] = useState("");
  const [vesselId, setVesselId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate(
      {
        title: title.trim(),
        priority,
        ...(description.trim() && { description: description.trim() }),
        ...(assignedCrewId && { assignedCrewId }),
        ...(vesselId && { vesselId }),
        ...(dueDate && { dueDate: new Date(dueDate).toISOString() }),
      },
      {
        onSuccess: onCreated,
        onError: () =>
          toast({ title: "Could not create task", variant: "destructive" }),
      },
    );
  };

  return (
    <Overlay onClose={onClose} title="Create task" testId="dialog-create-task">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="e.g. Inspect bilge pump"
            data-testid="input-task-title"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Optional details"
            data-testid="input-task-description"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CrewTaskPriority)}
              className={inputClass}
              data-testid="select-task-priority"
            >
              {CREW_TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
              data-testid="input-task-due"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee">
            <select
              value={assignedCrewId}
              onChange={(e) => setAssignedCrewId(e.target.value)}
              className={inputClass}
              data-testid="select-task-assignee"
            >
              <option value="">Unassigned</option>
              {crew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vessel">
            <select
              value={vesselId}
              onChange={(e) => setVesselId(e.target.value)}
              className={inputClass}
              data-testid="select-task-vessel"
            >
              <option value="">None</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 hover:text-white"
            data-testid="button-cancel-create"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || createTask.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/90 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
            data-testid="button-submit-create"
          >
            {createTask.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create task
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function TaskDetailDialog({
  task,
  crewName,
  vesselName,
  canEdit,
  canDelete,
  onClose,
  onDeleted,
}: {
  task: CrewTaskView;
  crewName: Map<string, string>;
  vesselName: Map<string, string>;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const updateTask = useUpdateCrewTask();
  const deleteTask = useDeleteCrewTask();
  const [status, setStatus] = useState<CrewTaskStatus>(task.status);
  const [blockedReason, setBlockedReason] = useState(task.blockedReason ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const due = dueLabel(task.dueDate);
  const dirty =
    status !== task.status ||
    (status === "blocked" && blockedReason.trim() !== (task.blockedReason ?? "").trim());

  const saveStatus = () => {
    updateTask.mutate(
      {
        id: task.id,
        patch: {
          status,
          blockedReason: status === "blocked" ? blockedReason.trim() || null : null,
        },
      },
      {
        onSuccess: () => toast({ title: "Task updated" }),
        onError: () =>
          toast({ title: "Could not update task", variant: "destructive" }),
      },
    );
  };

  const remove = () => {
    deleteTask.mutate(task.id, {
      onSuccess: onDeleted,
      onError: () =>
        toast({ title: "Could not delete task", variant: "destructive" }),
    });
  };

  return (
    <Overlay onClose={onClose} title={task.title} testId="dialog-task-detail">
      <div className="space-y-4">
        {task.description && (
          <p className="text-sm text-slate-300" data-testid="text-detail-description">
            {task.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Priority</p>
            <p className="font-medium text-white">{priorityLabel(task.priority)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Due</p>
            <p className="font-medium text-white">{due ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Assignee</p>
            <p className="font-medium text-white">
              {task.assignedCrewId ? crewName.get(task.assignedCrewId) ?? "Unknown" : "Unassigned"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Vessel</p>
            <p className="font-medium text-white">
              {task.vesselId ? vesselName.get(task.vesselId) ?? "Vessel" : "—"}
            </p>
          </div>
        </div>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CrewTaskStatus)}
            disabled={!canEdit}
            className={inputClass}
            data-testid="select-detail-status"
          >
            {CREW_TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </Field>

        {status === "blocked" && (
          <Field label="Blocked reason">
            <input
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              disabled={!canEdit}
              className={inputClass}
              placeholder="Why is this blocked?"
              data-testid="input-detail-blocked-reason"
            />
          </Field>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
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
              onClick={saveStatus}
              disabled={!dirty || updateTask.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              data-testid="button-save-status"
            >
              {updateTask.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({
  title,
  children,
  onClose,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  testId: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      data-testid={testId}
    >
      <div
        className="ops-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-400 hover:text-white"
            data-testid="button-close-dialog"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
