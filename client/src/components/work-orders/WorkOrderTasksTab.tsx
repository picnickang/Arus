import { useState } from "react";
import {
  Plus,
  Check,
  Circle,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useWorkOrderTasksTabData } from "@/features/work-orders";

interface WorkOrderTasksTabProps {
  workOrderId: string;
  isReadOnly?: boolean;
}

export function WorkOrderTasksTab({ workOrderId, isReadOnly = false }: WorkOrderTasksTabProps) {
  const {
    newTaskText,
    setNewTaskText,
    isAddingTask,
    setIsAddingTask,
    isLoading,
    progress,
    templateCompletions,
    workOrderTasks,
    totalTasks,
    completedTasksCount,
    overallProgress,
    hasNoTasks,
    updateChecklistItemMutation,
    resetChecklistItemMutation,
    addTaskMutation,
    deleteTaskMutation,
    toggleTaskCompletion,
    handleAddTask,
    cancelAddTask,
  } = useWorkOrderTasksTabData(workOrderId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="work-order-tasks-tab">
      {!hasNoTasks && (
        <div className="space-y-2" data-testid="tasks-progress-section">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground" data-testid="tasks-progress-text">
              {completedTasksCount} of {totalTasks} completed
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" data-testid="tasks-progress-bar" />
          <div className="flex gap-2 mt-2">
            {progress && progress.pendingItems > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-pending-items">
                {progress.pendingItems} pending
              </Badge>
            )}
            {progress && progress.failedItems > 0 && (
              <Badge variant="destructive" className="text-xs" data-testid="badge-failed-items">
                {progress.failedItems} failed
              </Badge>
            )}
            {progress && progress.completedItems > 0 && (
              <Badge
                variant="default"
                className="text-xs bg-green-600"
                data-testid="badge-passed-items"
              >
                {progress.completedItems} passed
              </Badge>
            )}
          </div>
        </div>
      )}

      {!isReadOnly && (
        <div className="space-y-3">
          {isAddingTask ? (
            <div className="flex gap-2">
              <Input
                placeholder="Enter task description..."
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddTask();
                  } else if (e.key === "Escape") {
                    cancelAddTask();
                  }
                }}
                autoFocus
                data-testid="input-new-task"
              />
              <Button
                size="sm"
                onClick={handleAddTask}
                disabled={!newTaskText.trim() || addTaskMutation.isPending}
                data-testid="button-save-task"
              >
                {addTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelAddTask}
                data-testid="button-cancel-task"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingTask(true)}
              className="w-full"
              data-testid="button-add-task"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      )}

      <Separator />

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-2">
          {templateCompletions.length > 0 && (
            <div className="space-y-2" data-testid="template-checklist-section">
              <h4 className="text-sm font-medium text-muted-foreground">Template Checklist</h4>
              {templateCompletions.map((item) => (
                <TemplateChecklistItem
                  key={item.id}
                  id={item.id}
                  itemId={item.itemId}
                  description={item.description || `Checklist Item`}
                  passed={item.passed}
                  notes={item.notes}
                  completedByName={item.completedByName}
                  completedAt={item.completedAt}
                  isReadOnly={isReadOnly}
                  isPending={
                    updateChecklistItemMutation.isPending || resetChecklistItemMutation.isPending
                  }
                  onPass={(notes) =>
                    updateChecklistItemMutation.mutate({ itemId: item.itemId, passed: true, notes })
                  }
                  onFail={(notes) =>
                    updateChecklistItemMutation.mutate({
                      itemId: item.itemId,
                      passed: false,
                      notes,
                    })
                  }
                  onReset={() => resetChecklistItemMutation.mutate(item.itemId)}
                />
              ))}
            </div>
          )}

          {(workOrderTasks as Array<{ id: string; description: string; isCompleted: boolean; completedByName?: string | null; completedAt?: string | Date | null }>).length > 0 && (
            <div className="space-y-2" data-testid="additional-tasks-section">
              {templateCompletions.length > 0 && (
                <h4 className="text-sm font-medium text-muted-foreground mt-4">Additional Tasks</h4>
              )}
              {(workOrderTasks as Array<{ id: string; description: string; isCompleted: boolean; completedByName?: string | null; completedAt?: string | Date | null }>).map((task) => (
                <TaskItem
                  key={task.id}
                  id={task.id}
                  description={task.description}
                  isCompleted={task.isCompleted}
                  completedByName={task.completedByName ?? undefined}
                  completedAt={task.completedAt ? new Date(task.completedAt as string | Date).toISOString() : undefined}
                  isReadOnly={isReadOnly}
                  isPending={toggleTaskCompletion.isPending || deleteTaskMutation.isPending}
                  onToggle={(completed) =>
                    toggleTaskCompletion.mutate({ taskId: task.id, completed })
                  }
                  onDelete={() => deleteTaskMutation.mutate(task.id)}
                />
              ))}
            </div>
          )}

          {hasNoTasks && (
            <div
              className="flex flex-col items-center justify-center py-8 text-center"
              data-testid="no-tasks-message"
            >
              <Circle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No Tasks Yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                {isReadOnly
                  ? "No tasks have been added to this work order."
                  : "Add tasks to track the work that needs to be done."}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface TemplateChecklistItemProps {
  id: string;
  itemId: string;
  description: string;
  passed: boolean | null;
  notes?: string | undefined;
  completedByName?: string | undefined;
  completedAt?: string | undefined;
  isReadOnly?: boolean | undefined;
  isPending?: boolean | undefined;
  onPass: (notes?: string) => void;
  onFail: (notes?: string) => void;
  onReset: () => void;
}

function TemplateChecklistItem({
  id,
  itemId: _itemId,
  description,
  passed,
  notes,
  completedByName,
  completedAt,
  isReadOnly,
  isPending,
  onPass,
  onFail,
  onReset,
}: TemplateChecklistItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes || "");
  const isCompleted = passed !== null;
  const getStatusColor = () => {
    if (passed === true) {
      return "border-green-500 bg-green-50 dark:bg-green-950/20";
    }
    if (passed === false) {
      return "border-red-500 bg-red-50 dark:bg-red-950/20";
    }
    return "border-border bg-background hover:border-primary/50";
  };
  const getStatusIcon = () => {
    if (passed === true) {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    if (passed === false) {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn("rounded-lg border transition-colors", getStatusColor())}
        data-testid={`checklist-item-${id}`}
      >
        <div className="flex items-start gap-3 p-3">
          <div className="mt-0.5" data-testid={`status-icon-${id}`}>
            {getStatusIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm", isCompleted && "text-muted-foreground")}>{description}</p>
            {isCompleted && completedByName && (
              <p
                className="text-xs text-muted-foreground mt-1"
                data-testid={`completion-info-${id}`}
              >
                {passed ? "Passed" : "Failed"} by {completedByName}
                {completedAt && ` on ${new Date(completedAt).toLocaleDateString()}`}
              </p>
            )}
            {notes && (
              <p
                className="text-xs text-muted-foreground mt-1 italic"
                data-testid={`notes-display-${id}`}
              >
                Note: {notes}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isReadOnly && !isCompleted && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                  onClick={() => onPass(localNotes || undefined)}
                  disabled={isPending}
                  title="Mark as Passed"
                  data-testid={`button-pass-${id}`}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                  onClick={() => onFail(localNotes || undefined)}
                  disabled={isPending}
                  title="Mark as Failed"
                  data-testid={`button-fail-${id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {!isReadOnly && isCompleted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={onReset}
                disabled={isPending}
                title="Reset to Pending"
                data-testid={`button-reset-${id}`}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title="Add Notes"
                data-testid={`button-notes-${id}`}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <Badge variant="outline" className="text-xs shrink-0 ml-1">
              Template
            </Badge>
          </div>
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0">
            <Separator className="mb-3" />
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Notes / Comments</label>
              <Textarea
                placeholder="Add notes about this checklist item..."
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                className="min-h-[60px] text-sm"
                disabled={isReadOnly}
                data-testid={`textarea-notes-${id}`}
              />
              {!isReadOnly && !isCompleted && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => onPass(localNotes || undefined)}
                    disabled={isPending}
                    data-testid={`button-pass-with-notes-${id}`}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Pass
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onFail(localNotes || undefined)}
                    disabled={isPending}
                    data-testid={`button-fail-with-notes-${id}`}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Fail
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface TaskItemProps {
  id: string;
  description: string;
  isCompleted: boolean;
  completedByName?: string | undefined;
  completedAt?: string | undefined;
  isReadOnly?: boolean | undefined;
  isPending?: boolean | undefined;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
}

function TaskItem({
  id,
  description,
  isCompleted,
  completedByName,
  completedAt,
  isReadOnly,
  isPending,
  onToggle,
  onDelete,
}: TaskItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        isCompleted
          ? "bg-muted/30 border-muted"
          : "bg-background border-border hover:border-primary/50"
      )}
      data-testid={`task-item-${id}`}
    >
      <Checkbox
        id={`task-${id}`}
        checked={isCompleted}
        onCheckedChange={(checked) => !isReadOnly && onToggle(checked as boolean)}
        disabled={isReadOnly || isPending}
        className="mt-0.5"
        data-testid={`checkbox-task-${id}`}
      />
      <div className="flex-1 min-w-0">
        <label
          htmlFor={`task-${id}`}
          className={cn(
            "text-sm cursor-pointer",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {description}
        </label>
        {isCompleted && completedByName && (
          <p className="text-xs text-muted-foreground mt-1">
            Completed by {completedByName}
            {completedAt && ` on ${new Date(completedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>
      {!isReadOnly && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isPending}
          data-testid={`button-delete-task-${id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
