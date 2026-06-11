import { format, parseISO } from "date-fns";
import {
  Activity,
  Calendar,
  ExternalLink,
  MoveHorizontal,
  Settings,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateWorkOrderFromRisk } from "@/features/pdm";
import type { PdmScheduledTask } from "@/features/pdm";
import { BLOCK_REASON_LABELS, SEVERITY_BADGE_VARIANTS } from "./constants";
import { RulGauge } from "./RulGauge";

interface TaskDetailPanelProps {
  task: PdmScheduledTask | null;
  isOpen: boolean;
  onClose: () => void;
  onMoveTask: (task: PdmScheduledTask) => void;
}

export function TaskDetailPanel({ task, isOpen, onClose, onMoveTask }: TaskDetailPanelProps) {
  const createWoMutation = useCreateWorkOrderFromRisk();

  if (!task) {
    return null;
  }

  const handleCreateWorkOrder = async () => {
    await createWoMutation.mutateAsync(task.alertId);
    onClose();
  };

  const dataQuality = task.confidence >= 80 ? "High" : task.confidence >= 60 ? "Medium" : "Low";
  const urgency =
    task.rulP50Days <= 7
      ? "Inspect this watch or next port window."
      : task.rulP50Days <= 30
        ? "Schedule within this maintenance cycle."
        : "Monitor trend and schedule before the latest finish date.";
  const costOfIgnoring = [
    task.estimatedDowntimeHours ? `${task.estimatedDowntimeHours}h estimated downtime` : null,
    task.estimatedCost ? `${task.estimatedCost.toLocaleString()} estimated exposure` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {task.equipmentName}
          </SheetTitle>
          <SheetDescription>
            {task.vesselName} - {task.equipmentType}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_BADGE_VARIANTS[task.severity]}>
              {task.severity.toUpperCase()}
            </Badge>
            <Badge variant={task.status === "blocked" ? "destructive" : "secondary"}>
              {task.status.replace("_", " ").toUpperCase()}
            </Badge>
            {task.workOrderId && (
              <Badge variant="outline" className="gap-1">
                WO Linked <ExternalLink className="h-3 w-3" />
              </Badge>
            )}
          </div>

          <div
            className="rounded-lg border bg-muted/30 p-4 space-y-3"
            data-testid="pdm-decision-summary"
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-medium text-sm">Decision Summary</h4>
              <Badge variant="outline">Data quality: {dataQuality}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {task.equipmentName} is trending toward{" "}
              <span className="font-medium text-foreground">{task.failureMode}</span>. Confidence is{" "}
              {task.confidence}%, with a P50 remaining useful life of {task.rulP50Days} days.
            </p>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="font-medium">Next action:</span> {urgency}
              </div>
              <div>
                <span className="font-medium">Cost of ignoring:</span>{" "}
                {costOfIgnoring || "Not yet estimated"}
              </div>
              <div>
                <span className="font-medium">Best path:</span> create a work order, complete the
                guided closeout, then record whether the PdM prediction was correct.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Failure Mode</h4>
            <p className="text-sm text-muted-foreground">{task.failureMode}</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              RUL Estimate
            </h4>
            <RulGauge p10={task.rulP10Days} p50={task.rulP50Days} p90={task.rulP90Days} />
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Confidence Score
            </h4>
            <div className="flex items-center gap-2">
              <Progress value={task.confidence} className="flex-1" />
              <span className="text-sm font-medium">{task.confidence}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Est. Downtime</div>
              <div className="font-medium">{task.estimatedDowntimeHours} hours</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Est. Cost</div>
              <div className="font-medium">${task.estimatedCost.toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduling Window
            </h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Earliest Start:</span>
                <span>
                  {format(
                    typeof task.schedulingWindow.earliestStart === "string"
                      ? parseISO(task.schedulingWindow.earliestStart)
                      : task.schedulingWindow.earliestStart,
                    "MMM d, yyyy"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preferred Date:</span>
                <span className="font-medium">
                  {format(
                    typeof task.schedulingWindow.preferredDate === "string"
                      ? parseISO(task.schedulingWindow.preferredDate)
                      : task.schedulingWindow.preferredDate,
                    "MMM d, yyyy"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latest Finish:</span>
                <span>
                  {format(
                    typeof task.schedulingWindow.latestFinish === "string"
                      ? parseISO(task.schedulingWindow.latestFinish)
                      : task.schedulingWindow.latestFinish,
                    "MMM d, yyyy"
                  )}
                </span>
              </div>
              {task.scheduledDate && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Scheduled:</span>
                  <span className="font-medium text-primary">
                    {format(
                      typeof task.scheduledDate === "string"
                        ? parseISO(task.scheduledDate)
                        : task.scheduledDate,
                      "MMM d, yyyy"
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {task.blockReason && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-medium text-sm text-red-700 dark:text-red-400">Block Reason</h4>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                {BLOCK_REASON_LABELS[task.blockReason]}
              </p>
              {task.blockDetails && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">{task.blockDetails}</p>
              )}
            </div>
          )}

          {task.recommendedActions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Recommended Actions
              </h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                {task.recommendedActions.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4 border-t">
            {task.status !== "wo_created" && (
              <Button
                onClick={handleCreateWorkOrder}
                disabled={createWoMutation.isPending}
                className="w-full"
                data-testid="btn-create-wo"
              >
                <Wrench className="h-4 w-4 mr-2" />
                {createWoMutation.isPending ? "Creating..." : "Create Work Order"}
              </Button>
            )}
            {task.status !== "blocked" && (
              <div className="space-y-1">
                <Button
                  variant="outline"
                  disabled
                  className="w-full"
                  data-testid="btn-move-task-disabled"
                  title="Schedule move is disabled until the schedule-write API is available. Update the linked work order instead."
                >
                  <MoveHorizontal className="h-4 w-4 mr-2" />
                  Move Task (write API pending)
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  To change execution date today, update the linked work order or create one from
                  this risk.
                </p>
              </div>
            )}
            <Button variant="ghost" asChild className="w-full">
              <a href={`/pdm/equipment/${task.equipmentId}`} data-testid="link-view-alert">
                <ExternalLink className="h-4 w-4 mr-2" />
                View PdM Alert
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
