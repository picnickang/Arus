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
