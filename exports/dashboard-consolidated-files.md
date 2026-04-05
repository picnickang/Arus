# ARUS Dashboard — Consolidated Files (Task #43)

Four files comprise the consolidated Operations Dashboard. Active Telemetry and Actionable Insights pages were merged into the Dashboard as tabs.

---

## File 1: `client/src/pages/dashboard-improved.tsx`

```tsx
import { RefreshCw, Cpu, Heart, Wrench, AlertTriangle, Eye, Plus, Ship, Activity, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UnifiedMetricCard, MetricCardGrid } from "@/components/shared";
import { StatusIndicator } from "@/components/status-indicator";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { formatDistanceToNow } from "date-fns";
import { InsightsOverview } from "@/components/InsightsOverview";
import { OperatingConditionAlertsPanel } from "@/components/OperatingConditionAlertsPanel";
import { HealthLegend, HealthIndexTooltip } from "@/components/HealthLegend";
import { FleetRisksCard } from "@/components/dashboard/FleetRisksCard";
import { STCWComplianceWidget } from "@/components/crew/STCWComplianceWidget";
import { useDashboardData } from "@/features/analytics";
import { TelemetryTab } from "@/components/dashboard/TelemetryTab";
import { InsightsTab } from "@/components/dashboard/InsightsTab";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <header className="bg-card border-b border-border px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </header>
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function CriticalIssuesCard({ criticalEquipmentCount, criticalWorkOrdersCount, criticalEquipment, criticalWorkOrders }: { criticalEquipmentCount: number; criticalWorkOrdersCount: number; criticalEquipment: any[]; criticalWorkOrders: any[] }) {
  return (
    <Card className="border-destructive bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />Critical Issues Requiring Attention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {criticalEquipmentCount > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Critical Equipment ({criticalEquipmentCount})</h3>
            <div className="space-y-2">
              {criticalEquipment.slice(0, 5).map((eq) => (
                <div key={eq.id} className="flex items-center justify-between p-2 bg-background rounded">
                  <span>{eq.name || eq.id}</span>
                  <span className="text-destructive font-semibold">Health: {eq.healthIndex}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {criticalWorkOrdersCount > 0 && (
          <div>
            <h3 className="font-semibold mb-2">High Priority Work Orders ({criticalWorkOrdersCount})</h3>
            <div className="space-y-2">
              {criticalWorkOrders.slice(0, 5).map((wo) => (
                <div key={wo.id} className="flex items-center justify-between p-2 bg-background rounded">
                  <span>{wo.title}</span>
                  <span className="text-destructive font-semibold">{wo.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getPriorityClassName(priority: string | number): string {
  if (priority === "high" || priority === "2" || priority === 2) {
    return "bg-destructive/20 text-destructive";
  }
  if (priority === "medium" || priority === "1" || priority === 1) {
    return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
  }
  return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
}

function getReadingStatusClassName(status: string | undefined): string {
  if (status === "normal") {return "bg-chart-3/20 text-chart-3";}
  if (status === "warning") {return "bg-chart-2/20 text-chart-2";}
  if (status === "critical") {return "bg-destructive/20 text-destructive";}
  return "bg-muted text-muted-foreground";
}

function getHealthClassName(healthIndex: number): string {
  if (healthIndex >= 75) {return "text-chart-3";}
  if (healthIndex >= 50) {return "text-chart-2";}
  return "text-destructive";
}

export default function DashboardImproved() {
  const { alertBanner, metrics, metricsLoading, devices, devicesLoading, equipmentHealth, equipmentHealthArray, healthLoading, workOrders, ordersLoading, allVessels, latestReadings, latestReadingsLoading, dtcStats, currentTime, preferences, criticalEquipmentCount, criticalWorkOrdersCount, totalCriticalIssues, criticalEquipment, criticalWorkOrders, selectedVessel, setSelectedVessel, isConnected, isFocusMode, toggleFocusMode, deviceStatusExpanded, setDeviceStatusExpanded, telemetryExpanded, setTelemetryExpanded, predictiveMaintenanceExpanded, setPredictiveMaintenanceExpanded, workOrdersExpanded, setWorkOrdersExpanded, getVesselName, getEquipmentName, getPriorityText, shouldShowSection, refreshData, dismissAlert, operatingAlerts, insightsSnapshot, insightsJobStats, stcwSummary, stcwTrends, equipmentRegistry } = useDashboardData();

  if (metricsLoading) {
    return <DashboardSkeleton />;
  }

  const overviewContent = (
    <>
      {shouldShowSection("normal") && <InsightsOverview orgId="default-org-id" scope="fleet" prefetchedSnapshot={insightsSnapshot} prefetchedJobStats={insightsJobStats} />}
      {shouldShowSection("normal") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FleetRisksCard limit={5} showVessel={true} prefetchedHealthData={equipmentHealthArray} data-testid="fleet-risks-dashboard" />
          <STCWComplianceWidget lookbackDays={30} prefetchedSummary={stcwSummary} prefetchedTrends={stcwTrends} />
        </div>
      )}
      {shouldShowSection("critical") && totalCriticalIssues > 0 && (
        <CriticalIssuesCard
          criticalEquipmentCount={criticalEquipmentCount}
          criticalWorkOrdersCount={criticalWorkOrdersCount}
          criticalEquipment={criticalEquipment}
          criticalWorkOrders={criticalWorkOrders}
        />
      )}
      {shouldShowSection("normal") && <OperatingConditionAlertsPanel prefetchedAlerts={operatingAlerts} prefetchedEquipment={equipmentRegistry} />}
    </>
  );

  const devicesContent = (
    <>
      {shouldShowSection("normal") && (
        <CollapsibleSection title="Device Status" description="Real-time edge device monitoring" icon={<Cpu className="h-5 w-5" />} expanded={deviceStatusExpanded} onExpandedChange={setDeviceStatusExpanded} summary={`${devices?.filter((d) => d.status === "online").length || 0} online, ${devices?.filter((d) => d.status === "offline").length || 0} offline`} data-testid="collapsible-device-status">
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Device ID</TableHead><TableHead>Vessel</TableHead><TableHead>Status</TableHead><TableHead>CPU</TableHead><TableHead>Memory</TableHead><TableHead>Last Heartbeat</TableHead></TableRow></TableHeader><TableBody>{devicesLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading devices...</TableCell></TableRow> : devices?.map((device) => <TableRow key={device.id} className="hover:bg-muted"><TableCell className="font-mono text-sm" data-testid={`device-id-${device.id}`}>{device.id}</TableCell><TableCell data-testid={`device-vessel-${device.id}`}>{device.vessel || "Unknown"}</TableCell><TableCell><StatusIndicator status={device.status} showLabel /></TableCell><TableCell data-testid={`device-cpu-${device.id}`}>{device.lastHeartbeat?.cpuPct ? `${device.lastHeartbeat.cpuPct}%` : "–"}</TableCell><TableCell data-testid={`device-memory-${device.id}`}>{device.lastHeartbeat?.memPct ? `${device.lastHeartbeat.memPct}%` : "–"}</TableCell><TableCell data-testid={`device-heartbeat-${device.id}`}>{device.lastHeartbeat?.ts ? formatDistanceToNow(new Date(device.lastHeartbeat.ts), { addSuffix: true }) : "Never"}</TableCell></TableRow>)}</TableBody></Table></div>
        </CollapsibleSection>
      )}
      {shouldShowSection("normal") && (
        <CollapsibleSection title="Latest Telemetry Readings" description={`Real-time sensor data ${selectedVessel !== "all" ? `from ${getVesselName(selectedVessel)}` : "from all vessels"}`} icon={<Activity className="h-5 w-5" />} expanded={telemetryExpanded} onExpandedChange={setTelemetryExpanded} summary={latestReadings ? `${latestReadings.length} readings available` : "No data"} data-testid="collapsible-telemetry">
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Equipment</TableHead><TableHead>Sensor Type</TableHead><TableHead>Value</TableHead><TableHead>Unit</TableHead><TableHead>Status</TableHead><TableHead>Timestamp</TableHead></TableRow></TableHeader><TableBody>{latestReadingsLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading latest readings...</TableCell></TableRow> : latestReadings?.length > 0 ? latestReadings.slice(0, 10).map((reading, index) => <TableRow key={`${reading.equipmentId}-${reading.sensorType}-${index}`} className="hover:bg-muted"><TableCell className="font-medium">{getEquipmentName(reading.equipmentId)}</TableCell><TableCell>{reading.sensorType}</TableCell><TableCell className="font-medium">{reading.value?.toFixed(2) || "–"}</TableCell><TableCell>{reading.unit || "–"}</TableCell><TableCell><span className={`px-2 py-1 text-xs rounded-full ${getReadingStatusClassName(reading.status)}`}>{reading.status?.toUpperCase() || "UNKNOWN"}</span></TableCell><TableCell>{reading.ts ? formatDistanceToNow(new Date(reading.ts), { addSuffix: true }) : "Never"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No telemetry readings available</TableCell></TableRow>}</TableBody></Table></div>
        </CollapsibleSection>
      )}
    </>
  );

  const maintenanceContent = (
    <>
      <CollapsibleSection title="Predictive Maintenance" description="Equipment health and failure predictions" icon={<Heart className="h-5 w-5" />} expanded={predictiveMaintenanceExpanded} onExpandedChange={setPredictiveMaintenanceExpanded} summary={`${criticalEquipmentCount} critical, ${equipmentHealthArray.filter((eq) => eq.healthIndex >= 30 && eq.healthIndex < 70).length} warning`} data-testid="collapsible-predictive-maintenance">
        <div className="space-y-3"><HealthLegend /><div className="space-y-0">{healthLoading ? <div className="text-center text-muted-foreground py-4">Loading equipment health...</div> : (isFocusMode ? criticalEquipment : equipmentHealth)?.map((equipment, _index) => <div key={equipment.id} className={`flex flex-wrap items-center gap-3 py-2.5 px-1 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors ${equipment.healthIndex < 50 ? "bg-destructive/5" : ""}`} data-testid={`equipment-${equipment.id}`}><StatusIndicator status={equipment.status} /><div className="flex-1 min-w-0"><span className="font-medium text-foreground truncate">{equipment.name || equipment.id}</span><span className="text-xs text-muted-foreground ml-2 truncate">• {equipment.vessel}</span></div><div className="flex items-center gap-3 sm:gap-4 text-sm flex-shrink-0"><HealthIndexTooltip><div className="text-right cursor-help"><span className={`font-medium ${getHealthClassName(equipment.healthIndex)}`}>{equipment.healthIndex}%</span></div></HealthIndexTooltip><div className="text-right min-w-[50px]"><span className="text-xs text-muted-foreground">{equipment.predictedDueDays}d</span></div></div></div>)}</div></div>
      </CollapsibleSection>
      <CollapsibleSection title="Work Orders" description="Latest maintenance requests and updates" icon={<Wrench className="h-5 w-5" />} expanded={workOrdersExpanded} onExpandedChange={setWorkOrdersExpanded} summary={`${workOrders?.filter((wo) => wo.status !== "completed").length || 0} open, ${criticalWorkOrdersCount} high priority`} headerAction={<Button variant="secondary" size="sm" data-testid="button-new-work-order"><Plus className="mr-2 h-4 w-4" />New Order</Button>} data-testid="collapsible-work-orders">
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>Equipment</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{ordersLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading work orders...</TableCell></TableRow> : (isFocusMode ? criticalWorkOrders : workOrders?.slice(0, 10))?.map((order) => <TableRow key={order.id} className="hover:bg-muted"><TableCell className="font-mono text-sm" data-testid={`work-order-id-${order.id}`}>{order.workOrderNumber || order.id}</TableCell><TableCell data-testid={`work-order-equipment-${order.id}`}>{getEquipmentName(order.equipmentId)}</TableCell><TableCell><span className={`px-2 py-1 text-xs rounded-full ${getPriorityClassName(order.priority)}`}>{getPriorityText(order.priority)}</span></TableCell><TableCell data-testid={`work-order-status-${order.id}`}>{order.status}</TableCell><TableCell data-testid={`work-order-created-${order.id}`}>{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</TableCell><TableCell><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
      </CollapsibleSection>
    </>
  );

  return (
    <div className="min-h-screen">
      {alertBanner && (
        <div className={`mx-4 lg:mx-6 mt-4 p-3 lg:p-4 rounded-lg border-l-4 ${alertBanner.alertType === "critical" ? "bg-destructive/10 border-destructive text-destructive-foreground" : "bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-300"}`} data-testid="alert-banner">
          <div className="flex items-start justify-between space-x-3"><div className="flex items-start space-x-3 flex-1 min-w-0"><AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold text-sm lg:text-base break-words">{alertBanner.alertType?.toUpperCase()} ALERT - {getEquipmentName(alertBanner.equipmentId)}</p><p className="text-sm opacity-90 break-words">{alertBanner.message}</p><p className="text-xs opacity-75 mt-1">{formatDistanceToNow(new Date(alertBanner.createdAt), { addSuffix: true })}</p></div></div><Button variant="ghost" size="sm" onClick={dismissAlert} data-testid="button-dismiss-alert"><AlertTriangle className="h-4 w-4" /></Button></div>
        </div>
      )}

      <div className="px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2"><Ship className="h-4 w-4 text-muted-foreground" /><Select value={selectedVessel} onValueChange={setSelectedVessel}><SelectTrigger className="w-32 lg:w-40" data-testid="select-vessel-filter"><SelectValue placeholder="All Vessels" /></SelectTrigger><SelectContent><SelectItem value="all">All Vessels</SelectItem>{allVessels?.map((vessel) => <SelectItem key={vessel.id} value={vessel.id} data-testid={`vessel-option-${vessel.id}`}>{vessel.name}</SelectItem>)}</SelectContent></Select></div>
            <Button onClick={toggleFocusMode} variant={isFocusMode ? "default" : "outline"} size="sm" data-testid="button-focus-mode"><Target className="mr-2 h-4 w-4" />{isFocusMode ? "Exit Focus" : "Focus Mode"}</Button>
            <Button onClick={refreshData} size="sm" data-testid="button-refresh"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground"><div className="flex items-center space-x-2"><div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} /><span data-testid="text-ws-status">{isConnected ? "Live" : "Offline"}</span></div><span data-testid="text-current-time">{currentTime}</span></div>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <MetricCardGrid columns={5} className="mobile-scroll-container lg:overflow-visible">
          <UnifiedMetricCard label="Active Devices" value={metrics?.activeDevices || 0} icon={Cpu} color="blue" variant={preferences.metricsVariant === "minimal" ? "minimal" : "default"} trend={metrics?.trends?.activeDevices ? { value: metrics.trends.activeDevices.value, label: `${metrics.trends.activeDevices.direction === "up" ? "more" : "fewer"} than last week`, direction: metrics.trends.activeDevices.direction, isPositive: metrics.trends.activeDevices.direction === "up" } : undefined} data-testid="metric-active-devices" />
          <UnifiedMetricCard label="Fleet Health" value={`${metrics?.fleetHealth || 0}%`} icon={Heart} color="green" variant={preferences.metricsVariant === "minimal" ? "minimal" : "default"} progress={metrics?.fleetHealth || 0} status={(metrics?.fleetHealth || 0) >= 80 ? "healthy" : (metrics?.fleetHealth || 0) >= 60 ? "warning" : "critical"} trend={metrics?.trends?.fleetHealth ? { value: `${metrics.trends.fleetHealth.percentChange}%`, label: "from last week", direction: metrics.trends.fleetHealth.direction, isPositive: metrics.trends.fleetHealth.direction === "up" } : undefined} data-testid="metric-fleet-health" />
          <UnifiedMetricCard label="Open Work Orders" value={metrics?.openWorkOrders || 0} icon={Wrench} color="orange" variant={preferences.metricsVariant === "minimal" ? "minimal" : "default"} trend={metrics?.trends?.openWorkOrders ? { value: metrics.trends.openWorkOrders.value, label: `${metrics.trends.openWorkOrders.direction === "up" ? "more" : "fewer"} than last week`, direction: metrics.trends.openWorkOrders.direction, isPositive: metrics.trends.openWorkOrders.direction !== "up" } : undefined} data-testid="metric-open-work-orders" />
          <UnifiedMetricCard label="Risk Alerts" value={metrics?.riskAlerts || 0} icon={AlertTriangle} color="red" variant={preferences.metricsVariant === "minimal" ? "minimal" : "default"} status={metrics?.riskAlerts && metrics.riskAlerts > 0 ? "warning" : "healthy"} trend={metrics?.trends?.riskAlerts ? { value: metrics.trends.riskAlerts.value, label: `${metrics.trends.riskAlerts.direction === "up" ? "more" : "fewer"} than last week`, direction: metrics.trends.riskAlerts.direction, isPositive: metrics.trends.riskAlerts.direction !== "up" } : undefined} data-testid="metric-risk-alerts" />
          <UnifiedMetricCard label="Diagnostic Codes" value={dtcStats?.totalActiveDtcs || 0} icon={Activity} color="purple" variant={preferences.metricsVariant === "minimal" ? "minimal" : "default"} status={dtcStats?.criticalDtcs && dtcStats.criticalDtcs > 0 ? "critical" : "healthy"} trend={dtcStats?.criticalDtcs === undefined ? undefined : { value: dtcStats.criticalDtcs, label: "critical DTCs", direction: dtcStats.criticalDtcs > 0 ? "up" : "neutral", isPositive: dtcStats.criticalDtcs === 0 }} data-testid="metric-diagnostic-codes" />
        </MetricCardGrid>
        <DashboardTabs overviewContent={overviewContent} devicesContent={devicesContent} maintenanceContent={maintenanceContent} telemetryContent={<TelemetryTab />} insightsContent={<InsightsTab />} />
      </div>
    </div>
  );
}
```

---

## File 2: `client/src/components/dashboard-tabs.tsx`

```tsx
import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Cpu, Wrench, Activity, Lightbulb } from "lucide-react";

const VALID_TABS = ["overview", "devices", "maintenance", "telemetry", "insights"] as const;
type TabValue = typeof VALID_TABS[number];

function getTabFromSearch(search: string): TabValue {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab && VALID_TABS.includes(tab as TabValue)) {
    return tab as TabValue;
  }
  return "overview";
}

interface DashboardTabsProps {
  overviewContent: React.ReactNode;
  devicesContent: React.ReactNode;
  maintenanceContent: React.ReactNode;
  telemetryContent?: React.ReactNode;
  insightsContent?: React.ReactNode;
}

export function DashboardTabs({
  overviewContent,
  devicesContent,
  maintenanceContent,
  telemetryContent,
  insightsContent,
}: DashboardTabsProps) {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabValue>(() =>
    getTabFromSearch(searchString || window.location.search)
  );

  useEffect(() => {
    const tab = getTabFromSearch(searchString || "");
    setActiveTab(tab);
  }, [searchString]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    const url = tab === "overview" ? "/dashboard" : `/dashboard?tab=${tab}`;
    setLocation(url, { replace: true });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex mb-6">
        <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Overview</span>
        </TabsTrigger>
        <TabsTrigger value="devices" className="gap-2" data-testid="tab-devices">
          <Cpu className="h-4 w-4" />
          <span className="hidden sm:inline">Devices</span>
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="gap-2" data-testid="tab-maintenance">
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Maintenance</span>
        </TabsTrigger>
        <TabsTrigger value="telemetry" className="gap-2" data-testid="tab-telemetry">
          <Activity className="h-4 w-4" />
          <span className="hidden sm:inline">Telemetry</span>
        </TabsTrigger>
        <TabsTrigger value="insights" className="gap-2" data-testid="tab-insights">
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Insights</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6 mt-0">
        {overviewContent}
      </TabsContent>

      <TabsContent value="devices" className="space-y-6 mt-0">
        {devicesContent}
      </TabsContent>

      <TabsContent value="maintenance" className="space-y-6 mt-0">
        {maintenanceContent}
      </TabsContent>

      <TabsContent value="telemetry" className="space-y-6 mt-0">
        {telemetryContent}
      </TabsContent>

      <TabsContent value="insights" className="space-y-6 mt-0">
        {insightsContent}
      </TabsContent>
    </Tabs>
  );
}
```

---

## File 3: `client/src/components/dashboard/TelemetryTab.tsx`

```tsx
import { useState, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTelemetryStreams, SensorSparklineChart } from "@/features/telemetry";
import { useWebSocket } from "@/hooks/useWebSocket";

const TIME_RANGES = [
  { value: "0.083", label: "5 min" },
  { value: "0.25", label: "15 min" },
  { value: "1", label: "1 hour" },
  { value: "6", label: "6 hours" },
  { value: "24", label: "24 hours" },
];

const REFRESH_INTERVALS = [
  { value: "5000", label: "5 sec" },
  { value: "10000", label: "10 sec" },
  { value: "30000", label: "30 sec" },
  { value: "60000", label: "1 min" },
];

export function TelemetryTab() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [highlightSensor, setHighlightSensor] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>("1");
  const [refreshInterval, setRefreshInterval] = useState<string>("5000");

  const { isConnected } = useWebSocket();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const equipmentParam = params.get("equipment");
    const sensorParam = params.get("sensor");
    if (equipmentParam) {
      setSelectedEquipment(equipmentParam);
    }
    if (sensorParam) {
      setHighlightSensor(sensorParam);
    }
  }, [searchString]);

  const { data: vessels = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
  });

  const { data: equipment = [] } = useQuery<Array<{ id: string; name: string; vesselId: string }>>({
    queryKey: ["/api/equipment"],
  });

  const filteredEquipment = selectedVessel === "all"
    ? equipment
    : equipment.filter((e) => e.vesselId === selectedVessel);

  const { streams, isLoading, refetch } = useTelemetryStreams({
    vesselId: selectedVessel === "all" ? undefined : selectedVessel,
    equipmentId: selectedEquipment === "all" ? undefined : selectedEquipment,
    hours: parseFloat(timeRange),
    refreshInterval: parseInt(refreshInterval, 10),
  });

  const handleAcknowledge = useCallback((sensorType: string) => {
    console.log("Acknowledge anomaly:", sensorType);
  }, []);

  const handleViewDetails = useCallback((equipmentId: string, sensorType: string) => {
    navigate(`/equipment/${equipmentId}?sensor=${sensorType}`);
  }, [navigate]);

  const anomalyCount = streams.filter((s) => s.hasAnomaly).length;

  const sortedStreams = [...streams].sort((a, b) => {
    if (highlightSensor && a.sensorType === highlightSensor) return -1;
    if (highlightSensor && b.sensorType === highlightSensor) return 1;
    if (a.hasAnomaly && !b.hasAnomaly) return -1;
    if (!a.hasAnomaly && b.hasAnomaly) return 1;
    return 0;
  });

  return (
    <div className="space-y-4" data-testid="telemetry-tab-content">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <CardTitle className="text-lg">Live Sensor Streams</CardTitle>
              <div className="flex items-center gap-1">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-500">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Polling</span>
                  </>
                )}
              </div>
            </div>
            {anomalyCount > 0 && (
              <Badge variant="destructive" data-testid="badge-anomaly-count">
                {anomalyCount} anomal{anomalyCount === 1 ? "y" : "ies"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[160px] space-y-1">
              <label className="text-xs font-medium">Vessel</label>
              <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                <SelectTrigger data-testid="select-telemetry-vessel">
                  <SelectValue placeholder="All vessels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vessels</SelectItem>
                  {vessels.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[160px] space-y-1">
              <label className="text-xs font-medium">Equipment</label>
              <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                <SelectTrigger data-testid="select-telemetry-equipment">
                  <SelectValue placeholder="All equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All equipment</SelectItem>
                  {filteredEquipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[100px] space-y-1">
              <label className="text-xs font-medium">Time Range</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[100px] space-y-1">
              <label className="text-xs font-medium">Refresh</label>
              <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                <SelectTrigger data-testid="select-refresh-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_INTERVALS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-telemetry">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : streams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No telemetry streams found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Select a vessel or equipment to view sensor data
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {streams.length} sensor{streams.length === 1 ? "" : "s"}
            {selectedVessel !== "all" && ` for selected vessel`}
            {selectedEquipment !== "all" && ` on selected equipment`}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedStreams.map((stream) => (
              <div
                key={`${stream.equipmentId}-${stream.sensorType}`}
                className={highlightSensor === stream.sensorType ? "ring-2 ring-primary rounded-lg" : ""}
              >
                <SensorSparklineChart
                  sensorType={stream.sensorType}
                  equipmentId={stream.equipmentId}
                  currentValue={stream.currentValue}
                  unit={stream.unit}
                  status={stream.status}
                  hasAnomaly={stream.hasAnomaly}
                  anomalyZScore={stream.anomalyZScore}
                  anomalyTimestamp={stream.anomalyTimestamp}
                  data={stream.data}
                  lastUpdate={stream.lastUpdate}
                  onAcknowledge={stream.hasAnomaly ? () => handleAcknowledge(stream.sensorType) : undefined}
                  onViewDetails={() => handleViewDetails(stream.equipmentId, stream.sensorType)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## File 4: `client/src/components/dashboard/InsightsTab.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Clock, AlertCircle, Info, Wrench, FileText, ArrowUpCircle } from "lucide-react";
import { useActionableInsightsData } from "@/features/insights";
import { formatDate } from "@/lib/formatters";

type Severity = "critical" | "high" | "medium" | "low";
type InsightType = "FAILURE_PREDICTED" | "MAINTENANCE_DUE" | "CONDITION_DETERIORATING" | "SENSOR_ANOMALY" | "OPTIMIZATION_OPPORTUNITY" | "COMPLIANCE_RISK";

const SeverityBadgeVariants: Record<Severity, "destructive" | "default" | "secondary" | "outline"> = { critical: "destructive", high: "default", medium: "secondary", low: "outline" };
const SeverityBadgeColors: Record<Severity, string> = { critical: "bg-red-500 dark:bg-red-600", high: "bg-orange-500 dark:bg-orange-600", medium: "bg-yellow-500 dark:bg-yellow-600", low: "bg-blue-500 dark:bg-blue-600" };
const TypeIcons: Record<InsightType, typeof AlertTriangle> = { FAILURE_PREDICTED: AlertTriangle, MAINTENANCE_DUE: Wrench, CONDITION_DETERIORATING: ArrowUpCircle, SENSOR_ANOMALY: AlertCircle, OPTIMIZATION_OPPORTUNITY: Info, COMPLIANCE_RISK: FileText };

const SeverityBadge = ({ severity }: { severity: string }) => (<Badge variant={SeverityBadgeVariants[severity as Severity] ?? "outline"} className={SeverityBadgeColors[severity as Severity] ?? ""}>{severity.toUpperCase()}</Badge>);
const TypeIcon = ({ type }: { type: string }) => { const Icon = TypeIcons[type as InsightType] || Info; return <Icon className="h-5 w-5" />; };

export function InsightsTab() {
  const { stats, insights, insightsLoading, selectedSeverity, setSelectedSeverity, showResolved, toggleShowResolved, selectedInsight, detailsOpen, setDetailsOpen, resolveDialogOpen, setResolveDialogOpen, resolutionNotes, setResolutionNotes, handleAcknowledge, handleResolve, handleSelectInsight, acknowledgeMutation, resolveMutation } = useActionableInsightsData();

  return (
    <div className="space-y-6" data-testid="insights-tab-content">
      {stats && (<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">{[{ label: "Total", value: stats.total, testId: "stat-total" }, { label: "Critical", value: stats.critical, color: "text-red-500 dark:text-red-400", testId: "stat-critical" }, { label: "High", value: stats.high, color: "text-orange-500 dark:text-orange-400", testId: "stat-high" }, { label: "Medium", value: stats.medium, color: "text-yellow-500 dark:text-yellow-400", testId: "stat-medium" }, { label: "Low", value: stats.low, color: "text-blue-500 dark:text-blue-400", testId: "stat-low" }, { label: "Unresolved", value: stats.unresolved, testId: "stat-unresolved" }, { label: "Resolved", value: stats.resolved, color: "text-green-500 dark:text-green-400", testId: "stat-resolved" }].map((s) => (<Card key={s.testId} className="bg-card dark:bg-gray-900" data-testid={s.testId}><CardHeader className="pb-2"><CardTitle className={`text-sm font-medium ${s.color || "text-muted-foreground dark:text-gray-400"}`}>{s.label}</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${s.color || "text-foreground dark:text-white"}`}>{s.value}</div></CardContent></Card>))}</div>)}

      <Card className="bg-card dark:bg-gray-900"><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-foreground dark:text-white">Insights</CardTitle><Button variant={showResolved ? "default" : "outline"} size="sm" onClick={toggleShowResolved} className="dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700" data-testid="button-toggle-resolved">{showResolved ? "Hide Resolved" : "Show Resolved"}</Button></div></CardHeader><CardContent>
        <Tabs value={selectedSeverity || "all"} onValueChange={(v) => setSelectedSeverity(v === "all" ? null : v)}><TabsList className="dark:bg-gray-800">{["all", "critical", "high", "medium", "low"].map((tab) => <TabsTrigger key={tab} value={tab} data-testid={`filter-${tab}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</TabsTrigger>)}</TabsList></Tabs>
        <div className="mt-4 space-y-3">
          {insightsLoading && <div className="text-center py-8 text-muted-foreground dark:text-gray-400" data-testid="loading-state">Loading insights...</div>}
          {!insightsLoading && insights.length === 0 && <div className="text-center py-8 text-muted-foreground dark:text-gray-400" data-testid="empty-state">No insights found</div>}
          {insights.map((insight) => (<Card key={insight.id} className="cursor-pointer hover:bg-accent dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors" onClick={() => handleSelectInsight(insight)} data-testid={`insight-card-${insight.id}`}><CardContent className="p-4"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3 flex-1"><div className="mt-1"><TypeIcon type={insight.type} /></div><div className="flex-1 space-y-1"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-foreground dark:text-white" data-testid={`insight-title-${insight.id}`}>{insight.title}</h3><SeverityBadge severity={insight.severity} />{insight.acknowledged && <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300"><CheckCircle2 className="h-3 w-3 mr-1" />Acknowledged</Badge>}{insight.resolved && <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Resolved</Badge>}</div><p className="text-sm text-muted-foreground dark:text-gray-400">{insight.message}</p>{insight.equipment && <p className="text-xs text-muted-foreground dark:text-gray-500">Equipment: {insight.equipment.name} ({insight.equipment.type})</p>}<p className="text-xs text-muted-foreground dark:text-gray-500"><Clock className="h-3 w-3 inline mr-1" />{formatDate(insight.createdAt)}</p></div></div></div></CardContent></Card>))}
        </div>
      </CardContent></Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}><DialogContent className="max-w-3xl bg-background dark:bg-gray-900 text-foreground dark:text-white"><DialogHeader><DialogTitle className="flex items-center gap-2">{selectedInsight && <TypeIcon type={selectedInsight.type} />}{selectedInsight?.title}</DialogTitle><DialogDescription className="dark:text-gray-400">{selectedInsight?.message}</DialogDescription></DialogHeader>{selectedInsight && <div className="space-y-4 max-h-[60vh] overflow-y-auto"><div><Label className="dark:text-gray-300">Severity</Label><div className="mt-1"><SeverityBadge severity={selectedInsight.severity} /></div></div>{selectedInsight.equipment && <div><Label className="dark:text-gray-300">Equipment</Label><p className="text-sm mt-1 dark:text-gray-400">{selectedInsight.equipment.name} ({selectedInsight.equipment.type})</p></div>}{selectedInsight.recommendedAction && <div><Label className="dark:text-gray-300">Recommended Action</Label><p className="text-sm mt-1 dark:text-gray-400">{selectedInsight.recommendedAction}</p></div>}{selectedInsight.supportingSignals && <div><Label className="dark:text-gray-300">Supporting Signals</Label><pre className="text-xs mt-1 bg-muted dark:bg-gray-800 p-3 rounded overflow-x-auto dark:text-gray-300">{JSON.stringify(selectedInsight.supportingSignals, null, 2)}</pre></div>}{selectedInsight.relatedProcedures && selectedInsight.relatedProcedures.length > 0 && <div><Label className="dark:text-gray-300">Related Procedures</Label><ul className="list-disc list-inside text-sm mt-1 space-y-1 dark:text-gray-400">{selectedInsight.relatedProcedures.map((proc: string) => <li key={proc}>{proc}</li>)}</ul></div>}{selectedInsight.resolutionNotes && <div><Label className="dark:text-gray-300">Resolution Notes</Label><p className="text-sm mt-1 dark:text-gray-400">{selectedInsight.resolutionNotes}</p></div>}</div>}<DialogFooter>{selectedInsight && !selectedInsight.acknowledged && <Button variant="outline" onClick={() => handleAcknowledge(selectedInsight.id)} disabled={acknowledgeMutation.isPending} className="dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700" data-testid="button-acknowledge">Acknowledge</Button>}{selectedInsight && !selectedInsight.resolved && <Button onClick={() => setResolveDialogOpen(true)} className="dark:bg-blue-600 dark:hover:bg-blue-700" data-testid="button-resolve">Mark as Resolved</Button>}</DialogFooter></DialogContent></Dialog>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}><DialogContent className="bg-background dark:bg-gray-900 text-foreground dark:text-white"><DialogHeader><DialogTitle>Resolve Insight</DialogTitle><DialogDescription className="dark:text-gray-400">Add notes about how this insight was resolved.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="resolution-notes" className="dark:text-gray-300">Resolution Notes</Label><Textarea id="resolution-notes" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Describe the actions taken to resolve this insight..." className="mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-700" rows={4} data-testid="input-resolution-notes" /></div></div><DialogFooter><Button variant="outline" onClick={() => setResolveDialogOpen(false)} className="dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700">Cancel</Button><Button onClick={handleResolve} disabled={resolveMutation.isPending} className="dark:bg-blue-600 dark:hover:bg-blue-700" data-testid="button-submit-resolve">{resolveMutation.isPending ? "Resolving..." : "Resolve"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
```
