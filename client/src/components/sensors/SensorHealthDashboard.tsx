// @ts-nocheck
/**
 * Sensor Health Dashboard Component
 *
 * Displays real-time sensor health metrics fetched from the backend API.
 * Renders aggregated status distribution and health scores with visual indicators.
 *
 * @module SensorHealthDashboard
 *
 * ## Responsibilities
 *
 * This component is a **presentation layer** that:
 * - Fetches pre-aggregated health metrics from `/api/equipment/:id/sensors/health`
 * - Renders health scores with color-coded indicators
 * - Displays status distribution breakdown (normal/warning/critical/offline)
 * - Handles loading, error, and empty states
 * - Auto-refreshes data every 30 seconds
 *
 * **Note**: Status aggregation, health score calculation, and business logic are performed
 * on the backend. This component only renders the server-provided metrics.
 * See `server/routes.ts` sensor-health endpoint for aggregation logic.
 *
 * ## Features
 * - Color-coded health score indicators (green/yellow/red)
 * - Status distribution with percentages
 * - Empty state handling for equipment with no sensors
 * - Auto-refresh every 30 seconds
 * - Loading skeleton and error states
 *
 * @see {@link docs/api/sensor-management.md} for API endpoint documentation
 * @see {@link server/routes.ts} for backend aggregation logic
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for SensorHealthDashboard component
 *
 * @interface SensorHealthDashboardProps
 * @property {string} equipmentId - Equipment UUID for health metrics query
 */
interface SensorHealthDashboardProps {
  equipmentId: string;
}

/**
 * Sensor health aggregation metrics
 *
 * Response from GET /api/equipment/:equipmentId/sensors/health
 * Uses 24-hour telemetry window for status determination.
 *
 * @interface SensorHealthMetrics
 * @property {number} totalSensors - Total sensor configurations
 * @property {number} activeSensors - Sensors actively reporting (not offline)
 * @property {number} normalSensors - Sensors with normal status
 * @property {number} warningSensors - Sensors with warning status
 * @property {number} criticalSensors - Sensors with critical status
 * @property {number} offlineSensors - Sensors without recent telemetry or disabled
 * @property {number} overallHealthScore - Weighted health score (0-100)
 * @property {number} dataQualityScore - Quality score based on telemetry consistency
 * @property {number} recentAnomalies - Count of recent anomalies detected
 * @property {number} uptimePercentage - Percentage of sensors with recent telemetry
 */
interface SensorHealthMetrics {
  totalSensors: number;
  activeSensors: number;
  normalSensors: number;
  warningSensors: number;
  criticalSensors: number;
  offlineSensors: number;
  overallHealthScore: number;
  dataQualityScore: number;
  recentAnomalies: number;
  uptimePercentage: number;
}

export function SensorHealthDashboard({ equipmentId }: SensorHealthDashboardProps) {
  const {
    data: metrics,
    isLoading,
    error,
  } = useQuery<SensorHealthMetrics>({
    queryKey: ["/api/equipment", equipmentId, "sensor-health"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <LoadingState variant="card" message="Loading sensor health data..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load sensor health"
        message="Unable to retrieve sensor health metrics. Please try again."
      />
    );
  }

  if (!metrics) {
    return null;
  }

  if (metrics.totalSensors === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Sensors Configured</h3>
            <p className="text-sm text-muted-foreground">
              Configure sensors for this equipment to view health metrics.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const healthScoreColor =
    metrics.overallHealthScore >= 90
      ? "text-green-600 dark:text-green-400"
      : metrics.overallHealthScore >= 70
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  const healthScoreBg =
    metrics.overallHealthScore >= 90
      ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
      : metrics.overallHealthScore >= 70
        ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
        : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";

  const safePercentage = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

  return (
    <div className="space-y-4" data-testid="sensor-health-dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={cn("border-2", healthScoreBg)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className={cn("text-3xl font-bold", healthScoreColor)}>
                  {metrics.overallHealthScore}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">System Performance</p>
              </div>
              {metrics.overallHealthScore >= 90 ? (
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              ) : metrics.overallHealthScore >= 70 ? (
                <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              )}
            </div>
            <Progress
              value={metrics.overallHealthScore}
              className="mt-3"
              data-testid="health-score-progress"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sensors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">
                  {metrics.activeSensors}/{metrics.totalSensors}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Online & Reporting</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <Progress
              value={safePercentage(metrics.activeSensors, metrics.totalSensors)}
              className="mt-3"
              data-testid="active-sensors-progress"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{metrics.dataQualityScore}%</div>
                <p className="text-xs text-muted-foreground mt-1">Accuracy & Consistency</p>
              </div>
              {metrics.dataQualityScore >= 90 ? (
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <Progress
              value={metrics.dataQualityScore}
              className="mt-3"
              data-testid="data-quality-progress"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{metrics.uptimePercentage}%</div>
                <p className="text-xs text-muted-foreground mt-1">Last 30 Days</p>
              </div>
              <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <Progress
              value={metrics.uptimePercentage}
              className="mt-3"
              data-testid="uptime-progress"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sensor Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between" data-testid="status-normal">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {metrics.normalSensors} sensors
                </span>
                <Badge variant="outline" className="text-green-600 dark:text-green-400">
                  {Math.round(safePercentage(metrics.normalSensors, metrics.totalSensors))}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between" data-testid="status-warning">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm font-medium">Warning</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {metrics.warningSensors} sensors
                </span>
                <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">
                  {Math.round(safePercentage(metrics.warningSensors, metrics.totalSensors))}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between" data-testid="status-critical">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium">Critical</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {metrics.criticalSensors} sensors
                </span>
                <Badge variant="outline" className="text-red-600 dark:text-red-400">
                  {Math.round(safePercentage(metrics.criticalSensors, metrics.totalSensors))}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between" data-testid="status-offline">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm font-medium">Offline</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {metrics.offlineSensors} sensors
                </span>
                <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                  {Math.round(safePercentage(metrics.offlineSensors, metrics.totalSensors))}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                  {metrics.recentAnomalies}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Detected in last 24 hours</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-orange-600 dark:text-orange-400 opacity-20" />
            </div>
            {metrics.recentAnomalies > 0 && (
              <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md">
                <p className="text-xs text-orange-800 dark:text-orange-200">
                  {metrics.recentAnomalies} anomal{metrics.recentAnomalies === 1 ? "y" : "ies"}{" "}
                  detected. Review sensor data for potential issues.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
