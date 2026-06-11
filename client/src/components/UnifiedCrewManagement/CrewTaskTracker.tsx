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
  Link2,
  Play,
  CheckCircle2,
  UserCog,
  Pencil,
  MessageSquare,
  ExternalLink,
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
  useCrewTaskEvents,
  useAddCrewTaskComment,
  invalidateCrewTasks,
  invalidateCrewTaskEvents,
  countTasks,
  filterTasks,
  sortTasks,
  isOverdue,
  isBlocked,
  statusLabel,
  priorityLabel,
  eventTypeLabel,
  dueLabel,
  type CrewTaskView,
  type CrewTaskEventView,
  type CrewTaskFilter,
  type UpdateCrewTaskInput,
} from "@/features/crew";
import { CREW_TASK_PRIORITIES, type CrewTaskStatus, type CrewTaskPriority } from "@shared/schema";

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

/** Minimal shape of `/api/crew/:crewId/documents` we use for linking. */
interface CrewDocumentItem {
  id: string;
  documentType: string;
  documentNumber: string | null;
}

/** Minimal shape of `/api/certificates?vesselId=` we use for linking. */
interface CertificateItem {
  id: string;
  certificateName: string;
  certificateNumber: string | null;
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
  /** Open a crew member's full profile from a task's linked owner. */
  onOpenCrewProfile?: (crewId: string) => void;
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

/** "passport" → "Passport"; "seaman_book" → "Seaman Book". */
function humanizeType(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function documentLabel(doc: CrewDocumentItem): string {
  const type = humanizeType(doc.documentType);
  return doc.documentNumber ? `${type} · ${doc.documentNumber}` : type;
}

function certificateLabel(cert: CertificateItem): string {
  return cert.certificateNumber
    ? `${cert.certificateName} · ${cert.certificateNumber}`
    : cert.certificateName;
}

/** Composite picker value, e.g. "crew_document:<id>" or "certificate:<id>". */
function sourceKey(type: string, id: string): string {
  return `${type}:${id}`;
}

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
  onOpenCrewProfile,
  onBack,
}: CrewTaskTrackerProps) {
  const { toast } = useToast();
  const { lastMessage, subscribe } = useWebSocket();
  const [filter, setFilter] = useState<CrewTaskFilter>("all");
  const [search, setSearch] = useState("");
  const [vesselFilter, setVesselFilter] = useState<string>(initialVesselId ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialTaskId ?? null);
  const [showAll, setShowAll] = useState(false);

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
    subscribe("crew_task.commented");
  }, [subscribe]);
  useEffect(() => {
    if (lastMessage?.channel?.startsWith("crew_task")) {
      invalidateCrewTasks();
      if (selectedId) {
        invalidateCrewTaskEvents(selectedId);
      }
    }
  }, [lastMessage, selectedId]);

  const myTaskIds = useMemo(
    () => new Set(meTasks.filter((t) => t.source === "crew_tasks").map((t) => t.id)),
    [meTasks]
  );

  const crewName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of crew) {
      map.set(c.id, c.name);
    }
    return map;
  }, [crew]);
  const vesselName = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vessels) {
      map.set(v.id, v.name);
    }
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

  const PRIORITY_PREVIEW = 5;
  const shown = showAll ? visible : visible.slice(0, PRIORITY_PREVIEW);
  const hasMore = visible.length > PRIORITY_PREVIEW;

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId]
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
          placeholder="Search tasks by title or details…"
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500"
          data-testid="input-task-search"
        />
      </div>

      {isLoading ? (
        <div
          className="ops-card flex items-center gap-2 rounded-2xl p-4 text-sm text-slate-400"
          data-testid="tasks-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
        </div>
      ) : isError ? (
        <div className="ops-card rounded-2xl p-4 text-sm text-rose-300" data-testid="tasks-error">
          Could not load tasks.{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="underline"
            data-testid="button-tasks-retry"
          >
            Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div
          className="ops-card rounded-2xl p-6 text-center text-sm text-slate-400"
          data-testid="tasks-empty"
        >
          No tasks match this view.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3
              className="text-sm font-semibold text-slate-200"
              data-testid="text-priority-heading"
            >
              {showAll ? "All tasks" : "Priority tasks"}
            </h3>
            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-xs font-medium text-sky-300 hover:text-sky-200"
                data-testid="button-view-all"
              >
                {showAll ? "Show priority" : `View all (${visible.length})`}
              </button>
            )}
          </div>
          <div className="space-y-2" data-testid="task-list">
            {shown.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                crewName={crewName}
                vesselName={vesselName}
                onOpen={() => setSelectedId(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {createOpen && (
        <TaskFormDialog
          crew={crew}
          vessels={vessels}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            toast({ title: "Task created" });
          }}
        />
      )}

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          crew={crew}
          vessels={vessels}
          crewName={crewName}
          vesselName={vesselName}
          canEdit={canEdit}
          canDelete={canDelete}
          onOpenCrewProfile={onOpenCrewProfile}
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

/**
 * Create or edit a task. When `task` is provided the dialog prefills and
 * PATCHes; otherwise it POSTs a new task. Linked source is picked from the
 * assigned crew member's documents (the snapshot label is stored).
 */
function TaskFormDialog({
  task,
  crew,
  vessels,
  onClose,
  onSaved,
}: {
  task?: CrewTaskView;
  crew: CrewOption[];
  vessels: VesselOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const createTask = useCreateCrewTask();
  const updateTask = useUpdateCrewTask();
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<CrewTaskPriority>(task?.priority ?? "medium");
  const [assignedCrewId, setAssignedCrewId] = useState(task?.assignedCrewId ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? "");
  const [vesselId, setVesselId] = useState(task?.vesselId ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  // Composite key "type:id" so one picker can offer both crew documents and
  // vessel certificates. Empty string = no link.
  const initialSourceKey =
    task?.linkedSourceType && task?.linkedSourceId
      ? sourceKey(task.linkedSourceType, task.linkedSourceId)
      : "";
  const [linkedKey, setLinkedKey] = useState(initialSourceKey);

  // Load the chosen crew member's documents and the chosen vessel's
  // certificates so we can offer either as a linkable source (snapshotting
  // the label at save time).
  const { data: documents = [] } = useQuery<CrewDocumentItem[]>({
    queryKey: ["/api/crew", assignedCrewId, "documents"],
    queryFn: () => apiRequest<CrewDocumentItem[]>(`/api/crew/${assignedCrewId}/documents`),
    enabled: Boolean(assignedCrewId),
  });
  const { data: certificates = [] } = useQuery<CertificateItem[]>({
    queryKey: ["/api/certificates", { vesselId }],
    queryFn: () => apiRequest<CertificateItem[]>(`/api/certificates?vesselId=${vesselId}`),
    enabled: Boolean(vesselId),
  });

  const isPending = createTask.isPending || updateTask.isPending;

  /**
   * Resolve the picker's composite key into the three stored link fields.
   * Returns `null` when the key can't be resolved to a loaded item (e.g. it
   * points at an item not in the currently fetched lists) so callers can
   * choose to leave the existing link untouched rather than corrupt it.
   */
  const resolveLink = (
    key: string
  ): Pick<
    UpdateCrewTaskInput,
    "linkedSourceType" | "linkedSourceId" | "linkedSourceLabel"
  > | null => {
    if (!key) {
      return {
        linkedSourceType: null,
        linkedSourceId: null,
        linkedSourceLabel: null,
      };
    }
    const [type, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (type === "crew_document") {
      const doc = documents.find((d) => d.id === id);
      return doc
        ? {
            linkedSourceType: "crew_document",
            linkedSourceId: doc.id,
            linkedSourceLabel: documentLabel(doc),
          }
        : null;
    }
    if (type === "certificate") {
      const cert = certificates.find((c) => c.id === id);
      return cert
        ? {
            linkedSourceType: "certificate",
            linkedSourceId: cert.id,
            linkedSourceLabel: certificateLabel(cert),
          }
        : null;
    }
    return null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }

    const onError = () =>
      toast({
        title: isEdit ? "Could not update task" : "Could not create task",
        variant: "destructive",
      });

    if (isEdit && task) {
      // Only touch linked-source fields when the user actually changed the
      // picker — otherwise an unrelated edit (or a link this picker can't
      // represent right now, e.g. its vessel/crew isn't loaded) would be
      // silently cleared.
      const linkChanged = linkedKey !== initialSourceKey;
      const resolved = linkChanged ? resolveLink(linkedKey) : null;
      const linkPatch = resolved ?? {};
      updateTask.mutate(
        {
          id: task.id,
          patch: {
            title: title.trim(),
            description: description.trim() || null,
            priority,
            assignedCrewId: assignedCrewId || null,
            assignedTo: assignedTo.trim() || null,
            vesselId: vesselId || null,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            ...linkPatch,
          },
        },
        { onSuccess: onSaved, onError }
      );
      return;
    }

    const resolved = resolveLink(linkedKey);
    const linkFields = resolved?.linkedSourceId
      ? {
          linkedSourceType: resolved.linkedSourceType ?? undefined,
          linkedSourceId: resolved.linkedSourceId,
          linkedSourceLabel: resolved.linkedSourceLabel ?? undefined,
        }
      : {};
    createTask.mutate(
      {
        title: title.trim(),
        priority,
        ...(description.trim() && { description: description.trim() }),
        ...(assignedCrewId && { assignedCrewId }),
        ...(assignedTo.trim() && { assignedTo: assignedTo.trim() }),
        ...(vesselId && { vesselId }),
        ...(dueDate && { dueDate: new Date(dueDate).toISOString() }),
        ...linkFields,
      },
      { onSuccess: onSaved, onError }
    );
  };

  return (
    <Overlay
      onClose={onClose}
      title={isEdit ? "Edit task" : "Create task"}
      testId={isEdit ? "dialog-edit-task" : "dialog-create-task"}
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="e.g. Renew passport before expiry"
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
          <Field label="Crew member">
            <select
              value={assignedCrewId}
              onChange={(e) => {
                setAssignedCrewId(e.target.value);
                // A document link belongs to the previous crew member — drop it.
                if (linkedKey.startsWith("crew_document:")) {
                  setLinkedKey("");
                }
              }}
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
          <Field label="Assigned-to owner">
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={inputClass}
              placeholder="e.g. Crewing Admin"
              data-testid="input-task-owner"
            />
          </Field>
        </div>
        <Field label="Vessel">
          <select
            value={vesselId}
            onChange={(e) => {
              setVesselId(e.target.value);
              // A certificate link belongs to the previous vessel — drop it.
              if (linkedKey.startsWith("certificate:")) {
                setLinkedKey("");
              }
            }}
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
        <Field label="Linked source (crew document or vessel certificate)">
          <select
            value={linkedKey}
            onChange={(e) => setLinkedKey(e.target.value)}
            disabled={!assignedCrewId && !vesselId}
            className={inputClass}
            data-testid="select-task-linked-source"
          >
            <option value="">
              {assignedCrewId || vesselId ? "None" : "Pick a crew member or vessel first"}
            </option>
            {documents.length > 0 && (
              <optgroup label="Crew documents">
                {documents.map((d) => (
                  <option key={d.id} value={sourceKey("crew_document", d.id)}>
                    {documentLabel(d)}
                  </option>
                ))}
              </optgroup>
            )}
            {certificates.length > 0 && (
              <optgroup label="Vessel certificates">
                {certificates.map((c) => (
                  <option key={c.id} value={sourceKey("certificate", c.id)}>
                    {certificateLabel(c)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
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
            disabled={!title.trim() || isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/90 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
            data-testid="button-submit-create"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  tone = "default",
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary";
  testId: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50";
  const cls =
    tone === "primary"
      ? `${base} bg-emerald-500/90 text-white hover:bg-emerald-500`
      : `${base} ops-card text-slate-200 hover:border-sky-500/40`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls}
      data-testid={testId}
    >
      {icon}
      {label}
    </button>
  );
}

function TaskDetailDialog({
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

  const submitComment = (e: React.FormEvent) => {
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

function ActivityEntry({ event }: { event: CrewTaskEventView }) {
  const when = event.createdAt ? new Date(event.createdAt).toLocaleString() : "";
  const isComment = event.eventType === "comment";
  return (
    <li className="flex gap-2 text-sm" data-testid={`event-${event.id}`}>
      <div
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
          isComment ? "bg-sky-400" : "bg-slate-500"
        }`}
      />
      <div className="min-w-0">
        <p className="text-slate-200">
          {!isComment && (
            <span className="mr-1 font-medium text-slate-400">
              {eventTypeLabel(event.eventType)}:
            </span>
          )}
          {event.message}
        </p>
        <p className="text-[11px] text-slate-500">
          {event.actorName ? `${event.actorName} · ` : ""}
          {when}
        </p>
      </div>
    </li>
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
