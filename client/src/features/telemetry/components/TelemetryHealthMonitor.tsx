import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Database, Cpu, Clock, AlertTriangle, CheckCircle2, XCircle, Gauge } from "lucide-react";

interface TelemetryHealth {
  status: "healthy" | "degraded" | "unhealthy";
  bufferUtilization: number;
  messagesPerSecond: number;
  activeConnections: number;
  droppedMessages: number;
  avgLatencyMs: number;
  vesselStats: Array<{
    vesselId: string;
    vesselName: string;
    sensorsActive: number;
    lastHeartbeat: string;
    status: "online" | "offline" | "stale";
  }>;
}

export function TelemetryHealthMonitor() {
  const { data: health, isLoading, error } = useQuery<TelemetryHealth>({
    queryKey: ["/api/telemetry/health"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !health) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <XCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
          <p>Unable to fetch telemetry health status</p>
        </CardContent>
      </Card>
    );
  }

  const statusIcon = health.status === "healthy" 
    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
    : health.status === "degraded"
    ? <AlertTriangle className="h-5 w-5 text-amber-500" />
    : <XCircle className="h-5 w-5 text-destructive" />;

  const statusColor = health.status === "healthy" 
    ? "bg-green-500/10 text-green-500 border-green-500/30"
    : health.status === "degraded"
    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
    : "bg-destructive/10 text-destructive border-destructive/30";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Telemetry System Health
              </CardTitle>
              <CardDescription>Real-time monitoring of telemetry ingestion pipeline</CardDescription>
            </div>
            <Badge variant="outline" className={statusColor}>
              {statusIcon}
              <span className="ml-1 capitalize">{health.status}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              icon={<Gauge className="h-4 w-4" />}
              label="Throughput"
              value={`${health.messagesPerSecond.toFixed(1)} msg/s`}
              subtext="Messages per second"
            />
            <MetricCard
              icon={<Database className="h-4 w-4" />}
              label="Buffer Usage"
              value={`${health.bufferUtilization.toFixed(0)}%`}
              subtext="Memory buffer utilization"
              progress={health.bufferUtilization}
              progressColor={health.bufferUtilization > 80 ? "bg-amber-500" : "bg-primary"}
            />
            <MetricCard
              icon={<Clock className="h-4 w-4" />}
              label="Latency"
              value={`${health.avgLatencyMs.toFixed(0)} ms`}
              subtext="Average ingestion latency"
            />
            <MetricCard
              icon={<Cpu className="h-4 w-4" />}
              label="Connections"
              value={health.activeConnections.toString()}
              subtext="Active vessel connections"
            />
          </div>
          {health.droppedMessages > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              <span>{health.droppedMessages.toLocaleString()} messages dropped due to buffer overflow</span>
            </div>
          )}
        </CardContent>
      </Card>

      {health.vesselStats && health.vesselStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vessel Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {health.vesselStats.map((vessel) => (
                <div
                  key={vessel.vesselId}
                  className="flex items-center justify-between rounded-md border p-3"
                  data-testid={`vessel-status-${vessel.vesselId}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{vessel.vesselName}</p>
                    <p className="text-xs text-muted-foreground">
                      {vessel.sensorsActive} sensors active
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      vessel.status === "online"
                        ? "bg-green-500/10 text-green-500 border-green-500/30"
                        : vessel.status === "stale"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {vessel.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
  progress,
  progressColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  progress?: number;
  progressColor?: string;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
      {progress !== undefined && (
        <Progress value={progress} className={`h-1.5 mt-2 ${progressColor || ""}`} />
      )}
    </div>
  );
}
