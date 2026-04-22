import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Fuel,
  Ship,
  Bell,
  BellOff,
  AlertTriangle,
  CheckCircle,
  Anchor,
  Droplets,
  BarChart3,
  Gauge,
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  Settings,
  TrendingUp,
  Clock,
  Navigation,
  Map,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Vessel {
  id: string;
  name: string;
  vessel_type?: string;
  online_status?: string;
}

interface RmsSummary {
  alerts?: { unacknowledged?: number; critical?: number; total24h?: number };
  bunkering?: { last30Days?: number; active?: number };
  efmsConnections?: { polling?: number; total?: number; error?: number };
}

interface RmsAlert {
  id: string;
  vessel_id: string;
  vessel_name?: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

interface BunkeringEvent {
  id: string;
  vessel_id: string;
  vessel_name?: string;
  started_at: string;
  ended_at?: string;
  status: string;
  volume_kg?: string;
  avg_flow_kg_per_h?: string;
  fuel_type?: string;
  source?: string;
  supplier?: string;
  port?: string;
}

interface AlertConfig {
  id: string;
  vessel_id: string;
  vessel_name?: string;
  name: string;
  alert_type: string;
  enabled: boolean;
  cooldown_minutes: number;
  config: Record<string, unknown>;
  last_triggered_at?: string;
}

interface HourlyConsumption {
  hour: string;
  avg_flow_kg_per_h?: string;
  max_flow_kg_per_h?: string;
  min_flow_kg_per_h?: string;
  avg_density?: string;
  avg_temperature?: string;
  main_engine_flow?: string;
  port_engine_flow?: string;
  stbd_engine_flow?: string;
  generator_flow?: string;
  boiler_flow?: string;
  do_flow?: string;
  shaft_power_kw?: string;
  shaft_rpm?: string;
  running_hours?: string;
  data_points?: number;
}

interface DailyConsumption {
  day: string;
  avg_flow_kg_per_h?: string;
  estimated_daily_mt?: string;
  running_hours_delta?: string;
  est_distance_nm?: string;
  avg_sog?: string;
  main_engine_flow?: string;
  generator_flow?: string;
  avg_density?: string;
}

interface TankReading {
  sensor_type: string;
  value: string;
  timestamp?: string;
}

interface RobEstimate {
  avgConsumptionKgPerH: number;
  tanks?: TankReading[];
  estimatedAt?: string;
}

interface FleetPosition {
  vessel_id: string;
  vessel_name?: string;
  latitude?: number;
  longitude?: number;
  sog?: number;
  cog?: number;
  heading?: number;
  last_position_at?: string;
}

interface TrackPoint {
  latitude: number;
  longitude: number;
  sog?: number;
  cog?: number;
  heading?: number;
  timestamp?: string;
}

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
  const daysMap: Record<string, number> = { "24h": 1, "48h": 2, "7d": 7, "30d": 30 };

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

  const { data: rob } = useQuery<RobEstimate>({
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

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Fleet Map */}
          <FleetMapCard
            positions={fleetPositions}
            vesselTrack={vesselTrack}
            selectedVessel={selectedVessel}
            onSelectVessel={setSelectedVessel}
            alerts={unacknowledgedAlerts}
            bunkerings={bunkerings.filter((b) => b.status === "in_progress")}
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Per-Engine Gauges */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-green-600" />
                  Engine Flow Gauges
                </CardTitle>
                <CardDescription>
                  {selectedVessel === "all"
                    ? "Select a vessel for per-engine data"
                    : "Real-time fuel flow by engine / consumer"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedVessel === "all" ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select a vessel to view engine gauges
                  </p>
                ) : (
                  <EngineFlowGauges consumption={consumption} />
                )}
              </CardContent>
            </Card>

            {/* Tank Levels Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-600" />
                  Tank Levels
                </CardTitle>
                <CardDescription>Latest tank readings from FMCC</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedVessel === "all" ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select a vessel to view tank levels
                  </p>
                ) : tanks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tank data available
                  </p>
                ) : (
                  <div className="space-y-3">
                    {tanks.map((tank, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                        data-testid={`tank-level-${idx}`}
                      >
                        <span className="text-sm font-medium capitalize">
                          {tank.sensorType?.replace("tank_", "").replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">
                            {parseFloat(tank.value).toFixed(1)}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tank.timestamp && format(new Date(tank.timestamp), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* ROB Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-amber-600" />
                  Remaining On Board
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedVessel === "all" || !rob ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select a vessel to view ROB
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Avg Consumption</span>
                      <span className="text-sm font-bold" data-testid="text-rob-avg">
                        {rob.avgConsumptionKgPerH.toFixed(1)} kg/h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Daily Rate</span>
                      <span className="text-sm font-bold">
                        {((rob.avgConsumptionKgPerH * 24) / 1000).toFixed(2)} MT/day
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tank Sensors</span>
                      <span className="text-sm font-bold">{rob.tanks?.length ?? 0} active</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">
                      Estimated at{" "}
                      {rob.estimatedAt && format(new Date(rob.estimatedAt), "HH:mm dd MMM")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Alerts Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-500" />
                  Recent Alerts
                </CardTitle>
                <CardDescription>Latest unacknowledged alerts</CardDescription>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : unacknowledgedAlerts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>No unacknowledged alerts</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unacknowledgedAlerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-2 rounded-lg border"
                        data-testid={`alert-row-${alert.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <SeverityIcon severity={alert.severity} />
                          <div>
                            <p className="text-sm font-medium">{alert.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {alert.vessel_name} &middot;{" "}
                              {alert.created_at &&
                                format(new Date(alert.created_at), "dd MMM HH:mm")}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                          data-testid={`btn-ack-${alert.id}`}
                        >
                          <BellOff className="h-3 w-3 mr-1" />
                          Ack
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>All triggered alerts in the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No alerts in the selected period</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Vessel</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id} data-testid={`alert-table-row-${alert.id}`}>
                          <TableCell>
                            <SeverityBadge severity={alert.severity} />
                          </TableCell>
                          <TableCell className="font-medium max-w-[300px] truncate">
                            {alert.title}
                          </TableCell>
                          <TableCell>{alert.vessel_name || alert.vessel_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{alert.alert_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {alert.created_at && format(new Date(alert.created_at), "dd MMM HH:mm")}
                          </TableCell>
                          <TableCell>
                            {alert.acknowledged ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Acked
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Open</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!alert.acknowledged && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => acknowledgeMutation.mutate(alert.id)}
                                disabled={acknowledgeMutation.isPending}
                                data-testid={`btn-ack-table-${alert.id}`}
                              >
                                <BellOff className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bunkering Tab */}
        <TabsContent value="bunkering" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Anchor className="h-5 w-5" />
                Bunkering Events
              </CardTitle>
              <CardDescription>
                Auto-detected and manual bunkering operations (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bunkeringLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : bunkerings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No bunkering events recorded</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vessel</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Ended</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Volume (MT)</TableHead>
                        <TableHead className="text-right">Avg Flow</TableHead>
                        <TableHead>Fuel</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Port</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bunkerings.map((b) => {
                        const durationMin = b.ended_at
                          ? Math.round(
                              (new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) /
                                60000
                            )
                          : null;
                        return (
                          <TableRow key={b.id} data-testid={`bunkering-row-${b.id}`}>
                            <TableCell className="font-medium">
                              {b.vessel_name || b.vessel_id}
                            </TableCell>
                            <TableCell>{format(new Date(b.started_at), "dd MMM HH:mm")}</TableCell>
                            <TableCell>
                              {b.ended_at ? format(new Date(b.ended_at), "dd MMM HH:mm") : "--"}
                            </TableCell>
                            <TableCell>
                              {durationMin != null ? `${durationMin} min` : "--"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  b.status === "completed"
                                    ? "secondary"
                                    : b.status === "in_progress"
                                      ? "default"
                                      : "outline"
                                }
                              >
                                {b.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {b.volume_kg ? (parseFloat(b.volume_kg) / 1000).toFixed(2) : "--"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {b.avg_flow_kg_per_h
                                ? `${parseFloat(b.avg_flow_kg_per_h).toFixed(0)} kg/h`
                                : "--"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{b.fuel_type?.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{b.supplier || "--"}</TableCell>
                            <TableCell className="text-sm">{b.port || "--"}</TableCell>
                            <TableCell>
                              <Badge variant={b.source === "auto" ? "default" : "secondary"}>
                                {b.source}
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

        {/* Consumption Tab */}
        <TabsContent value="consumption" className="space-y-4">
          {selectedVessel === "all" ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Select a vessel to view consumption data
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <ConsumptionTrendChart consumption={consumption} loading={consumptionLoading} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Hourly Consumption
                  </CardTitle>
                  <CardDescription>Fuel flow readings aggregated by hour</CardDescription>
                </CardHeader>
                <CardContent>
                  {consumptionLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : consumption.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground">
                      No hourly consumption data available
                    </p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Hour</TableHead>
                            <TableHead className="text-right">Total (kg/h)</TableHead>
                            <TableHead className="text-right">ME Flow</TableHead>
                            <TableHead className="text-right">Port</TableHead>
                            <TableHead className="text-right">Stbd</TableHead>
                            <TableHead className="text-right">Gen</TableHead>
                            <TableHead className="text-right">Boiler</TableHead>
                            <TableHead className="text-right">Shaft kW</TableHead>
                            <TableHead className="text-right">Run Hrs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consumption.map((c, idx) => (
                            <TableRow key={idx} data-testid={`consumption-row-${idx}`}>
                              <TableCell className="font-medium">
                                {c.hour && format(new Date(c.hour), "dd MMM HH:mm")}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {c.avg_flow_kg_per_h
                                  ? parseFloat(c.avg_flow_kg_per_h).toFixed(1)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {c.main_engine_flow
                                  ? parseFloat(c.main_engine_flow).toFixed(1)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {c.port_engine_flow
                                  ? parseFloat(c.port_engine_flow).toFixed(1)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {c.stbd_engine_flow
                                  ? parseFloat(c.stbd_engine_flow).toFixed(1)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {c.generator_flow ? parseFloat(c.generator_flow).toFixed(1) : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {c.boiler_flow ? parseFloat(c.boiler_flow).toFixed(1) : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {c.shaft_power_kw ? parseFloat(c.shaft_power_kw).toFixed(0) : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {c.running_hours ? parseFloat(c.running_hours).toFixed(1) : "--"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                    Daily Summary
                  </CardTitle>
                  <CardDescription>
                    Daily consumption, running hours, and voyage data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dailyConsumption.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground">
                      No daily consumption data available
                    </p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Day</TableHead>
                            <TableHead className="text-right">Avg Flow (kg/h)</TableHead>
                            <TableHead className="text-right">Est. Daily (MT)</TableHead>
                            <TableHead className="text-right">Running Hrs</TableHead>
                            <TableHead className="text-right">Distance (NM)</TableHead>
                            <TableHead className="text-right">Avg SOG (kn)</TableHead>
                            <TableHead className="text-right">ME Flow</TableHead>
                            <TableHead className="text-right">Gen Flow</TableHead>
                            <TableHead className="text-right">Density</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dailyConsumption.map((d, idx) => (
                            <TableRow key={idx} data-testid={`daily-row-${idx}`}>
                              <TableCell className="font-medium">
                                {d.day && format(new Date(d.day), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {d.avg_flow_kg_per_h
                                  ? parseFloat(d.avg_flow_kg_per_h).toFixed(1)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {d.estimated_daily_mt
                                  ? parseFloat(d.estimated_daily_mt).toFixed(2)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {d.running_hours_delta
                                  ? parseFloat(d.running_hours_delta).toFixed(1)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {d.est_distance_nm
                                  ? parseFloat(d.est_distance_nm).toFixed(1)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {d.avg_sog ? parseFloat(d.avg_sog).toFixed(1) : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {d.main_engine_flow
                                  ? parseFloat(d.main_engine_flow).toFixed(1)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {d.generator_flow ? parseFloat(d.generator_flow).toFixed(1) : "--"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {d.avg_density ? parseFloat(d.avg_density).toFixed(4) : "--"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Alert Config Tab */}
        <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Alert Configurations
                </CardTitle>
                <CardDescription>Threshold, geofence, and bunkering alert rules</CardDescription>
              </div>
              <CreateAlertConfigDialog vessels={vessels} />
            </CardHeader>
            <CardContent>
              {configsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : alertConfigs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No alert configurations set up</p>
                  <p className="text-sm">
                    Create alert rules to monitor fuel thresholds, geofences, and bunkering events
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Vessel</TableHead>
                        <TableHead>Enabled</TableHead>
                        <TableHead>Cooldown</TableHead>
                        <TableHead>Last Triggered</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alertConfigs.map((cfg) => (
                        <TableRow key={cfg.id} data-testid={`config-row-${cfg.id}`}>
                          <TableCell className="font-medium">{cfg.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{cfg.alert_type}</Badge>
                          </TableCell>
                          <TableCell>{cfg.vessel_name || cfg.vessel_id}</TableCell>
                          <TableCell>
                            <Badge variant={cfg.enabled ? "default" : "secondary"}>
                              {cfg.enabled ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell>{cfg.cooldown_minutes} min</TableCell>
                          <TableCell className="text-sm">
                            {cfg.last_triggered_at
                              ? format(new Date(cfg.last_triggered_at), "dd MMM HH:mm")
                              : "Never"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deleteConfigMutation.mutate(cfg.id)}
                              disabled={deleteConfigMutation.isPending}
                              data-testid={`btn-delete-config-${cfg.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") {
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  }
  if (severity === "warning") {
    return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  }
  return <Bell className="h-5 w-5 text-blue-500" />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };
  return <Badge className={colors[severity] || colors.info}>{severity}</Badge>;
}

function FleetMapCard({
  positions,
  vesselTrack,
  selectedVessel,
  onSelectVessel,
  alerts,
  bunkerings,
}: {
  positions: FleetPosition[];
  vesselTrack: TrackPoint[];
  selectedVessel: string;
  onSelectVessel: (id: string) => void;
  alerts: RmsAlert[];
  bunkerings: BunkeringEvent[];
}) {
  const svgWidth = 700;
  const svgHeight = 340;
  const padding = 40;

  const validPositions = positions.filter((p) => p.latitude != null && p.longitude != null);
  const allPoints = useMemo(
    () => [
      ...validPositions.map((p) => ({ lat: +p.latitude!, lon: +p.longitude! })),
      ...vesselTrack.map((t) => ({ lat: +t.latitude, lon: +t.longitude })),
    ],
    [validPositions, vesselTrack]
  );

  const bounds = useMemo(() => {
    if (allPoints.length === 0) {
      return { minLat: 0, maxLat: 10, minLon: 100, maxLon: 120 };
    }
    const lats = allPoints.map((p) => p.lat);
    const lons = allPoints.map((p) => p.lon);
    const pad = 0.05;
    return {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLon: Math.min(...lons) - pad,
      maxLon: Math.max(...lons) + pad,
    };
  }, [allPoints]);

  const project = (lat: number, lon: number) => {
    const latRange = bounds.maxLat - bounds.minLat || 1;
    const lonRange = bounds.maxLon - bounds.minLon || 1;
    return {
      x: padding + ((lon - bounds.minLon) / lonRange) * (svgWidth - 2 * padding),
      y: padding + ((bounds.maxLat - lat) / latRange) * (svgHeight - 2 * padding),
    };
  };

  const alertVesselIds = new Set(alerts.map((a) => a.vessel_id));
  const bunkeringVesselIds = new Set(bunkerings.map((b) => b.vessel_id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5 text-blue-600" />
          Fleet Map
        </CardTitle>
        <CardDescription>
          {validPositions.length} vessels with position data &middot; Click a vessel to select
        </CardDescription>
      </CardHeader>
      <CardContent>
        {validPositions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No position data available</p>
            <p className="text-sm">Vessel positions appear when FMCC or AIS data is ingested</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full border rounded-lg bg-slate-50 dark:bg-slate-900"
              data-testid="fleet-map-svg"
            >
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map((f) => (
                <g key={f}>
                  <line
                    x1={padding}
                    y1={padding + f * (svgHeight - 2 * padding)}
                    x2={svgWidth - padding}
                    y2={padding + f * (svgHeight - 2 * padding)}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4"
                  />
                  <line
                    x1={padding + f * (svgWidth - 2 * padding)}
                    y1={padding}
                    x2={padding + f * (svgWidth - 2 * padding)}
                    y2={svgHeight - padding}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4"
                  />
                </g>
              ))}
              {/* Axis labels */}
              <text
                x={padding}
                y={svgHeight - 5}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.4}
              >
                {bounds.minLon.toFixed(2)}°E
              </text>
              <text
                x={svgWidth - padding}
                y={svgHeight - 5}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.4}
                textAnchor="end"
              >
                {bounds.maxLon.toFixed(2)}°E
              </text>
              <text x={5} y={padding + 10} fontSize={9} fill="currentColor" fillOpacity={0.4}>
                {bounds.maxLat.toFixed(2)}°N
              </text>
              <text
                x={5}
                y={svgHeight - padding}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.4}
              >
                {bounds.minLat.toFixed(2)}°N
              </text>

              {/* Vessel track polyline */}
              {vesselTrack.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  points={vesselTrack
                    .map((t) => {
                      const p = project(+t.latitude, +t.longitude);
                      return `${p.x},${p.y}`;
                    })
                    .join(" ")}
                />
              )}

              {/* Vessel markers */}
              {validPositions.map((v) => {
                const pos = project(+v.latitude, +v.longitude);
                const isSelected = selectedVessel === v.vessel_id;
                const hasAlert = alertVesselIds.has(v.vessel_id);
                const isBunkering = bunkeringVesselIds.has(v.vessel_id);
                const heading = v.heading || v.cog || 0;
                const freshness = v.last_position_at
                  ? (Date.now() - new Date(v.last_position_at).getTime()) / 60000
                  : Infinity;
                const isStale = freshness > 60;

                return (
                  <g
                    key={v.vessel_id}
                    className="cursor-pointer"
                    onClick={() => onSelectVessel(v.vessel_id)}
                    data-testid={`map-vessel-${v.vessel_id}`}
                  >
                    {/* Heading arrow */}
                    <g transform={`translate(${pos.x},${pos.y}) rotate(${heading})`}>
                      <polygon
                        points="0,-12 -6,6 6,6"
                        fill={
                          hasAlert
                            ? "#ef4444"
                            : isBunkering
                              ? "#3b82f6"
                              : isStale
                                ? "#9ca3af"
                                : "#22c55e"
                        }
                        stroke={isSelected ? "#000" : "none"}
                        strokeWidth={isSelected ? 2 : 0}
                        opacity={isStale ? 0.5 : 1}
                      />
                    </g>
                    {/* Label */}
                    <text
                      x={pos.x}
                      y={pos.y + 18}
                      textAnchor="middle"
                      fontSize={8}
                      fill="currentColor"
                      fillOpacity={0.8}
                      fontWeight={isSelected ? "bold" : "normal"}
                    >
                      {v.vessel_name?.substring(0, 12)}
                    </text>
                    {/* Freshness dot */}
                    <circle
                      cx={pos.x + 10}
                      cy={pos.y - 10}
                      r={3}
                      fill={isStale ? "#ef4444" : freshness > 30 ? "#f59e0b" : "#22c55e"}
                    />
                    {/* Bunkering indicator */}
                    {isBunkering && (
                      <circle
                        cx={pos.x - 10}
                        cy={pos.y - 10}
                        r={4}
                        fill="#3b82f6"
                        strokeWidth={1}
                        stroke="#fff"
                      >
                        <animate
                          attributeName="opacity"
                          values="1;0.3;1"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Map Legend */}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" /> Online
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-500" /> &gt;30 min ago
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" /> Stale / Alert
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" /> Bunkering
              </div>
              <div className="flex items-center gap-1">
                <span className="text-blue-500">—</span> Track
              </div>
            </div>
            {/* Per-vessel freshness */}
            {validPositions.length > 0 && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {validPositions.map((v) => {
                  const freshness = v.last_position_at
                    ? (Date.now() - new Date(v.last_position_at).getTime()) / 60000
                    : Infinity;
                  const freshnessColor =
                    freshness > 60
                      ? "text-red-500"
                      : freshness > 30
                        ? "text-amber-500"
                        : "text-green-600";
                  return (
                    <div
                      key={v.vessel_id}
                      className="flex items-center gap-1.5 truncate"
                      data-testid={`freshness-${v.vessel_id}`}
                    >
                      <span className="font-medium truncate">{v.vessel_name || v.vessel_id}</span>
                      <span className={freshnessColor}>
                        {v.last_position_at
                          ? formatDistanceToNow(new Date(v.last_position_at), { addSuffix: true })
                          : "no data"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConsumptionTrendChart({
  consumption,
  loading,
}: {
  consumption: HourlyConsumption[];
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    if (!consumption || consumption.length === 0) {
      return [];
    }
    return consumption.map((c) => ({
      hour: c.hour ? format(new Date(c.hour), "HH:mm") : "",
      total: c.avg_flow_kg_per_h ? parseFloat(c.avg_flow_kg_per_h) : 0,
      me: c.main_engine_flow ? parseFloat(c.main_engine_flow) : 0,
      gen: c.generator_flow ? parseFloat(c.generator_flow) : 0,
      boiler: c.boiler_flow ? parseFloat(c.boiler_flow) : 0,
    }));
  }, [consumption]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Consumption Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Consumption Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-6 text-muted-foreground">No trend data available</p>
        </CardContent>
      </Card>
    );
  }

  const maxVal = Math.max(...chartData.map((d) => d.total), 1);
  const chartW = 700;
  const chartH = 200;
  const padL = 50;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const stepX = plotW / Math.max(chartData.length - 1, 1);
  const scaleY = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const linePath = (key: "total" | "me" | "gen" | "boiler") =>
    chartData
      .map((d, i) => `${i === 0 ? "M" : "L"}${padL + i * stepX},${scaleY(d[key])}`)
      .join(" ");

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
  const xLabelInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <Card data-testid="card-consumption-trend">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Consumption Trend
        </CardTitle>
        <CardDescription>Hourly fuel flow trend (kg/h)</CardDescription>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={chartW - padR}
                y1={scaleY(tick)}
                y2={scaleY(tick)}
                stroke="currentColor"
                strokeOpacity={0.1}
              />
              <text
                x={padL - 5}
                y={scaleY(tick) + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {tick.toFixed(0)}
              </text>
            </g>
          ))}
          {chartData.map((d, i) =>
            i % xLabelInterval === 0 ? (
              <text
                key={i}
                x={padL + i * stepX}
                y={chartH - 5}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={8}
              >
                {d.hour}
              </text>
            ) : null
          )}
          <path d={linePath("total")} fill="none" stroke="#3b82f6" strokeWidth={2} />
          <path
            d={linePath("me")}
            fill="none"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          <path
            d={linePath("gen")}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          <path
            d={linePath("boiler")}
            fill="none"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        </svg>
        <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-blue-500" /> Total
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 bg-green-500"
              style={{ borderTop: "1px dashed" }}
            />{" "}
            ME
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 bg-amber-500"
              style={{ borderTop: "1px dashed" }}
            />{" "}
            Gen
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 bg-red-500"
              style={{ borderTop: "1px dashed" }}
            />{" "}
            Boiler
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EngineFlowGauges({ consumption }: { consumption: HourlyConsumption[] }) {
  const latestReadings = useMemo(() => {
    if (!consumption || consumption.length === 0) {
      return [];
    }
    const latest = consumption[consumption.length - 1];
    return [
      {
        key: "mainEngine",
        label: "Main Engine",
        icon: "⚙️",
        flow: latest?.main_engine_flow,
        max: 2000,
      },
      {
        key: "portEngine",
        label: "Port Engine",
        icon: "◀",
        flow: latest?.port_engine_flow,
        max: 1500,
      },
      {
        key: "stbdEngine",
        label: "Stbd Engine",
        icon: "▶",
        flow: latest?.stbd_engine_flow,
        max: 1500,
      },
      { key: "generator", label: "Generator", icon: "🔌", flow: latest?.generator_flow, max: 500 },
      { key: "boiler", label: "Boiler", icon: "🔥", flow: latest?.boiler_flow, max: 300 },
      { key: "total", label: "Total", icon: "∑", flow: latest?.avg_flow_kg_per_h, max: 5000 },
    ];
  }, [consumption]);

  if (latestReadings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No engine flow data available
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {latestReadings.map((engine) => {
        const flow = engine.flow ? parseFloat(engine.flow) : 0;
        const pct = Math.min((flow / engine.max) * 100, 100);
        const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500";
        return (
          <div
            key={engine.key}
            className="p-3 rounded-lg border space-y-2"
            data-testid={`gauge-${engine.key}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {engine.icon} {engine.label}
              </span>
            </div>
            <div className="text-lg font-bold font-mono">
              {flow > 0 ? `${flow.toFixed(0)}` : "--"}{" "}
              <span className="text-xs font-normal text-muted-foreground">kg/h</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateAlertConfigDialog({ vessels }: { vessels: Vessel[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [vesselId, setVesselId] = useState("");
  const [alertType, setAlertType] = useState("fuel_threshold");
  const [thresholdValue, setThresholdValue] = useState("500");
  const [engineKey, setEngineKey] = useState("mainEngine");
  const [direction, setDirection] = useState("above");
  const [centerLat, setCenterLat] = useState("");
  const [centerLon, setCenterLon] = useState("");
  const [radiusNm, setRadiusNm] = useState("5");
  const [triggerOn, setTriggerOn] = useState("both");
  const [cooldownMinutes, setCooldownMinutes] = useState("60");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      let config: Record<string, unknown> = {};
      if (alertType === "fuel_threshold") {
        config = { engineKey, thresholdKgPerH: parseFloat(thresholdValue), direction };
      } else if (alertType === "daily_consumption") {
        config = { maxDailyMt: parseFloat(thresholdValue) };
      } else if (alertType === "geofence") {
        config = {
          centerLat: parseFloat(centerLat),
          centerLon: parseFloat(centerLon),
          radiusNm: parseFloat(radiusNm),
          triggerOn,
        };
      } else if (alertType === "bunkering") {
        config = {
          notifyOnStart: true,
          notifyOnEnd: true,
          minVolumeLitres: parseFloat(thresholdValue) || 0,
        };
      }
      await apiRequest("POST", "/api/rms/alerts/configs", {
        vesselId,
        alertType,
        name,
        config,
        cooldownMinutes: parseInt(cooldownMinutes),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rms/alerts/configs"] });
      toast({ title: "Alert configuration created" });
      setOpen(false);
      setName("");
      setVesselId("");
      setAlertType("fuel_threshold");
    },
    onError: () => {
      toast({ title: "Failed to create alert config", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="btn-create-alert-config">
          <Plus className="h-4 w-4 mr-1" />
          New Alert Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Alert Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High consumption warning"
              data-testid="input-alert-name"
            />
          </div>
          <div>
            <Label>Vessel</Label>
            <Select value={vesselId} onValueChange={setVesselId}>
              <SelectTrigger data-testid="select-alert-vessel">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                {vessels
                  .filter((v) => v.id)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Alert Type</Label>
            <Select value={alertType} onValueChange={setAlertType}>
              <SelectTrigger data-testid="select-alert-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fuel_threshold">Fuel Threshold</SelectItem>
                <SelectItem value="daily_consumption">Daily Consumption</SelectItem>
                <SelectItem value="geofence">Geofence</SelectItem>
                <SelectItem value="bunkering">Bunkering</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertType === "fuel_threshold" && (
            <>
              <div>
                <Label>Engine</Label>
                <Select value={engineKey} onValueChange={setEngineKey}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mainEngine">Main Engine</SelectItem>
                    <SelectItem value="portEngine">Port Engine</SelectItem>
                    <SelectItem value="stbdEngine">Starboard Engine</SelectItem>
                    <SelectItem value="generator">Generator</SelectItem>
                    <SelectItem value="boiler">Boiler</SelectItem>
                    <SelectItem value="total">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Threshold (kg/h)</Label>
                <Input
                  type="number"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  data-testid="input-threshold"
                />
              </div>
              <div>
                <Label>Direction</Label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Above</SelectItem>
                    <SelectItem value="below">Below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {alertType === "daily_consumption" && (
            <div>
              <Label>Max Daily Consumption (MT)</Label>
              <Input
                type="number"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                data-testid="input-max-daily"
              />
            </div>
          )}

          {alertType === "geofence" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Center Lat</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={centerLat}
                    onChange={(e) => setCenterLat(e.target.value)}
                    data-testid="input-center-lat"
                  />
                </div>
                <div>
                  <Label>Center Lon</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={centerLon}
                    onChange={(e) => setCenterLon(e.target.value)}
                    data-testid="input-center-lon"
                  />
                </div>
              </div>
              <div>
                <Label>Radius (NM)</Label>
                <Input
                  type="number"
                  value={radiusNm}
                  onChange={(e) => setRadiusNm(e.target.value)}
                  data-testid="input-radius"
                />
              </div>
              <div>
                <Label>Trigger On</Label>
                <Select value={triggerOn} onValueChange={setTriggerOn}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enter">Enter</SelectItem>
                    <SelectItem value="exit">Exit</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {alertType === "bunkering" && (
            <div>
              <Label>Min Volume (litres)</Label>
              <Input
                type="number"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                data-testid="input-min-volume"
              />
            </div>
          )}

          <div>
            <Label>Cooldown (minutes)</Label>
            <Input
              type="number"
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(e.target.value)}
              data-testid="input-cooldown"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || !vesselId || createMutation.isPending}
            data-testid="btn-save-alert-config"
          >
            {createMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
