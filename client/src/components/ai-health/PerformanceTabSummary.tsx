import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getFriendlyModelName } from "@/lib/ml-terminology";
import type { PerformanceTabModel } from "./PerformanceTabTypes";

export function AccuracyBadge({
  accuracy,
  m,
}: {
  accuracy: number | null;
  m: PerformanceTabModel;
}) {
  const d = m.getAccuracyBadgeData(accuracy);
  if (d.isPending) {
    return (
      <Badge variant="secondary" data-testid="badge-pending">
        Pending
      </Badge>
    );
  }
  return (
    <Badge
      className={d.className}
      data-testid={`badge-${d.label.toLowerCase().replace(" ", "-")}`}
      title={d.description}
    >
      {d.label} ({d.percent.toFixed(1)}%)
    </Badge>
  );
}

export function PerformanceStatsCards({ m }: { m: PerformanceTabModel }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      <Card className="flex-1 min-w-[200px] p-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              Active AI Models
              <InfoTooltip content="Number of different AI models currently making predictions for your equipment." />
            </p>
            {m.summaryLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold" data-testid="stat-active-models">
                {m.overallMetrics?.totalModels || 0}
              </p>
            )}
          </div>
        </div>
      </Card>
      <Card className="flex-1 min-w-[200px] p-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-500" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Total Predictions</p>
            {m.summaryLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold" data-testid="stat-total-predictions">
                {m.overallMetrics?.totalPredictions || 0}
              </p>
            )}
          </div>
        </div>
      </Card>
      <Card className="flex-1 min-w-[200px] p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              Validated
              <InfoTooltip content="Predictions that have been checked against actual equipment failures to measure accuracy." />
            </p>
            {m.summaryLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold" data-testid="stat-validated">
                {m.overallMetrics?.totalValidated || 0}
                <span className="text-sm text-muted-foreground ml-1">
                  ({m.validationRate.toFixed(0)}%)
                </span>
              </p>
            )}
          </div>
        </div>
      </Card>
      <Card className="flex-1 min-w-[200px] p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              Avg Accuracy
              <InfoTooltip content="How often the AI predictions are correct. 90%+ is excellent, 80%+ is good." />
            </p>
            {m.summaryLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold" data-testid="stat-avg-accuracy">
                {m.overallAvgAccuracy.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function CriticalDriftAlert({ m }: { m: PerformanceTabModel }) {
  if (m.criticalDrift.length === 0) {
    return null;
  }
  return (
    <Alert variant="destructive" data-testid="alert-drift">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Model Accuracy Declining</AlertTitle>
      <AlertDescription>
        <strong>
          {m.criticalDrift.length} model{m.criticalDrift.length > 1 ? "s have" : " has"}
        </strong>{" "}
        accuracy drops of {Math.abs(m.criticalDrift[0].driftPercent).toFixed(1)}%+.
        <div className="mt-3 space-y-2">
          <div className="font-semibold">Recommended Actions:</div>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Schedule model retraining this week with recent data</li>
            <li>Review if new equipment or maintenance procedures were introduced</li>
          </ul>
          <Button size="sm" className="mt-2" data-testid="button-schedule-retraining">
            <RefreshCw className="h-3 w-3 mr-1" />
            Schedule Retraining
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function ModelSummaryCard({ m }: { m: PerformanceTabModel }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base" data-testid="heading-model-summary">
          Model Performance Summary
        </CardTitle>
        <CardDescription>Accuracy metrics by model</CardDescription>
      </CardHeader>
      <CardContent>
        {m.summaryLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : m.summary && m.summary.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Predictions</TableHead>
                  <TableHead className="text-right">Validated</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead>Last Validation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.summary.map((modelRow, index) => {
                  const model = modelRow as typeof modelRow & {
                    modelName?: string;
                    totalPredictions?: number;
                    validatedPredictions?: number;
                  };
                  return (
                    <TableRow key={model.modelId} data-testid={`row-model-${index}`}>
                      <TableCell className="font-medium">
                        {model.modelName || model.modelId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getFriendlyModelName(model.modelType ?? "")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{model.totalPredictions}</TableCell>
                      <TableCell className="text-right">{model.validatedPredictions}</TableCell>
                      <TableCell className="text-right">
                        <AccuracyBadge accuracy={model.avgAccuracy} m={m} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {model.lastValidation
                          ? formatDistanceToNow(new Date(model.lastValidation), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            No model performance data available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
