import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Bot, Clock, Filter, ListTodo, Package, Wrench, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_STYLES,
  TASK_STATUS_STYLES,
  TASK_STATUS_TRANSITIONS,
  type AgentTask,
} from "./findings-card-types";
import { timeAgo } from "./findings-card-renderers";

function TaskCard({
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

export function TasksSection({ onOpenAssistant }: { onOpenAssistant: (task: AgentTask) => void }) {
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
