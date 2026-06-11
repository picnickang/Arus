import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Ban, Plus, Search, Loader2, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import {
  useCrewTasks,
  invalidateCrewTasks,
  invalidateCrewTaskEvents,
  countTasks,
  filterTasks,
  sortTasks,
  type CrewTaskFilter,
} from "@/features/crew";
import {
  FILTERS,
  StatCard,
  TaskDetailDialog,
  TaskFormDialog,
  TaskRow,
  type CrewOption,
  type VesselOption,
} from "./CrewTaskTrackerParts";

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
  /** Open a crew member's full profile from a task's linked owner. */
  onOpenCrewProfile?: (crewId: string) => void;
  onBack: () => void;
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
