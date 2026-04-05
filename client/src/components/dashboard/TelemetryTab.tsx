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
