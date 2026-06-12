import { Activity, Clock, Cpu, Database, HardDrive, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TabsContent } from "@/components/ui/tabs";
import type { DiagnosticsDashboardModel } from "./DiagnosticsDashboardTypes";

export function DiagnosticsStatusIcon({
  model,
  status,
}: {
  model: DiagnosticsDashboardModel;
  status: string | undefined;
}) {
  const Icon = model.getStatusIcon(status);
  return Icon ? (
    <Icon
      className={`h-5 w-5 ${status === "pass" || status === "healthy" ? "text-green-500" : status === "warn" || status === "degraded" ? "text-yellow-500" : "text-red-500"}`}
    />
  ) : null;
}

export function DiagnosticsHealthTab({ model }: { model: DiagnosticsDashboardModel }) {
  const { health, healthLoading, metrics, getStatusBadgeVariant, formatUptime } = model;

  return (
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
                <DiagnosticsStatusIcon model={model} status={health.status} />
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
            <div className="text-2xl font-bold">{health ? formatUptime(health.uptime) : "--"}</div>
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
                  <p className="text-sm text-muted-foreground">{health.checks.database.message}</p>
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
                        health.checks.memory.details.utilizationPercent > 80 ? "bg-red-200" : ""
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
                  <Badge variant={getStatusBadgeVariant(service.status)}>{service.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
}
