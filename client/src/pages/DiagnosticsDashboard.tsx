// @ts-nocheck
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  Database,
  Cpu,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Server,
  Zap,
  TestTube,
  Settings,
  Play,
  Loader2,
  FileText,
} from "lucide-react";
import { useDiagnosticsData } from "@/features/settings";
import { formatNumber, formatDate } from "@/lib/formatters";
import { PageHeader } from "@/components/navigation";

interface DiagnosticsDashboardProps {
  embedded?: boolean;
}

export default function DiagnosticsDashboard({ embedded = false }: DiagnosticsDashboardProps) {
  const {
    health,
    healthLoading,
    metrics,
    metricsLoading,
    telemetryStats,
    testSuites,
    config,
    selectedOutput,
    setSelectedOutput,
    runTestMutation,
    getTestStatusIcon,
    getTestStatusBadgeVariant,
    getStatusIcon,
    getStatusBadgeVariant,
    formatUptime,
  } = useDiagnosticsData();

  const StatusIcon = ({ status }: { status: string | undefined }) => {
    const Icon = getStatusIcon(status);
    return Icon ? (
      <Icon
        className={`h-5 w-5 ${status === "pass" || status === "healthy" ? "text-green-500" : status === "warn" || status === "degraded" ? "text-yellow-500" : "text-red-500"}`}
      />
    ) : null;
  };
  const TestIcon = ({ status }: { status: string | undefined }) => {
    const Icon = getTestStatusIcon(status);
    return (
      <Icon
        className={`h-4 w-4 ${status === "passed" ? "text-green-500" : status === "failed" ? "text-red-500" : status === "running" ? "text-blue-500 animate-spin" : "text-muted-foreground"}`}
      />
    );
  };

  return (
    <div className="min-h-screen" data-testid="diagnostics-dashboard">
      {!embedded && <PageHeader title="System Diagnostics" />}
      <div className="container mx-auto p-6 space-y-6">
        {health && (
          <div className="flex items-center justify-end gap-2">
            <StatusIcon status={health.status} />
            <Badge variant={getStatusBadgeVariant(health.status)}>{health.status}</Badge>
          </div>
        )}

        <Tabs defaultValue="health" className="space-y-4">
          <TabsList>
            <TabsTrigger value="health" data-testid="tab-health">
              <Activity className="h-4 w-4 mr-2" />
              Health
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">
              <Zap className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="telemetry" data-testid="tab-telemetry">
              <Server className="h-4 w-4 mr-2" />
              Telemetry
            </TabsTrigger>
            <TabsTrigger value="tests" data-testid="tab-tests">
              <TestTube className="h-4 w-4 mr-2" />
              Test Suites
            </TabsTrigger>
            <TabsTrigger value="config" data-testid="tab-config">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-overall-status">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {healthLoading ? (
                    <div className="animate-pulse h-8 bg-muted rounded" />
                  ) : health ? (
                    <div className="flex items-center gap-2">
                      <StatusIcon status={health.status} />
                      <span className="text-2xl font-bold capitalize">{health.status}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card data-testid="card-uptime">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {health ? formatUptime(health.uptime) : "--"}
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-version">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Version</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{health?.version || "--"}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-node-version">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Node.js</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.nodeVersion || "--"}</div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card data-testid="card-database-check">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {health?.checks.database && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <Badge variant={getStatusBadgeVariant(health.checks.database.status)}>
                          {health.checks.database.status}
                        </Badge>
                      </div>
                      {health.checks.database.responseTimeMs && (
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Response Time</span>
                          <span>{health.checks.database.responseTimeMs}ms</span>
                        </div>
                      )}
                      {health.checks.database.message && (
                        <p className="text-sm text-muted-foreground">
                          {health.checks.database.message}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card data-testid="card-telemetry-check">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Telemetry
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {health?.checks.telemetry && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <Badge variant={getStatusBadgeVariant(health.checks.telemetry.status)}>
                          {health.checks.telemetry.status}
                        </Badge>
                      </div>
                      {health.checks.telemetry.details?.bufferUtilization !== undefined && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>Buffer Utilization</span>
                            <span>{health.checks.telemetry.details.bufferUtilization}%</span>
                          </div>
                          <Progress value={health.checks.telemetry.details.bufferUtilization} />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card data-testid="card-memory-check">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Memory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {health?.checks.memory && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <Badge variant={getStatusBadgeVariant(health.checks.memory.status)}>
                          {health.checks.memory.status}
                        </Badge>
                      </div>
                      {health.checks.memory.details?.utilizationPercent !== undefined && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>Heap Usage</span>
                            <span>
                              {health.checks.memory.details.heapUsedMB}MB (
                              {health.checks.memory.details.utilizationPercent}%)
                            </span>
                          </div>
                          <Progress
                            value={health.checks.memory.details.utilizationPercent}
                            className={
                              health.checks.memory.details.utilizationPercent > 80
                                ? "bg-red-200"
                                : ""
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            {health?.checks.services && health.checks.services.length > 0 && (
              <Card data-testid="card-services">
                <CardHeader>
                  <CardTitle>Services</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {health.checks.services.map((service, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded border">
                        <span className="font-medium">{service.name}</span>
                        <Badge variant={getStatusBadgeVariant(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="card-memory-details">
                <CardHeader>
                  <CardTitle>Memory Usage</CardTitle>
                  <CardDescription>Real-time heap and memory allocation</CardDescription>
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-4 bg-muted rounded" />
                      <div className="h-4 bg-muted rounded w-3/4" />
                    </div>
                  ) : metrics ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Heap Used</span>
                          <span>
                            {metrics.memory.heapUsedMB} MB / {metrics.memory.heapTotalMB} MB
                          </span>
                        </div>
                        <Progress value={metrics.memory.utilizationPercent} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>External Memory</span>
                        <span>{metrics.memory.externalMB} MB</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Utilization</span>
                        <span
                          className={metrics.memory.utilizationPercent > 80 ? "text-red-500" : ""}
                        >
                          {metrics.memory.utilizationPercent}%
                        </span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card data-testid="card-uptime-details">
                <CardHeader>
                  <CardTitle>System Info</CardTitle>
                  <CardDescription>Runtime and environment details</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Uptime</span>
                        <span>{formatUptime(metrics.uptime)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Node.js Version</span>
                        <span>{metrics.nodeVersion}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Last Updated</span>
                        <span>{new Date(metrics.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="telemetry" className="space-y-4">
            {telemetryStats && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card data-testid="card-telemetry-queued">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Queued</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatNumber(telemetryStats.batchWriter.totalQueued)}
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-telemetry-written">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Flushed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatNumber(telemetryStats.batchWriter.totalFlushed)}
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-telemetry-success-rate">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {telemetryStats.health.writeSuccessRate}%
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-telemetry-buffer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Buffer Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">
                        {telemetryStats.health.bufferUtilization}%
                      </div>
                      <Progress value={telemetryStats.health.bufferUtilization} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            {telemetryStats?.batchWriter.totalEvicted > 0 && (
              <Alert variant="destructive" data-testid="alert-evictions">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Buffer Evictions Detected</AlertTitle>
                <AlertDescription>
                  {formatNumber(telemetryStats.batchWriter.totalEvicted)} readings were evicted (
                  {telemetryStats.health.evictionRate}% eviction rate). Consider increasing buffer
                  size or reducing ingestion rate.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="tests" className="space-y-4">
            {metrics?.memory.utilizationPercent > 70 && (
              <Alert data-testid="alert-memory-warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>High Memory Usage</AlertTitle>
                <AlertDescription>
                  Memory usage is at {metrics.memory.utilizationPercent}%. Running tests may fail
                  due to insufficient memory. For reliable test execution, use the CI/CD pipeline or
                  run tests locally with:{" "}
                  <code className="text-xs bg-muted px-1 rounded">npm test</code>
                </AlertDescription>
              </Alert>
            )}
            <Card data-testid="card-smoke-tests">
              <CardHeader>
                <CardTitle>Smoke Tests (Quick Checks)</CardTitle>
                <CardDescription>
                  Lightweight API tests that run instantly. Click "Run" to execute.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {testSuites?.suites && (
                  <div className="space-y-3">
                    {testSuites.suites
                      .filter((s) => s.runnable)
                      .map((suite, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg border"
                          data-testid={`test-suite-${suite.name}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <TestIcon status={suite.lastRun?.status} />
                              <h4 className="font-medium text-sm">{suite.name}</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getTestStatusBadgeVariant(suite.lastRun?.status)}>
                                {suite.lastRun?.status || "Not run"}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => runTestMutation.mutate(suite.name)}
                                disabled={
                                  suite.lastRun?.status === "running" || runTestMutation.isPending
                                }
                                data-testid={`button-run-test-${suite.name}`}
                              >
                                {suite.lastRun?.status === "running" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{suite.description}</p>
                          {suite.lastRun?.output && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() =>
                                setSelectedOutput({
                                  name: suite.name,
                                  output: suite.lastRun?.output || "",
                                })
                              }
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Output
                            </Button>
                          )}
                          {suite.lastRun?.completedAt && (
                            <p className="text-xs text-muted-foreground">
                              Last run: {formatDate(suite.lastRun.completedAt)}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card data-testid="card-full-tests">
              <CardHeader>
                <CardTitle>Full Test Suites (CI/CD)</CardTitle>
                <CardDescription>
                  Comprehensive tests that run via GitHub Actions. Too memory-intensive for in-app
                  execution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {testSuites?.suites && (
                  <div className="space-y-3">
                    {testSuites.suites
                      .filter((s) => !s.runnable)
                      .map((suite, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg border bg-muted/30"
                          data-testid={`test-suite-${suite.name}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <TestTube className="h-4 w-4 text-muted-foreground" />
                              <h4 className="font-medium text-sm">{suite.name}</h4>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {suite.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{suite.description}</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{suite.file}</code>
                        </div>
                      ))}
                  </div>
                )}
                <div className="mt-4 p-3 rounded-lg border bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Run locally:{" "}
                    <code className="bg-background px-1 rounded">
                      npx jest server/tests/[name].test.ts --forceExit
                    </code>
                  </p>
                </div>
              </CardContent>
            </Card>
            <Dialog open={!!selectedOutput} onOpenChange={() => setSelectedOutput(null)}>
              <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Test Output: {selectedOutput?.name}</DialogTitle>
                  <DialogDescription>Full test execution output</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] rounded-md border p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {selectedOutput?.output || "No output available"}
                  </pre>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            {config && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-telemetry-config">
                  <CardHeader>
                    <CardTitle>Telemetry Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Batch Interval</span>
                        <span>{config.telemetry?.batchIntervalMs}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Buffer Size</span>
                        <span>{formatNumber(config.telemetry?.bufferSize || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Eviction Percent</span>
                        <span>{config.telemetry?.evictionPercent * 100}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Retries</span>
                        <span>{config.telemetry?.maxRetries}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-environment-config">
                  <CardHeader>
                    <CardTitle>Environment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Node Environment</span>
                        <Badge variant="outline">{config.environment?.nodeEnv}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Deployment Mode</span>
                        <Badge variant="outline">{config.environment?.deploymentMode}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-features-config">
                  <CardHeader>
                    <CardTitle>Feature Flags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span>Dual Database</span>
                        {config.features?.dualDatabase ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>ML Predictions</span>
                        {config.features?.mlPredictions ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>FMCC Integration</span>
                        {config.features?.fmccIntegration ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
