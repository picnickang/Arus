import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { formatDecimal } from "@/lib/formatters";
import { formatDurationMs } from "@/features/maintenance";
import { StatusBadge } from "./StatusBadge";

export function RunsTab({ o }: { o: any }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Optimization Results
            </CardTitle>
            <CardDescription>Monitor optimization runs and review results</CardDescription>
          </div>
          {o.filteredResults.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    `Delete all ${o.filteredResults.length} optimization result(s)? This cannot be undone.`
                  )
                ) {
                  o.clearAllOptimizationsMutation.mutate();
                }
              }}
              disabled={o.clearAllOptimizationsMutation.isPending}
              data-testid="button-clear-all-results"
            >
              {o.clearAllOptimizationsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {o.resultsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : o.filteredResults.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
            No optimization results found
          </div>
        ) : (
          <div className="space-y-4">
            {o.filteredResults.map((result: { id: string; configurationId: string; runStatus: string; costSavings: number; executionTimeMs: number; startTime: string; totalSchedules: number; optimizationScore?: number; conflictsResolved?: number; appliedToProduction?: boolean }) => {
              const config = o.configurations?.find(
                (c: { id: string; name: string }) => c.id === result.configurationId
              );
              return (
                <Card key={result.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h3
                            className="font-semibold"
                            data-testid={`text-result-config-${result.id}`}
                          >
                            {config?.name || "Unknown Configuration"}
                          </h3>
                          <StatusBadge status={result.runStatus} getBadgeMeta={o.getStatusBadge} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Started:</span>
                            <p className="font-medium">
                              {new Date(result.startTime).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Duration:</span>
                            <p className="font-medium" data-testid={`text-duration-${result.id}`}>
                              {formatDurationMs(result.executionTimeMs)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Schedules:</span>
                            <p className="font-medium">{result.totalSchedules}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cost Savings:</span>
                            <p
                              className="font-medium text-green-600"
                              data-testid={`text-savings-${result.id}`}
                            >
                              {o.formatCurrency(result.costSavings)}
                            </p>
                          </div>
                        </div>
                        {result.runStatus === "completed" && result.optimizationScore && (
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                Optimization Score:
                              </span>
                              <Badge variant="outline" className="font-mono">
                                {formatDecimal(result.optimizationScore, 2)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                Conflicts Resolved:
                              </span>
                              <Badge variant="outline">{result.conflictsResolved}</Badge>
                            </div>
                          </div>
                        )}
                        {result.runStatus === "running" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Optimization in progress...</span>
                              <span>
                                {formatDurationMs(
                                  Date.now() - new Date(result.startTime).getTime()
                                )}
                              </span>
                            </div>
                            <Progress value={65} className="w-full" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {result.runStatus === "completed" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => o.downloadOptimizationMutation.mutate(result.id)}
                              disabled={o.downloadOptimizationMutation.isPending}
                              data-testid={`button-download-${result.id}`}
                            >
                              {o.downloadOptimizationMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              Download
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => o.applyToProductionMutation.mutate(result.id)}
                              disabled={
                                result.appliedToProduction ||
                                o.applyToProductionMutation.isPending
                              }
                              data-testid={`button-apply-${result.id}`}
                            >
                              {o.applyToProductionMutation.isPending && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              {result.appliedToProduction ? "Applied" : "Apply to Production"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Delete this optimization result? This cannot be undone."
                                  )
                                ) {
                                  o.deleteOptimizationMutation.mutate(result.id);
                                }
                              }}
                              disabled={o.deleteOptimizationMutation.isPending}
                              data-testid={`button-delete-result-${result.id}`}
                            >
                              {o.deleteOptimizationMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        {result.runStatus === "failed" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                o.runOptimizationMutation.mutate({
                                  configId: result.configurationId,
                                })
                              }
                              disabled={o.runOptimizationMutation.isPending}
                              data-testid={`button-restart-${result.id}`}
                            >
                              {o.runOptimizationMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4 mr-2" />
                              )}
                              Retry
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Delete this failed optimization result? This cannot be undone."
                                  )
                                ) {
                                  o.deleteOptimizationMutation.mutate(result.id);
                                }
                              }}
                              disabled={o.deleteOptimizationMutation.isPending}
                              data-testid={`button-delete-result-${result.id}`}
                            >
                              {o.deleteOptimizationMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        {result.runStatus === "running" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => o.cancelOptimizationMutation.mutate(result.id)}
                            disabled={o.cancelOptimizationMutation.isPending}
                            data-testid={`button-cancel-${result.id}`}
                          >
                            {o.cancelOptimizationMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
