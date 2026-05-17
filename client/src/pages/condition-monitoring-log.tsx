import { format } from "date-fns";
import {
  Activity,
  Ship,
  Calendar,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Heart,
  Waves,
  AlertCircle,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useConditionMonitoringData } from "@/features/deck-logbook";

const HealthGradeColors: Record<string, string> = {
  A: "bg-green-500 text-white",
  B: "bg-green-400 text-white",
  C: "bg-yellow-400 text-black",
  D: "bg-orange-400 text-white",
  F: "bg-red-500 text-white",
};
const ConditionRatingColors: Record<string, string> = {
  good: "text-green-600 bg-green-100 dark:bg-green-900/30",
  fair: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
  poor: "text-orange-600 bg-orange-100 dark:bg-orange-900/30",
  critical: "text-red-600 bg-red-100 dark:bg-red-900/30",
};
const ConditionRatingIcons: Record<string, typeof CheckCircle2> = {
  good: CheckCircle2,
  fair: AlertCircle,
  poor: AlertTriangle,
  critical: XCircle,
};

export default function ConditionMonitoringLogPage() {
  const {
    vessels,
    vesselEquipment,
    logs,
    logsLoading,
    vesselSummary,
    selectedVessel,
    setSelectedVessel,
    selectedEquipment,
    setSelectedEquipment,
    dateRange,
    setDateRange,
    activeTab,
    setActiveTab,
    avgHealth,
    totalAlerts,
    criticalAlerts,
    criticalCount,
    uniqueEquipmentCount,
    lowestHealthLogs,
    autoFillMutation,
    handleAutoFill,
    getEquipmentName,
  } = useConditionMonitoringData();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        <Select value={selectedVessel} onValueChange={setSelectedVessel}>
          <SelectTrigger className="w-[200px]" data-testid="select-vessel">
            <Ship className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Vessels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vessels</SelectItem>
            {vessels
              .filter((v) => v.id)
              .map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
          <SelectTrigger className="w-[200px]" data-testid="select-equipment">
            <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Equipment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Equipment</SelectItem>
            {vesselEquipment
              .filter((e) => e.id)
              .map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  {eq.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]" data-testid="select-date-range">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
        {selectedVessel && selectedVessel !== "all" && (
          <Button
            variant="outline"
            onClick={() => handleAutoFill(selectedVessel)}
            disabled={autoFillMutation.isPending}
            data-testid="button-autofill"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${autoFillMutation.isPending ? "animate-spin" : ""}`}
            />
            Auto-fill from CM Data
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Health</CardTitle>
            <Heart className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-health">
              {avgHealth.toFixed(1)}%
            </div>
            <Progress value={avgHealth} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Average health index</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipment Monitored</CardTitle>
            <Settings className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-equipment-count">
              {vesselSummary?.equipmentCount || uniqueEquipmentCount}
            </div>
            <p className="text-xs text-muted-foreground">{logs.length} log entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-alerts">
              {totalAlerts}
            </div>
            <p className="text-xs text-muted-foreground">{criticalAlerts} critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Equipment</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-critical-count">
              {criticalCount}
            </div>
            <p className="text-xs text-muted-foreground">Needs immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Waves className="h-4 w-4 mr-2" />
            Log Entries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Health Grade Distribution</CardTitle>
                <CardDescription>Equipment by health grade</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No condition data for this period</p>
                    {selectedVessel && selectedVessel !== "all" && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => handleAutoFill(selectedVessel)}
                        data-testid="button-autofill-empty"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate from CM Data
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {["A", "B", "C", "D", "F"].map((grade) => {
                      const count = logs.filter((l) => l.healthGrade === grade).length;
                      const percentage = logs.length > 0 ? (count / logs.length) * 100 : 0;
                      return (
                        <div key={grade} className="flex items-center gap-3">
                          <Badge className={HealthGradeColors[grade]}>{grade}</Badge>
                          <div className="flex-1">
                            <Progress value={percentage} className="h-2" />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Condition Rating Summary</CardTitle>
                <CardDescription>Current equipment conditions</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="space-y-3">
                    {["good", "fair", "poor", "critical"].map((rating) => {
                      const Icon = ConditionRatingIcons[rating];
                      const count = logs.filter((l) => l.conditionRating === rating).length;
                      return (
                        <div key={rating} className="flex items-center gap-3">
                          <Badge className={ConditionRatingColors[rating]}>
                            <Icon className="h-3 w-3 mr-1" />
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </Badge>
                          <div className="flex-1" />
                          <span className="text-lg font-bold">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Equipment with Lowest Health</CardTitle>
              <CardDescription>Equipment requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="space-y-3">
                  {lowestHealthLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={HealthGradeColors[log.healthGrade || "F"]}>
                          {log.healthGrade}
                        </Badge>
                        <div>
                          <p className="font-medium">{getEquipmentName(log.equipmentId ?? "")}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(log.periodStart as any), "MMM dd, HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{log.healthIndex?.toFixed(0)}%</div>
                        {log.rulDays && (
                          <p className="text-sm text-muted-foreground">RUL: {log.rulDays} days</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Condition Monitoring Log Entries</CardTitle>
              <CardDescription>
                Detailed health metrics, vibration analysis, and anomaly scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No log entries for this period</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-right">Health %</TableHead>
                        <TableHead className="text-right">Vib RMS</TableHead>
                        <TableHead className="text-right">Anomaly Score</TableHead>
                        <TableHead className="text-right">Alerts</TableHead>
                        <TableHead className="text-right">RUL (days)</TableHead>
                        <TableHead>Quality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.slice(0, 50).map((logRaw) => {
                        const log = logRaw as typeof logRaw & {
                          alertsCount?: number | null;
                          criticalAlertsCount?: number | null;
                          dataQuality?: string | null;
                        };
                        return (
                        <TableRow key={log.id} data-testid={`row-condition-log-${log.id}`}>
                          <TableCell className="font-medium">
                            {format(new Date(log.periodStart as any), "MMM dd HH:mm")}
                          </TableCell>
                          <TableCell>{getEquipmentName(log.equipmentId ?? "")}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={HealthGradeColors[log.healthGrade || "F"]}>
                              {log.healthGrade}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {log.healthIndex?.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.vibrationRmsAvg?.toFixed(2) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.mlAnomalyScoreAvg === null || log.mlAnomalyScoreAvg === undefined
                              ? "-"
                              : `${(log.mlAnomalyScoreAvg * 100).toFixed(1)}%`}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.alertsCount || 0}
                            {(log.criticalAlertsCount || 0) > 0 && (
                              <Badge variant="destructive" className="ml-1 text-xs">
                                {log.criticalAlertsCount}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{log.rulDays || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={log.dataQuality === "high" ? "default" : "outline"}
                              className={log.dataQuality === "high" ? "bg-green-600" : ""}
                            >
                              {log.dataQuality}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
