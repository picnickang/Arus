import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  AlertTriangle,
  Clock,
  Shield,
  Package,
  Wrench,
  Users,
  Lightbulb,
  CheckCircle,
  XCircle,
  Eye,
  ChevronRight,
  FileText,
  Play,
  Filter,
  X,
  ExternalLink,
  Terminal,
  PauseCircle,
  ListTodo,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type FindingSource = "suggestion" | "draft" | "schedule_run" | "agent_finding";
export type FindingSeverity = "info" | "warning" | "critical";
export type FindingStatus =
  | "pending"
  | "acted"
  | "dismissed"
  | "deferred"
  | "approved"
  | "rejected"
  | "completed"
  | "failed"
  | "running";

export interface UnifiedFindingItem {
  id: string;
  source: FindingSource;
  sourceId: string;
  title: string;
  summary: string;
  severity: FindingSeverity;
  status: FindingStatus;
  entityType?: string | null;
  entityId?: string | null;
  triggerType?: string | null;
  draftType?: string | null;
  scheduleName?: string | null;
  scheduleId?: string | null;
  requiresAction: boolean;
  createdAt: string;
  updatedAt?: string | null;
  context?: Record<string, unknown> | null;
  outcome?: string | null;
  outcomeReason?: string | null;
  outcomeAt?: string | null;
  outcomeBy?: string | null;
}

export interface AgentTask {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string;
  parentTaskId: string | null;
  equipmentId: string | null;
  vesselId: string | null;
  predictionId: string | null;
  conversationId: string | null;
  outcome: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export const TASK_STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  deferred: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

export const TASK_PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

export const TASK_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "blocked", "deferred"],
  in_progress: ["completed", "failed", "blocked"],
  blocked: ["open", "in_progress", "deferred"],
  deferred: ["open", "in_progress"],
};

export const OUTCOME_CATEGORIES = [
  { value: "useful", label: "Useful" },
  { value: "already_handled", label: "Already Handled" },
  { value: "not_relevant", label: "Not Relevant" },
  { value: "too_late", label: "Too Late" },
  { value: "false_alarm", label: "False Alarm" },
] as const;

export const SOURCE_LABELS: Record<FindingSource, string> = {
  suggestion: "Suggestion",
  draft: "Draft",
  schedule_run: "Scheduled Run",
  agent_finding: "Agent Finding",
};

export const SOURCE_ICONS: Record<FindingSource, typeof Lightbulb> = {
  suggestion: Lightbulb,
  draft: FileText,
  schedule_run: Play,
  agent_finding: Eye,
};

export const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  acted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  dismissed: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  deferred: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export const TRIGGER_ICONS: Record<string, typeof AlertTriangle> = {
  high_risk_prediction: AlertTriangle,
  overdue_maintenance: Wrench,
  low_stock: Package,
  critical_alert: Shield,
  expiring_certification: Users,
  ai_summary: Bot,
  anomaly: AlertTriangle,
  recommendation: Lightbulb,
  risk: Shield,
  compliance_gap: FileText,
};

export const ENTITY_ROUTES: Record<string, string> = {
  equipment: "/maintenance?tab=equipment-intelligence",
  work_order: "/maintenance?tab=work-orders",
  vessel: "/fleet?tab=vessels",
  part: "/inventory?tab=parts",
  inventory: "/logistics?tab=inventory",
  maintenance_schedule: "/maintenance?tab=schedules",
  schedule: "/operations?tab=findings",
};

export const ENTITY_LABELS: Record<string, string> = {
  equipment: "Equipment",
  work_order: "Work Order",
  vessel: "Vessel",
  part: "Part",
  inventory: "Inventory",
  maintenance_schedule: "Maintenance Schedule",
  schedule: "Schedule",
};

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(dateStr).toLocaleDateString();
}

export function EntityLink({
  entityType,
  entityId,
}: {
  entityType?: string | null | undefined;
  entityId?: string | null | undefined;
}) {
  if (!entityType || !entityId) {
    return null;
  }
  const route = ENTITY_ROUTES[entityType];
  const label = ENTITY_LABELS[entityType] || entityType.replace(/_/g, " ");
  const shortId = entityId.length > 8 ? `${entityId.slice(0, 8)}…` : entityId;

  if (!route) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
        data-testid={`entity-link-${entityType}-${entityId}`}
      >
        <ExternalLink className="h-2.5 w-2.5" />
        {label}: {shortId}
      </span>
    );
  }
  return (
    <Link href={route}>
      <span
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
        data-testid={`entity-link-${entityType}-${entityId}`}
      >
        <ExternalLink className="h-2.5 w-2.5" />
        {label}: {shortId}
      </span>
    </Link>
  );
}

export function FindingCard({
  item,
  onApprove,
  onReject,
  onDismiss,
  onAct,
  onDefer,
  onViewOutput,
  onOpenAssistant,
  onAcknowledge,
  onArchive,
}: {
  item: UnifiedFindingItem;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAct?: (id: string) => void;
  onDefer?: (id: string) => void;
  onViewOutput?: (item: UnifiedFindingItem) => void;
  onOpenAssistant: (item: UnifiedFindingItem) => void;
  onAcknowledge?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const SourceIcon = SOURCE_ICONS[item.source];
  const TriggerIcon = item.triggerType ? TRIGGER_ICONS[item.triggerType] || Lightbulb : SourceIcon;

  return (
    <div
      className={cn(
        "p-4 border rounded-lg transition-colors hover:bg-muted/30",
        item.requiresAction && "border-l-4 border-l-amber-500"
      )}
      data-testid={`finding-card-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 p-1.5 rounded-md shrink-0",
            item.severity === "critical"
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : item.severity === "warning"
                ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          )}
        >
          <TriggerIcon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="text-sm font-medium leading-tight"
                data-testid={`finding-title-${item.id}`}
              >
                {item.title}
              </h3>
              <p
                className="text-xs text-muted-foreground mt-1 line-clamp-2"
                data-testid={`finding-summary-${item.id}`}
              >
                {item.summary}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", SEVERITY_STYLES[item.severity])}
            >
              {item.severity}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", STATUS_STYLES[item.status] || "")}
            >
              {item.status}
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {SOURCE_LABELS[item.source]}
            </Badge>
            {item.triggerType && item.source === "suggestion" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {item.triggerType.replace(/_/g, " ")}
              </Badge>
            )}
            {item.source === "suggestion" &&
              Boolean(item.context?.['costImpact']) &&
              (() => {
                const ci = (item.context as { costImpact?: { revenueImpact?: number; estimatedRepairCost?: number } }).costImpact ?? {};
                const atRisk = ci.revenueImpact ?? 0;
                if (atRisk <= 0) {
                  return null;
                }
                const fmt =
                  atRisk >= 1000 ? `~$${(atRisk / 1000).toFixed(0)}K` : `~$${atRisk.toFixed(0)}`;
                return (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                    data-testid={`badge-cost-impact-${item.id}`}
                  >
                    {fmt} at risk
                  </Badge>
                );
              })()}
            <EntityLink entityType={item.entityType} entityId={item.entityId} />
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(item.createdAt)}
            </span>
          </div>

          {item.outcome && (
            <div
              className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground"
              data-testid={`outcome-info-${item.id}`}
            >
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {item.outcome.replace(/_/g, " ")}
              </Badge>
              {item.outcomeReason && (
                <span className="truncate italic">"{item.outcomeReason}"</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-3">
            {item.source === "draft" && item.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onApprove?.(item.sourceId)}
                  data-testid={`button-approve-${item.id}`}
                >
                  <CheckCircle className="h-3 w-3" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1"
                  onClick={() => onReject?.(item.sourceId)}
                  data-testid={`button-reject-${item.id}`}
                >
                  <XCircle className="h-3 w-3" /> Reject
                </Button>
              </>
            )}
            {item.source === "suggestion" && item.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onAct?.(item.sourceId)}
                  data-testid={`button-act-${item.id}`}
                >
                  <CheckCircle className="h-3 w-3" /> Act On
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onDefer?.(item.sourceId)}
                  data-testid={`button-defer-${item.id}`}
                >
                  <PauseCircle className="h-3 w-3" /> Defer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onDismiss?.(item.sourceId)}
                  data-testid={`button-dismiss-${item.id}`}
                >
                  <X className="h-3 w-3" /> Dismiss
                </Button>
              </>
            )}
            {item.source === "agent_finding" && item.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onAcknowledge?.(item.sourceId)}
                  data-testid={`button-acknowledge-${item.id}`}
                >
                  <CheckCircle className="h-3 w-3" /> Acknowledge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onArchive?.(item.sourceId)}
                  data-testid={`button-archive-${item.id}`}
                >
                  <X className="h-3 w-3" /> Archive
                </Button>
              </>
            )}
            {item.source === "schedule_run" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => onViewOutput?.(item)}
                data-testid={`button-view-output-${item.id}`}
              >
                <Terminal className="h-3 w-3" /> View Output
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 ml-auto"
              onClick={() => onOpenAssistant(item)}
              data-testid={`button-assistant-${item.id}`}
            >
              <Bot className="h-3 w-3" /> Ask Copilot
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskCard({
  task,
  onTransition,
  onOpenAssistant,
}: {
  task: AgentTask;
  onTransition: (taskId: string, newStatus: string) => void;
  onOpenAssistant: (task: AgentTask) => void;
}) {
  const nextStatuses = TASK_STATUS_TRANSITIONS[task.status] || [];

  return (
    <div
      className={cn(
        "p-4 border rounded-lg transition-colors hover:bg-muted/30",
        task.status === "blocked" && "border-l-4 border-l-red-500",
        (task.status === "open" || task.status === "in_progress") && "border-l-4 border-l-blue-500"
      )}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 p-1.5 rounded-md shrink-0",
            task.status === "completed"
              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              : task.status === "failed" || task.status === "blocked"
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          )}
        >
          <ListTodo className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium leading-tight" data-testid={`task-title-${task.id}`}>
            {task.title}
          </h3>
          {task.description && (
            <p
              className="text-xs text-muted-foreground mt-1 line-clamp-2"
              data-testid={`task-description-${task.id}`}
            >
              {task.description}
            </p>
          )}

          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", TASK_STATUS_STYLES[task.status] || "")}
            >
              {task.status.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", TASK_PRIORITY_STYLES[task.priority] || "")}
            >
              {task.priority}
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {task.source}
            </Badge>
            {task.equipmentId && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Wrench className="h-2.5 w-2.5" />
                {task.equipmentId.slice(0, 8)}…
              </span>
            )}
            {task.vesselId && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Package className="h-2.5 w-2.5" />
                {task.vesselId.slice(0, 8)}…
              </span>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(task.createdAt)}
            </span>
          </div>

          {task.outcome && (
            <div
              className="mt-1.5 text-[10px] text-muted-foreground italic"
              data-testid={`task-outcome-${task.id}`}
            >
              Outcome: {task.outcome}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-3">
            {nextStatuses.map((ns) => (
              <Button
                key={ns}
                size="sm"
                variant={ns === "completed" ? "default" : "outline"}
                className="h-7 text-xs gap-1"
                onClick={() => onTransition(task.id, ns)}
                data-testid={`button-transition-${task.id}-${ns}`}
              >
                <ArrowRight className="h-3 w-3" />
                {ns.replace(/_/g, " ")}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 ml-auto"
              onClick={() => onOpenAssistant(task)}
              data-testid={`button-task-assistant-${task.id}`}
            >
              <Bot className="h-3 w-3" /> Ask Copilot
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TasksSection({
  onOpenAssistant,
}: {
  onOpenAssistant: (task: AgentTask) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filterParams: Record<string, string | number | null> = {
    limit: 50,
    offset: 0,
    status: statusFilter !== "all" ? statusFilter : null,
    priority: priorityFilter !== "all" ? priorityFilter : null,
  };

  const { data: tasks, isLoading } = useQuery<AgentTask[]>({
    queryKey: ["/api/agent/tasks", filterParams],
    refetchInterval: 30000,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/agent/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/tasks"] });
      toast({ title: "Task updated" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Failed to update task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const handleTransition = (taskId: string, newStatus: string) => {
    transitionMutation.mutate({ id: taskId, status: newStatus });
  };

  const taskList = tasks ?? [];

  return (
    <div data-testid="tasks-section">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="task-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="deferred">Deferred</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="task-filter-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3" data-testid="tasks-loading">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : taskList.length === 0 ? (
        <div className="text-center py-16 border rounded-lg" data-testid="tasks-empty">
          <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-medium text-muted-foreground">No tasks yet</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Agent tasks for investigations and action items will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="task-list">
          {taskList.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onTransition={handleTransition}
              onOpenAssistant={onOpenAssistant}
            />
          ))}
        </div>
      )}
    </div>
  );
}
