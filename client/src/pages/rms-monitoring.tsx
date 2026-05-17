import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Fuel,
  Ship,
  Bell,
  Droplets,
  BarChart3,
  Gauge,
  Activity,
  Settings,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  AlertConfig,
  BunkeringEvent,
  DailyConsumption,
  FleetPosition,
  HourlyConsumption,
  RmsAlert,
  RmsSummary,
  RobEstimate,
  TankReading,
  TrackPoint,
  Vessel,
} from "./rms-monitoring/_shared";
import { OverviewTab } from "./rms-monitoring/OverviewTab";
import { AlertsTab } from "./rms-monitoring/AlertsTab";
import { BunkeringTab } from "./rms-monitoring/BunkeringTab";
import { ConsumptionTab } from "./rms-monitoring/ConsumptionTab";
import { ConfigsTab } from "./rms-monitoring/ConfigsTab";

export default function RmsMonitoringPage() {
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("24h");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const { toast } = useToast();

  const hoursMap: Record<string, number> = { "6h": 6, "12h": 12, "24h": 24, "48h": 48, "7d": 168 };
  const hours = useCustomRange
    ? Math.max(
        1,
        Math.round(
          (new Date(`${dateTo}T23:59:59`).getTime() - new Date(`${dateFrom}T00:00:00`).getTime()) /
            3600000
        )
      )
    : hoursMap[timeRange] || 24;

  const { data: vessels = [] } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });

  const { data: summary, isLoading: summaryLoading } = useQuery<RmsSummary>({
    queryKey: ["/api/rms/summary"],
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<RmsAlert[]>({
    queryKey: [
      "/api/rms/alerts",
      { vesselId: selectedVessel !== "all" ? selectedVessel : undefined, days: "7" },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ days: "7" });
      if (selectedVessel !== "all") {
        params.set("vesselId", selectedVessel);
      }
      const res = await fetch(`/api/rms/alerts?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch alerts");
      }
      return res.json();
    },
  });

  const { data: bunkerings = [], isLoading: bunkeringLoading } = useQuery<BunkeringEvent[]>({
    queryKey: [
      "/api/rms/bunkering",
      { vesselId: selectedVessel !== "all" ? selectedVessel : undefined },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ days: "30" });
      if (selectedVessel !== "all") {
        params.set("vesselId", selectedVessel);
      }
      const res = await fetch(`/api/rms/bunkering?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch bunkering events");
      }
      return res.json();
    },
  });

  const { data: alertConfigs = [], isLoading: configsLoading } = useQuery<AlertConfig[]>({
    queryKey: [
      "/api/rms/alerts/configs",
      { vesselId: selectedVessel !== "all" ? selectedVessel : undefined },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedVessel !== "all") {
        params.set("vesselId", selectedVessel);
      }
      const res = await fetch(`/api/rms/alerts/configs?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch alert configs");
      }
      return res.json();
    },
  });

  const { data: consumption = [], isLoading: consumptionLoading } = useQuery<HourlyConsumption[]>({
    queryKey: ["/api/rms/consumption/hourly", selectedVessel, hours],
    queryFn: async () => {
      if (selectedVessel === "all") {
        return [];
      }
      const res = await fetch(`/api/rms/consumption/hourly/${selectedVessel}?hours=${hours}`);
      if (!res.ok) {
        throw new Error("Failed to fetch consumption");
      }
      return res.json();
    },
    enabled: selectedVessel !== "all",
  });

  const { data: dailyConsumption = [] } = useQuery<DailyConsumption[]>({
    queryKey: ["/api/rms/consumption/daily", selectedVessel],
    queryFn: async () => {
      if (selectedVessel === "all") {
        return [];
      }
      const res = await fetch(`/api/rms/consumption/daily/${selectedVessel}?days=7`);
      if (!res.ok) {
        throw new Error("Failed to fetch daily consumption");
      }
      return res.json();
    },
    enabled: selectedVessel !== "all",
  });

  const { data: tanks = [] } = useQuery<TankReading[]>({
    queryKey: ["/api/rms/tanks", selectedVessel],
    queryFn: async () => {
      if (selectedVessel === "all") {
        return [];
      }
      const res = await fetch(`/api/rms/tanks/${selectedVessel}`);
      if (!res.ok) {
        throw new Error("Failed to fetch tanks");
      }
      return res.json();
    },
    enabled: selectedVessel !== "all",
  });

  const { data: rob } = useQuery<RobEstimate | null>({
    queryKey: ["/api/rms/rob", selectedVessel],
    queryFn: async () => {
      if (selectedVessel === "all") {
        return null;
      }
      const res = await fetch(`/api/rms/rob/${selectedVessel}`);
      if (!res.ok) {
        throw new Error("Failed to fetch ROB");
      }
      return res.json();
    },
    enabled: selectedVessel !== "all",
  });

  const { data: fleetPositions = [] } = useQuery<FleetPosition[]>({
    queryKey: ["/api/rms/fleet-positions"],
    refetchInterval: 30000,
  });

  const { data: vesselTrack = [] } = useQuery<TrackPoint[]>({
    queryKey: ["/api/rms/vessel-track", selectedVessel, hours],
    queryFn: async () => {
      if (selectedVessel === "all") {
        return [];
      }
      const res = await fetch(`/api/rms/vessel-track/${selectedVessel}?hours=${hours}`);
      if (!res.ok) {
        throw new Error("Failed to fetch vessel track");
      }
      return res.json();
    },
    enabled: selectedVessel !== "all",
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("PATCH", `/api/rms/alerts/${alertId}/acknowledge`, {
        acknowledgedBy: "shore-user",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rms/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rms/summary"] });
      toast({ title: "Alert acknowledged" });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      await apiRequest("DELETE", `/api/rms/alerts/configs/${configId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rms/alerts/configs"] });
      toast({ title: "Alert configuration deleted" });
    },
  });

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-rms-title">
            <Activity className="h-6 w-6 text-blue-600" />
            RMS Shore Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aquametro FMCC fuel monitoring, bunkering detection, and fleet alerts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-[200px]" data-testid="select-rms-vessel">
              <Ship className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {vessels
                .filter((v) => v.id)
                .map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {useCustomRange ? (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px] h-9 text-sm"
                data-testid="input-date-from"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px] h-9 text-sm"
                data-testid="input-date-to"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setUseCustomRange(false)}
                data-testid="btn-preset-range"
              >
                <Clock className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[130px]" data-testid="select-rms-timerange">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6h">6 Hours</SelectItem>
                  <SelectItem value="12h">12 Hours</SelectItem>
                  <SelectItem value="24h">24 Hours</SelectItem>
                  <SelectItem value="48h">48 Hours</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setUseCustomRange(true)}
                title="Custom date range"
                data-testid="btn-custom-range"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-unack-alerts">
                  {summary?.alerts?.unacknowledged ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary?.alerts?.critical ?? 0} critical, {summary?.alerts?.total24h ?? 0} in 24h
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bunkering Events</CardTitle>
            <Droplets className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-bunkering-count">
                  {summary?.bunkering?.last30Days ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary?.bunkering?.active ?? 0} in progress
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EFMS Connections</CardTitle>
            <Gauge className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-efms-count">
                  {summary?.efmsConnections?.polling ?? 0}/{summary?.efmsConnections?.total ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary?.efmsConnections?.error ?? 0} in error
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Consumption</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            {selectedVessel === "all" || !rob ? (
              <div className="text-2xl font-bold" data-testid="text-avg-consumption">
                --
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-avg-consumption">
                  {((rob.avgConsumptionKgPerH / 1000) * 24).toFixed(2)} MT/d
                </div>
                <p className="text-xs text-muted-foreground">
                  {rob.avgConsumptionKgPerH.toFixed(1)} kg/h avg
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-rms-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-rms-alerts">
            <Bell className="h-4 w-4 mr-2" />
            Alerts
            {unacknowledgedAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 text-xs px-1.5">
                {unacknowledgedAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bunkering" data-testid="tab-rms-bunkering">
            <Droplets className="h-4 w-4 mr-2" />
            Bunkering
          </TabsTrigger>
          <TabsTrigger value="consumption" data-testid="tab-rms-consumption">
            <Fuel className="h-4 w-4 mr-2" />
            Consumption
          </TabsTrigger>
          <TabsTrigger value="configs" data-testid="tab-rms-configs">
            <Settings className="h-4 w-4 mr-2" />
            Alert Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab
            fleetPositions={fleetPositions}
            vesselTrack={vesselTrack}
            selectedVessel={selectedVessel}
            onSelectVessel={setSelectedVessel}
            unacknowledgedAlerts={unacknowledgedAlerts}
            bunkerings={bunkerings}
            consumption={consumption}
            tanks={tanks}
            // @ts-ignore -- bulk-silence
            rob={rob}
            alertsLoading={alertsLoading}
            acknowledgeMutation={acknowledgeMutation}
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertsTab
            alerts={alerts}
            alertsLoading={alertsLoading}
            acknowledgeMutation={acknowledgeMutation}
          />
        </TabsContent>

        <TabsContent value="bunkering" className="space-y-4">
          <BunkeringTab bunkerings={bunkerings} bunkeringLoading={bunkeringLoading} />
        </TabsContent>

        <TabsContent value="consumption" className="space-y-4">
          <ConsumptionTab
            selectedVessel={selectedVessel}
            consumption={consumption}
            consumptionLoading={consumptionLoading}
            dailyConsumption={dailyConsumption}
          />
        </TabsContent>

        <TabsContent value="configs" className="space-y-4">
          <ConfigsTab
            vessels={vessels}
            alertConfigs={alertConfigs}
            configsLoading={configsLoading}
            deleteConfigMutation={deleteConfigMutation}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
