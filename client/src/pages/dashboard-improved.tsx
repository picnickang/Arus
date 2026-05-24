import { RefreshCw, Heart, Wrench, AlertTriangle, Ship, ExternalLink, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useDashboardData } from "@/features/analytics";

function MetricCard({
  label,
  value,
  icon: Icon,
  status,
  href,
  testId,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  status?: "healthy" | "warning" | "critical";
  href?: string;
  testId: string;
}) {
  const statusColors = {
    healthy: "border-green-500/20 bg-green-500/5",
    warning: "border-yellow-500/20 bg-yellow-500/5",
    critical: "border-red-500/20 bg-red-500/5",
  };
  const textColors = {
    healthy: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    critical: "text-red-600 dark:text-red-400",
  };

  const content = (
    <Card className={`${status ? statusColors[status] : ""} transition-colors hover:bg-accent/50`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p
              className={`text-2xl font-bold mt-1 ${status ? textColors[status] : "text-foreground"}`}
              data-testid={testId}
            >
              {value}
            </p>
          </div>
          <Icon className={`h-5 w-5 ${status ? textColors[status] : "text-muted-foreground"}`} />
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="no-underline">
        {content}
      </Link>
    );
  }
  return content;
}

interface AttentionItem {
  id: string;
  type: "equipment" | "work-order" | "compliance" | "alert";
  severity: "critical" | "high" | "warning";
  title: string;
  subtitle: string;
  metric?: string;
  href: string;
}

interface DashboardEquipment {
  id: string;
  name?: string;
  vessel?: string;
  healthIndex: number;
  updatedAt?: string;
}

interface DashboardWorkOrder {
  id: string;
  title?: string;
  workOrderNumber?: string;
  description?: string;
  status?: string;
  priority?: number | string;
  createdAt?: string;
  updatedAt?: string;
}

interface DashboardOperatingAlert {
  id: string;
  message?: string;
  equipmentName?: string;
  equipmentId?: string;
  severity?: string;
  createdAt?: string;
}

interface DashboardStcwSummary {
  violationCount?: number;
  totalViolations?: number;
  criticalFatigueCount?: number;
  highFatigueCount?: number;
  [key: string]: unknown;
}

interface DashboardInsightsSnapshot {
  summary?: string;
  criticalCount?: number;
  [key: string]: unknown;
}

interface DashboardReading {
  id?: string;
  sensorType?: string;
  value?: number;
  timestamp?: string;
  [key: string]: unknown;
}

function NeedsAttentionStrip({
  criticalEquipment,
  criticalWorkOrders,
  operatingAlerts,
  stcwSummary,
}: {
  criticalEquipment: DashboardEquipment[];
  criticalWorkOrders: DashboardWorkOrder[];
  operatingAlerts: DashboardOperatingAlert[];
  stcwSummary: DashboardStcwSummary | undefined;
}) {
  const items: AttentionItem[] = [];

  for (const eq of (criticalEquipment || []).slice(0, 3)) {
    items.push({
      id: `eq-${eq.id}`,
      type: "equipment",
      severity: eq.healthIndex < 30 ? "critical" : "high",
      title: eq.name || eq.id,
      subtitle: `${eq.healthIndex}% health — ${eq.vessel || "Fleet"}`,
      metric: `${eq.healthIndex}%`,
      href: "/equipment-intelligence",
    });
  }

  for (const wo of (criticalWorkOrders || []).slice(0, 3)) {
    items.push({
      id: `wo-${wo.id}`,
      type: "work-order",
      severity: wo.status === "overdue" ? "critical" : "high",
      title: wo.title || wo.workOrderNumber || wo.id,
      subtitle: wo.status === "overdue" ? "OVERDUE" : `Priority: ${wo.priority}`,
      href: `/work-orders?id=${wo.id}`,
    });
  }

  for (const alert of (operatingAlerts || []).slice(0, 2)) {
    items.push({
      id: `alert-${alert.id}`,
      type: "alert",
      severity: alert.severity === "critical" ? "critical" : "warning",
      title: alert.message || "Operating condition alert",
      subtitle: alert.equipmentName || alert.equipmentId || "",
      href: "/equipment-intelligence",
    });
  }

  const stcwViolationCount = stcwSummary?.violationCount ?? 0;
  if (stcwViolationCount > 0) {
    items.push({
      id: "stcw",
      type: "compliance",
      severity: "warning",
      title: `${stcwViolationCount} STCW violation${stcwViolationCount > 1 ? "s" : ""}`,
      subtitle: "Crew rest hour compliance",
      href: "/hours-of-rest",
    });
  }

  const severityOrder = { critical: 0, high: 1, warning: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  if (items.length === 0) {
    return (
      <div
        className="p-6 text-center text-muted-foreground border rounded-lg bg-green-500/5 border-green-500/20"
        data-testid="all-clear"
      >
        <p className="font-medium text-green-600 dark:text-green-400">All Systems Nominal</p>
        <p className="text-xs mt-1">No critical issues requiring immediate attention.</p>
      </div>
    );
  }

  const severityColors = {
    critical: {
      border: "border-red-500/30",
      bg: "bg-red-500/5",
      text: "text-red-600 dark:text-red-400",
    },
    high: {
      border: "border-orange-500/30",
      bg: "bg-orange-500/5",
      text: "text-orange-600 dark:text-orange-400",
    },
    warning: {
      border: "border-yellow-500/20",
      bg: "bg-yellow-500/5",
      text: "text-yellow-600 dark:text-yellow-400",
    },
  };

  const typeIcons = {
    equipment: Heart,
    "work-order": Wrench,
    compliance: AlertTriangle,
    alert: AlertTriangle,
  };

  return (
    <div data-testid="needs-attention-strip">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-semibold">
          Needs Attention
          <Badge variant="destructive" className="ml-2 text-[10px]">
            {items.length}
          </Badge>
        </h2>
        <div className="flex-1" />
        <Link
          href="/equipment-intelligence"
          className="text-xs text-primary hover:underline"
          data-testid="link-view-all-issues"
        >
          View all →
        </Link>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2">
          {items.slice(0, 7).map((item) => {
            const colors = severityColors[item.severity];
            const Icon = typeIcons[item.type];
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`min-w-[220px] max-w-[260px] p-3.5 rounded-lg border ${colors.border} ${colors.bg} hover:ring-1 hover:ring-primary/30 transition-all shrink-0 no-underline`}
                data-testid={`attention-item-${item.id}`}
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`h-4 w-4 mt-0.5 ${colors.text} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <Badge
                      variant={
                        item.severity === "critical"
                          ? "destructive"
                          : item.severity === "high"
                            ? "default"
                            : "secondary"
                      }
                      className="text-[9px] px-1 py-0 mb-1"
                    >
                      {item.severity}
                    </Badge>
                    <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                    {item.metric && (
                      <div className={`text-lg font-bold mt-1 ${colors.text}`}>{item.metric}</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function AISummary({
  insightsSnapshot,
  criticalEquipmentCount,
  openWorkOrderCount,
  fleetHealth,
}: {
  insightsSnapshot: DashboardInsightsSnapshot | undefined;
  criticalEquipmentCount: number;
  openWorkOrderCount: number;
  fleetHealth: number;
}) {
  const parts: string[] = [];

  if (fleetHealth >= 80) {
    parts.push("Fleet health is stable.");
  } else if (fleetHealth >= 60) {
    parts.push("Fleet health is below target — some equipment needs attention.");
  } else {
    parts.push("Fleet health is degraded — multiple equipment items require immediate action.");
  }

  if (criticalEquipmentCount > 0) {
    parts.push(
      `${criticalEquipmentCount} equipment item${criticalEquipmentCount > 1 ? "s" : ""} ${criticalEquipmentCount > 1 ? "are" : "is"} in critical condition.`
    );
  }

  if (openWorkOrderCount > 0) {
    parts.push(`${openWorkOrderCount} work order${openWorkOrderCount > 1 ? "s" : ""} open.`);
  }

  const insightsCriticalCount = insightsSnapshot?.criticalCount ?? 0;
  if (insightsSnapshot?.summary) {
    parts.push(insightsSnapshot.summary);
  } else if (insightsCriticalCount > 0) {
    parts.push(
      `${insightsCriticalCount} critical insight${insightsCriticalCount > 1 ? "s" : ""} flagged by AI analysis.`
    );
  }

  if (parts.length <= 2) {
    parts.push("No anomalies detected in the last 24 hours.");
  }

  return (
    <div data-testid="ai-summary">
      <h2 className="text-sm font-semibold mb-2">AI Summary</h2>
      <Card className="bg-gradient-to-br from-sky-500/5 to-transparent border-sky-500/15">
        <CardContent className="p-4">
          <p className="text-sm text-foreground leading-relaxed" data-testid="ai-summary-text">
            {parts.join(" ")}
          </p>
          <Link
            href="/equipment-intelligence"
            className="text-xs text-sky-600 dark:text-sky-400 hover:underline mt-2 inline-flex items-center gap-1"
            data-testid="link-ai-details"
          >
            View Equipment Intelligence <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

interface ActivityItem {
  id: string;
  time: string;
  message: string;
  type: "telemetry" | "work-order" | "prediction" | "system";
  severity?: "critical" | "warning" | "info";
}

function ActivityFeed({
  workOrders,
  equipmentHealth,
  latestReadings,
  operatingAlerts,
}: {
  workOrders: DashboardWorkOrder[];
  equipmentHealth: DashboardEquipment[];
  latestReadings: DashboardReading[];
  operatingAlerts: DashboardOperatingAlert[];
}) {
  const items: ActivityItem[] = [];

  for (const wo of (workOrders || []).slice(0, 5)) {
    if (wo.createdAt) {
      items.push({
        id: `wo-${wo.id}`,
        time: wo.updatedAt || wo.createdAt,
        message: `${wo.status === "completed" ? "Completed" : wo.status === "in_progress" ? "Started" : "Created"}: ${wo.title || wo.description || wo.workOrderNumber || wo.id}`,
        type: "work-order",
        severity: wo.priority === 2 || wo.priority === "high" ? "warning" : "info",
      });
    }
  }

  for (const alert of (operatingAlerts || []).slice(0, 3)) {
    if (alert.createdAt) {
      items.push({
        id: `alert-${alert.id}`,
        time: alert.createdAt,
        message: `Alert: ${alert.message || "Operating condition threshold exceeded"} — ${alert.equipmentName || alert.equipmentId || ""}`,
        type: "telemetry",
        severity: alert.severity === "critical" ? "critical" : "warning",
      });
    }
  }

  for (const eq of (equipmentHealth || []).filter((e) => e.healthIndex < 40).slice(0, 3)) {
    items.push({
      id: `eq-${eq.id}`,
      time: eq.updatedAt || new Date().toISOString(),
      message: `Equipment health: ${eq.name || eq.id} at ${eq.healthIndex}% — ${eq.vessel || ""}`,
      type: "prediction",
      severity: eq.healthIndex < 30 ? "critical" : "warning",
    });
  }

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const typeColors = {
    telemetry: "bg-blue-500",
    "work-order": "bg-amber-500",
    prediction: "bg-purple-500",
    system: "bg-slate-500",
  };

  const severityTextColors = {
    critical: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-muted-foreground",
  };

  return (
    <div data-testid="activity-feed">
      <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
      {items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs">
          No recent activity. Events will appear here as they occur.
        </div>
      ) : (
        <div className="space-y-0">
          {items.slice(0, 12).map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0"
              data-testid={`activity-${item.id}`}
            >
              <div className="flex flex-col items-center mt-1.5">
                <div className={`w-2 h-2 rounded-full ${typeColors[item.type]} shrink-0`} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${item.severity ? severityTextColors[item.severity] : "text-foreground"}`}
                >
                  {item.message}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {(() => {
                  try {
                    return formatDistanceToNow(new Date(item.time), { addSuffix: true });
                  } catch {
                    return "Recently";
                  }
                })()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

export default function BridgeDashboard() {
  const {
    alertBanner,
    metrics,
    metricsLoading,
    summaryError,
    equipmentHealthArray,
    workOrders,
    latestReadings,
    allVessels,
    criticalEquipmentCount,
    criticalWorkOrdersCount,
    criticalEquipment,
    criticalWorkOrders,
    selectedVessel,
    setSelectedVessel,
    isConnected,
    refreshData,
    dismissAlert,
    operatingAlerts,
    insightsSnapshot,
    stcwSummary,
    getEquipmentName,
  } = useDashboardData();

  if (metricsLoading) {
    return <DashboardSkeleton />;
  }

  const fleetHealth = metrics?.fleetHealth || 0;
  const healthStatus = fleetHealth >= 80 ? "healthy" : fleetHealth >= 60 ? "warning" : "critical";
  const riskAlerts = metrics?.riskAlerts || 0;
  const openWOs = metrics?.openWorkOrders || 0;

  return (
    <div className="min-h-screen" data-testid="bridge-dashboard">
      {summaryError && (
        <div
          className="mx-4 lg:mx-6 mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
          data-testid="error-banner"
        >
          <div className="flex items-start gap-3">
            <WifiOff className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                {metrics ? "Dashboard data may be stale" : "Unable to load dashboard data"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {metrics
                  ? "The last refresh failed. Values shown may be outdated. Data will retry automatically."
                  : "The server may be temporarily unavailable."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              data-testid="button-retry-dashboard"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      )}
      {alertBanner && (
        <div
          className={`mx-4 lg:mx-6 mt-4 p-3 rounded-lg border-l-4 ${
            (alertBanner as { alertType?: string }).alertType === "critical"
              ? "bg-destructive/10 border-destructive text-destructive-foreground"
              : "bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-300"
          }`}
          data-testid="alert-banner"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  {(alertBanner as { alertType?: string }).alertType?.toUpperCase()} —{" "}
                  {getEquipmentName((alertBanner as object as { equipmentId: string }).equipmentId)}
                </p>
                <p className="text-sm opacity-90">{alertBanner.message}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissAlert}
              data-testid="button-dismiss-alert"
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 lg:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-36" data-testid="select-vessel-filter">
              <SelectValue placeholder="All Vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {allVessels?.map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refreshData} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span data-testid="text-ws-status">{isConnected ? "Live" : "Offline"}</span>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Fleet Health"
            value={`${fleetHealth}%`}
            icon={Heart}
            status={healthStatus}
            href="/equipment-intelligence"
            testId="metric-fleet-health"
          />
          <MetricCard
            label="Open Work Orders"
            value={openWOs}
            icon={Wrench}
            status={openWOs > 10 ? "warning" : undefined}
            href="/work-orders"
            testId="metric-open-work-orders"
          />
          <MetricCard
            label="Risk Alerts"
            value={riskAlerts}
            icon={AlertTriangle}
            status={riskAlerts > 0 ? "critical" : "healthy"}
            href="/equipment-intelligence"
            testId="metric-risk-alerts"
          />
        </div>

        <NeedsAttentionStrip
          criticalEquipment={criticalEquipment}
          criticalWorkOrders={criticalWorkOrders}
          operatingAlerts={operatingAlerts}
          stcwSummary={stcwSummary ?? undefined}
        />

        <AISummary
          insightsSnapshot={insightsSnapshot ?? undefined}
          criticalEquipmentCount={criticalEquipmentCount}
          openWorkOrderCount={openWOs}
          fleetHealth={fleetHealth}
        />

        <ActivityFeed
          workOrders={workOrders}
          equipmentHealth={equipmentHealthArray}
          latestReadings={latestReadings}
          operatingAlerts={operatingAlerts}
        />
      </div>
    </div>
  );
}
