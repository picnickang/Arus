import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ml-ai/utils/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreVertical, Play, Archive, Eye, RefreshCw, Trash2, ArrowUpDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export interface Model {
  id: string;
  name: string;
  modelType: "lstm" | "random-forest" | "xgboost";
  objective: "health" | "failure" | "rul";
  scope: string;
  status: "training" | "deployed" | "archived";
  accuracy: number | null;
  lastValidation: Date | null;
  createdAt: Date;
}

interface ModelTableProps {
  models: Model[];
  loading?: boolean;
  onViewDetails: (modelId: string) => void;
  onTrain?: (modelId: string) => void;
  onDeploy: (modelId: string) => void;
  onArchive: (modelId: string) => void;
  onDelete?: (modelId: string) => void;
  className?: string;
  "data-testid"?: string;
}

type SortField = "name" | "modelType" | "accuracy" | "lastValidation" | "createdAt";
type SortDirection = "asc" | "desc";

const modelTypeLabels = {
  lstm: "LSTM",
  "random-forest": "Random Forest",
  xgboost: "XGBoost",
};

const objectiveLabels = {
  health: "Health Score",
  failure: "Failure Prediction",
  rul: "RUL Estimation",
};

export function ModelTable({
  models,
  loading = false,
  onViewDetails,
  onTrain,
  onDeploy,
  onArchive,
  onDelete,
  className,
  "data-testid": testId,
}: ModelTableProps) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedModels = [...models].sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;

    if (sortField === "accuracy") {
      return ((a.accuracy || 0) - (b.accuracy || 0)) * multiplier;
    }

    if (sortField === "lastValidation" || sortField === "createdAt") {
      const aDate = sortField === "lastValidation" ? a.lastValidation : a.createdAt;
      const bDate = sortField === "lastValidation" ? b.lastValidation : b.createdAt;
      if (!aDate) {
        return 1;
      }
      if (!bDate) {
        return -1;
      }
      return (new Date(aDate).getTime() - new Date(bDate).getTime()) * multiplier;
    }

    return String(a[sortField]).localeCompare(String(b[sortField])) * multiplier;
  });

  if (loading) {
    return (
      <div className="space-y-3" data-testid={`${testId}-loading`}>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <Card className="p-8 text-center" data-testid={`${testId}-empty`}>
        <p className="text-muted-foreground">
          No models yet. Train your first model to get started.
        </p>
      </Card>
    );
  }

  return (
    <div className={className} data-testid={testId}>
      {/* Mobile: Card Layout */}
      <div className="space-y-3 md:hidden">
        {sortedModels.map((model, index) => (
          <Card key={model.id} className="p-4" data-testid={`model-card-${index}`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate" data-testid={`model-card-${index}-name`}>
                    {model.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {modelTypeLabels[model.modelType]}
                  </p>
                </div>
                <StatusBadge status={model.status} size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Objective:</span>
                  <span className="ml-1 font-medium">{objectiveLabels[model.objective]}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Scope:</span>
                  <span className="ml-1 font-medium truncate">{model.scope}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Accuracy:</span>
                  <span className="ml-1 font-medium">
                    {model.accuracy !== null ? `${model.accuracy.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span className="ml-1 font-medium">
                    {model.lastValidation
                      ? formatDistanceToNow(new Date(model.lastValidation), { addSuffix: true })
                      : "—"}
                  </span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    data-testid={`model-card-${index}-actions`}
                  >
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewDetails(model.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>

                  {model.status !== "deployed" && (
                    <DropdownMenuItem onClick={() => onDeploy(model.id)}>
                      <Play className="mr-2 h-4 w-4" />
                      Deploy Model
                    </DropdownMenuItem>
                  )}

                  {onTrain && (
                    <DropdownMenuItem onClick={() => onTrain(model.id)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retrain
                    </DropdownMenuItem>
                  )}

                  {model.status !== "archived" && (
                    <DropdownMenuItem onClick={() => onArchive(model.id)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  )}

                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(model.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 hover:text-foreground"
                  data-testid="sort-name"
                >
                  Model Name
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("modelType")}
                  className="flex items-center gap-1 hover:text-foreground"
                  data-testid="sort-type"
                >
                  Type
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </TableHead>
              <TableHead>Objective</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("accuracy")}
                  className="flex items-center gap-1 hover:text-foreground"
                  data-testid="sort-accuracy"
                >
                  Accuracy
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("lastValidation")}
                  className="flex items-center gap-1 hover:text-foreground"
                  data-testid="sort-last-validation"
                >
                  Last Updated
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedModels.map((model, index) => (
              <TableRow key={model.id} data-testid={`model-row-${index}`}>
                <TableCell className="font-medium" data-testid={`model-row-${index}-name`}>
                  {model.name}
                </TableCell>
                <TableCell>{modelTypeLabels[model.modelType]}</TableCell>
                <TableCell>{objectiveLabels[model.objective]}</TableCell>
                <TableCell className="max-w-[150px] truncate">{model.scope}</TableCell>
                <TableCell>
                  {model.accuracy !== null ? `${model.accuracy.toFixed(1)}%` : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={model.status} size="sm" />
                </TableCell>
                <TableCell>
                  {model.lastValidation
                    ? formatDistanceToNow(new Date(model.lastValidation), { addSuffix: true })
                    : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`model-row-${index}-actions`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails(model.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>

                      {model.status !== "deployed" && (
                        <DropdownMenuItem onClick={() => onDeploy(model.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          Deploy Model
                        </DropdownMenuItem>
                      )}

                      {onTrain && (
                        <DropdownMenuItem onClick={() => onTrain(model.id)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retrain
                        </DropdownMenuItem>
                      )}

                      {model.status !== "archived" && (
                        <DropdownMenuItem onClick={() => onArchive(model.id)}>
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      )}

                      {onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(model.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
