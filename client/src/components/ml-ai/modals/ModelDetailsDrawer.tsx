import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ml-ai/utils/StatusBadge";
import { Model } from "@/components/ml-ai/data-display/ModelTable";
import { format } from "date-fns";
import { Play, Archive, RefreshCw, BarChart3, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelDetailsDrawerProps {
  model: Model | null;
  open: boolean;
  onClose: () => void;
  onDeploy?: (modelId: string) => void;
  onArchive?: (modelId: string) => void;
  onRetrain?: (modelId: string) => void;
  "data-testid"?: string;
}

const modelTypeLabels = {
  lstm: "LSTM Neural Network",
  "random-forest": "Random Forest",
  xgboost: "XGBoost",
};

const objectiveLabels = {
  health: "Health Score Prediction",
  failure: "Failure Prediction",
  rul: "Remaining Useful Life",
};

export function ModelDetailsDrawer({
  model,
  open,
  onClose,
  onDeploy,
  onArchive,
  onRetrain,
  "data-testid": testId,
}: ModelDetailsDrawerProps) {
  if (!model) {
    return null;
  }

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid={testId}>
        <SheetHeader className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate" data-testid={`${testId}-title`}>
                {model.name}
              </SheetTitle>
              <SheetDescription className="mt-1">
                {modelTypeLabels[model.modelType]}
              </SheetDescription>
            </div>
            <StatusBadge status={model.status} />
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Model Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Model Information</h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Type</p>
                <p className="font-medium">{modelTypeLabels[model.modelType]}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1">Objective</p>
                <p className="font-medium">{objectiveLabels[model.objective]}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1">Scope</p>
                <p className="font-medium truncate">{model.scope}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1">Status</p>
                <p className="font-medium capitalize">{model.status}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Performance Metrics */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Performance Metrics</h3>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                  <p className="text-sm font-semibold" data-testid={`${testId}-accuracy`}>
                    {model.accuracy === null ? "N/A" : `${model.accuracy.toFixed(1)}%`}
                  </p>
                </div>
                {model.accuracy !== null && (
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        model.accuracy >= 85
                          ? "bg-green-500"
                          : model.accuracy >= 70
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      )}
                      style={{ width: `${model.accuracy}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Timeline</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {format(new Date(model.createdAt), "MMM dd, yyyy")}
                </span>
              </div>

              {model.lastValidation && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Validation</span>
                  <span className="font-medium">
                    {format(new Date(model.lastValidation), "MMM dd, yyyy")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Quick Actions</h3>

            <div className="space-y-2">
              {model.status !== "deployed" && onDeploy && (
                <Button
                  onClick={() => handleAction(() => onDeploy(model.id))}
                  className="w-full justify-start"
                  variant="outline"
                  data-testid={`${testId}-action-deploy`}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Deploy Model
                </Button>
              )}

              {onRetrain && (
                <Button
                  onClick={() => handleAction(() => onRetrain(model.id))}
                  className="w-full justify-start"
                  variant="outline"
                  data-testid={`${testId}-action-retrain`}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retrain Model
                </Button>
              )}

              {model.status !== "archived" && onArchive && (
                <Button
                  onClick={() => handleAction(() => onArchive(model.id))}
                  className="w-full justify-start"
                  variant="outline"
                  data-testid={`${testId}-action-archive`}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Model
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start"
                data-testid={`${testId}-action-view-performance`}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Performance Dashboard
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
            data-testid={`${testId}-close`}
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
