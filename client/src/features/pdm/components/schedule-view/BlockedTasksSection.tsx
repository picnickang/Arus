import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight, ChevronUp, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { PdmScheduledTask } from "@/features/pdm";
import { BLOCK_REASON_LABELS, SEVERITY_BADGE_VARIANTS, SEVERITY_COLORS } from "./constants";

interface BlockedTasksSectionProps {
  tasks: PdmScheduledTask[];
  onSelectTask: (task: PdmScheduledTask) => void;
  isLoading: boolean;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
}

export function BlockedTasksSection({
  tasks,
  onSelectTask,
  isLoading,
  isExpanded,
  onExpandChange,
}: BlockedTasksSectionProps) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onExpandChange}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button
              className="flex items-center justify-between w-full text-left hover-elevate rounded-lg -m-2 p-2"
              data-testid="toggle-blocked-tasks"
            >
              <CardTitle className="text-base flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Blocked / Unassigned Tasks ({tasks.length})
              </CardTitle>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-0">
            <ScrollArea className="max-h-64">
              <div className="divide-y">
                {tasks.map((task) => {
                  const latestFinish =
                    typeof task.schedulingWindow.latestFinish === "string"
                      ? parseISO(task.schedulingWindow.latestFinish)
                      : task.schedulingWindow.latestFinish;

                  return (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="w-full p-3 flex items-center justify-between gap-3 hover-elevate text-left"
                      data-testid={`blocked-task-${task.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-10 rounded-full ${SEVERITY_COLORS[task.severity]}`}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{task.equipmentName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {task.vesselName} - {task.failureMode}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Must finish by: {format(latestFinish, "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={SEVERITY_BADGE_VARIANTS[task.severity]} className="text-xs">
                          {task.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {task.blockReason ? BLOCK_REASON_LABELS[task.blockReason] : "Blocked"}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
