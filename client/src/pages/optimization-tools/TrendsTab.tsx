import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, TrendingDown, TrendingUp } from "lucide-react";

type OptimizationData = ReturnType<typeof import("@/features/maintenance").useOptimizationData>;

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "N/A";
}

export function TrendsTab({ o }: { o: OptimizationData }) {
  const trends = o.trendAnalyses ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Enhanced Trend Analytics
        </CardTitle>
        <CardDescription>
          Advanced statistical analysis and forecasting insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        {o.trendsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : trends.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground"
            data-testid="empty-trend-insights"
          >
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No trend insights are available yet.</p>
            <p className="text-sm mt-2">
              Run optimization or telemetry analysis to generate fleet trend records.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="list-trend-insights">
            {trends.map((trend, index) => {
              const direction = trend.statisticalSummary.trend.trendType;
              const DirectionIcon = direction === "decreasing" ? TrendingDown : TrendingUp;
              return (
                <div
                  key={`${trend.equipmentId}-${trend.sensorType}-${index}`}
                  className="rounded-md border p-4"
                  data-testid={`trend-insight-${index}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium">
                        {trend.sensorType} · {trend.equipmentId}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(trend.timeRange.start).toLocaleDateString()} -{" "}
                        {new Date(trend.timeRange.end).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="capitalize">
                        <DirectionIcon className="mr-1 h-3 w-3" />
                        {direction}
                      </Badge>
                      <Badge
                        variant={
                          trend.anomalyDetection.severity === "critical" ||
                          trend.anomalyDetection.severity === "high"
                            ? "destructive"
                            : "secondary"
                        }
                        className="capitalize"
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {trend.anomalyDetection.severity}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Mean</div>
                      <div className="font-medium">
                        {formatNumber(trend.statisticalSummary.mean)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Std. Dev.</div>
                      <div className="font-medium">
                        {formatNumber(trend.statisticalSummary.standardDeviation)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Anomaly Rate</div>
                      <div className="font-medium">
                        {formatNumber(trend.anomalyDetection.anomalyRate)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Forecast Confidence</div>
                      <div className="font-medium">
                        {formatNumber(trend.forecasting.confidence)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
