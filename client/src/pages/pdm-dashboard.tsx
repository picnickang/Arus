import { useState, useRef, useEffect } from "react";
import { Activity, AlertTriangle, Wifi, ChevronRight } from "lucide-react";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  usePdmDashboard,
  useCostSavingsSummary,
  useEquipmentFinancials,
  useTelemetryTrends,
  usePdmFilterOptions,
  ScheduleView,
} from "@/features/pdm";
import type { RiskQueueItem } from "@/features/pdm";
import { FleetHealthGauge, KpiCardCompact } from "./pdm-dashboard/_shared";
import { DashboardHeader } from "./pdm-dashboard/DashboardHeader";
import { RiskQueueDesktopTable } from "./pdm-dashboard/RiskQueueDesktopTable";
import { RiskQueueMobileCards } from "./pdm-dashboard/RiskQueueMobileCards";
import { TelemetryCoverageCard } from "./pdm-dashboard/TelemetryCoverageCard";
import { ModelHealthCard } from "./pdm-dashboard/ModelHealthCard";
import { MaintenancePipelineCard } from "./pdm-dashboard/MaintenancePipelineCard";
import { AssetDetailPanel } from "./pdm-dashboard/AssetDetailPanel";
import { SensorTrendChart } from "./pdm-dashboard/SensorTrendChart";
import { SensorTimeSeriesChart } from "./pdm-dashboard/SensorTimeSeriesChart";

type MainView = "risk-queue" | "schedule";

export default function PdmDashboard() {
  const [mainView, setMainView] = useState<MainView>("risk-queue");
  const [activeTab, setActiveTab] = useState<"active" | "new" | "resolved">("active");
  const [selectedItem, setSelectedItem] = useState<RiskQueueItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fleetFilter, setFleetFilter] = useState("all");
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30");

  // @ts-ignore -- bulk-silence
  void setLocation;

  const { data: filterOptions } = usePdmFilterOptions();

  const getDateRange = (days: string) => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - parseInt(days));
    return {
      dateFrom: from.toISOString().split("T")[0],
      dateTo: now.toISOString().split("T")[0],
    };
  };

  const dateFilters = getDateRange(dateRange);

  const filters = {
    vesselId: fleetFilter !== "all" ? fleetFilter : undefined,
    equipmentType: equipmentTypeFilter !== "all" ? equipmentTypeFilter : undefined,
    search: debouncedSearch || undefined,
    dateFrom: dateFilters.dateFrom,
    dateTo: dateFilters.dateTo,
  };

  const { data, isLoading, error } = usePdmDashboard(filters);
  const { data: costSummary, isLoading: costLoading } = useCostSavingsSummary(12);
  const { data: financials, isLoading: financialsLoading } = useEquipmentFinancials();
  const { data: telemetryTrends, isLoading: telemetryLoading } = useTelemetryTrends(undefined, 24);

  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  useEffect(() => {
    return () => clearTimeout(searchTimeoutRef.current);
  }, []);

  const buildExportParams = () => {
    const params = new URLSearchParams();
    params.set("format", "csv");
    if (filters.vesselId) {
      params.set("vesselId", filters.vesselId);
    }
    if (filters.equipmentType) {
      params.set("equipmentType", filters.equipmentType);
    }
    if (filters.search) {
      params.set("search", filters.search);
    }
    return params;
  };

  const handleExportCSV = () => {
    window.open(`/api/pdm/export/risk-queue?${buildExportParams().toString()}`, "_blank");
  };

  if (error) {
    return (
      <IntelligenceLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500">Failed to load PdM Dashboard</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please check your connection and try again
            </p>
          </div>
        </div>
      </IntelligenceLayout>
    );
  }

  return (
    <IntelligenceLayout>
      <div className="bg-[#080e1a]">
        <DashboardHeader
          mainView={mainView}
          onMainViewChange={setMainView}
          fleetFilter={fleetFilter}
          onFleetFilterChange={setFleetFilter}
          equipmentTypeFilter={equipmentTypeFilter}
          onEquipmentTypeFilterChange={setEquipmentTypeFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onExportCSV={handleExportCSV}
          filterOptions={filterOptions}
        />

        {mainView === "schedule" ? (
          <div className="p-4 lg:p-6">
            <ScheduleView />
          </div>
        ) : (
          <>
            <div className="p-4 lg:p-6 space-y-6">
              <ScrollArea className="w-full">
                <div className="flex gap-3 pb-2">
                  <div className="bg-slate-700 dark:bg-slate-800 text-white rounded-lg p-3 min-w-[180px] flex-shrink-0">
                    <p className="text-xs opacity-90">Fleet Health Score</p>
                    {isLoading ? (
                      <Skeleton className="h-16 w-full bg-slate-600" />
                    ) : (
                      <FleetHealthGauge
                        score={data?.kpis.fleetHealthScore || 0}
                        change={data?.kpis.fleetHealthChange || 0}
                        period={data?.kpis.fleetHealthPeriod || "last week"}
                      />
                    )}
                  </div>

                  <KpiCardCompact
                    title="Active Alerts"
                    value={isLoading ? "-" : data?.kpis.activeAlertsTotal || 0}
                    badge={
                      data?.kpis.criticalAlertsCount
                        ? {
                            text: `${data.kpis.criticalAlertsCount} Critical`,
                            variant: "destructive",
                          }
                        : undefined
                    }
                    variant="danger"
                    testId="kpi-active-alerts"
                  />

                  <KpiCardCompact
                    title="Assets at Risk"
                    value={isLoading ? "-" : data?.kpis.assetsAtRisk || 0}
                    subtitle={`${data?.kpis.assetsRulUnder14Days || 0} RUL < 14 Days`}
                    variant="warning"
                    testId="kpi-assets-at-risk"
                  />

                  <KpiCardCompact
                    title="Avoided Downtime"
                    value={isLoading ? "-" : `${data?.kpis.avoidedDowntimeHours || 0} hrs`}
                    subtitle={data?.kpis.avoidedDowntimePeriod}
                    variant="success"
                    testId="kpi-avoided-downtime"
                  />

                  <KpiCardCompact
                    title="Maintenance Forecast"
                    value={
                      isLoading
                        ? "-"
                        : `$${((data?.kpis.maintenanceForecastCost || 0) / 1000).toFixed(0)}k`
                    }
                    subtitle={data?.kpis.maintenanceForecastPeriod}
                    variant="info"
                    testId="kpi-forecast-cost"
                  />

                  <KpiCardCompact
                    title="Total Savings (12mo)"
                    value={
                      costLoading
                        ? "-"
                        : `$${((costSummary?.totalSavings || 0) / 1000).toFixed(0)}k`
                    }
                    subtitle={`${costSummary?.savingsCount || 0} preventive actions`}
                    variant="success"
                    testId="kpi-total-savings"
                  />

                  <KpiCardCompact
                    title="Asset ROI"
                    value={financialsLoading ? "-" : `${(financials?.assetROI || 0).toFixed(1)}%`}
                    subtitle="Fleet-wide return"
                    variant="default"
                    testId="kpi-asset-roi"
                  />
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-base flex items-center gap-2">
                          Risk Queue
                        </CardTitle>
                        <Button variant="outline" size="sm" className="hidden sm:flex">
                          <Wifi className="h-4 w-4 mr-1" />
                          Ingestion Health <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as "active" | "new" | "resolved")}
                      >
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                          <TabsTrigger value="active" data-testid="tab-active">
                            Risk Queue ({data?.riskQueue.active.length || 0})
                          </TabsTrigger>
                          <TabsTrigger value="new" data-testid="tab-new">
                            Active Alerts ({data?.riskQueue.new.length || 0})
                          </TabsTrigger>
                          <TabsTrigger value="resolved" data-testid="tab-resolved">
                            Resolved ({data?.riskQueue.resolved.length || 0})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="mt-0">
                          <div className="hidden md:block">
                            <RiskQueueDesktopTable
                              items={data?.riskQueue.active || []}
                              onSelectItem={setSelectedItem}
                              isLoading={isLoading}
                            />
                          </div>
                          <div className="md:hidden">
                            <RiskQueueMobileCards
                              items={data?.riskQueue.active || []}
                              onSelectItem={setSelectedItem}
                              isLoading={isLoading}
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="new" className="mt-0">
                          <div className="hidden md:block">
                            <RiskQueueDesktopTable
                              items={data?.riskQueue.new || []}
                              onSelectItem={setSelectedItem}
                              isLoading={isLoading}
                            />
                          </div>
                          <div className="md:hidden">
                            <RiskQueueMobileCards
                              items={data?.riskQueue.new || []}
                              onSelectItem={setSelectedItem}
                              isLoading={isLoading}
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="resolved" className="mt-0">
                          <div className="hidden md:block">
                            <RiskQueueDesktopTable
                              items={data?.riskQueue.resolved || []}
                              onSelectItem={setSelectedItem}
                              isLoading={isLoading}
                            />
                          </div>
                          <div className="md:hidden">
                            <RiskQueueMobileCards
                              items={data?.riskQueue.resolved || []}
                              onSelectItem={setSelectedItem}
                              isLoading={isLoading}
                            />
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <TelemetryCoverageCard coverage={data?.telemetryCoverage} isLoading={isLoading} />
                  <ModelHealthCard health={data?.modelHealth} isLoading={isLoading} />
                  <MaintenancePipelineCard
                    pipeline={data?.maintenancePipeline}
                    isLoading={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Sensor Overview (Min/Avg/Max)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SensorTrendChart trends={telemetryTrends} isLoading={telemetryLoading} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Vibration & Temperature Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SensorTimeSeriesChart trends={telemetryTrends} isLoading={telemetryLoading} />
                  </CardContent>
                </Card>
              </div>
            </div>

            <AssetDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
          </>
        )}
      </div>
    </IntelligenceLayout>
  );
}
