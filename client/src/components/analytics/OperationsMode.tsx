import { useState, useCallback } from "react";
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Check,
  Eye,
  TrendingUp,
  Brain,
  LineChart as LineChartIcon,
  RefreshCw,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { useOperationsModeData } from "@/features/analytics";
import { useTelemetryStreams, SensorSparklineChart } from "@/features/telemetry";
import { useQuery } from "@tanstack/react-query";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { getAckStatusLabel, getAckStatusVariant } from "@/lib/severity";

export function OperationsMode() {
  const [, navigate] = useLocation();
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");

  const {
    isConnected,
    latestTelemetry,
    failurePredictions,
    criticalEquipment,
    warningEquipment,
    healthyEquipment,
    driftingSensors,
    highConfidencePredictions,
    avgPredictionConfidence,
    equipmentHealthTrends,
    unacknowledgedAnomalies,
    watchingAnomalies,
    acknowledgedCount,
    handleAcknowledge,
    handleWatch,
    getAnomalyAckStatus,
    getAnomalyId,
    getDriftThreshold,
  } = useOperationsModeData();

  const { data: vessels = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
  });

  const { data: equipment = [] } = useQuery<Array<{ id: string; name: string; vesselId: string }>>({
    queryKey: ["/api/equipment"],
  });

  const filteredEquipment =
    selectedVessel === "all" ? equipment : equipment.filter((e) => e.vesselId === selectedVessel);

  const [telemetrySectionRef, isTelemetrySectionVisible] = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "100px",
    triggerOnce: true,
  });

  const {
    streams,
    isLoading: streamsLoading,
    refetch: refetchStreams,
  } = useTelemetryStreams({
    vesselId: selectedVessel === "all" ? undefined : selectedVessel,
    equipmentId: selectedEquipment === "all" ? undefined : selectedEquipment,
    hours: 1,
    refreshInterval: 30000,
    enabled: isTelemetrySectionVisible,
  });

  const handleViewDetails = useCallback(
    (equipmentId: string, sensorType: string) => {
      navigate(`/equipment?id=${equipmentId}&sensor=${sensorType}`);
    },
    [navigate]
  );

  return (
    <div className="space-y-6">
      <ScenarioBanner
        type="info"
        title="Operations Mode - Real-Time Monitoring"
        description="Monitor live equipment health, telemetry streams, and operational anomalies. Use this view for day-to-day fleet oversight and rapid response to issues."
      />

      <Card data-testid="card-connection-status">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Live Connection Status</CardTitle>
            <div className="flex items-center gap-2" data-testid="connection-indicator">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" data-testid="icon-connected" />
                  <span className="text-sm text-green-500" data-testid="status-connection">
                    Connected
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" data-testid="icon-disconnected" />
                  <span className="text-sm text-red-500" data-testid="status-connection">
                    Disconnected
                  </span>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {latestTelemetry && (
            <div className="text-sm" data-testid="latest-telemetry">
              <p className="text-muted-foreground" data-testid="text-latest-reading">
                Latest: {latestTelemetry.sensorType} = {latestTelemetry.value}
                {latestTelemetry.unit} (
                {formatDistanceToNow(new Date(latestTelemetry.timestamp), { addSuffix: true })})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-prediction-status">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Prediction Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div
                className="flex justify-between items-center"
                data-testid="metric-avg-confidence"
              >
                <span className="text-sm text-muted-foreground">Avg Confidence</span>
                <ConfidenceBadge confidence={avgPredictionConfidence} />
              </div>
              <div
                className="flex justify-between items-center"
                data-testid="metric-high-confidence"
              >
                <span className="text-sm text-muted-foreground">High Confidence</span>
                <Badge
                  variant="default"
                  className="min-w-[3rem] justify-center"
                  data-testid="badge-high-confidence"
                >
                  {highConfidencePredictions.length}
                </Badge>
              </div>
              <div
                className="flex justify-between items-center"
                data-testid="metric-active-predictions"
              >
                <span className="text-sm text-muted-foreground">Active Predictions</span>
                <Badge
                  variant="outline"
                  className="min-w-[3rem] justify-center"
                  data-testid="badge-active-predictions"
                >
                  {failurePredictions.length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        {driftingSensors.length > 0 && (
          <Card className="border-amber-500" data-testid="card-telemetry-drift">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                <TrendingUp className="h-4 w-4" />
                Telemetry Drift Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div
                  className="flex justify-between items-center"
                  data-testid="metric-drifting-sensors"
                >
                  <span className="text-sm text-muted-foreground">Drifting Sensors</span>
                  <span
                    className="text-lg font-bold text-amber-600"
                    data-testid="text-drifting-sensors"
                  >
                    {driftingSensors.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground" data-testid="text-drift-description">
                  Sensor values deviating beyond per-sensor thresholds from baseline
                </p>
                <div className="mt-2 space-y-1" data-testid="list-drifting-sensors">
                  {driftingSensors.slice(0, 3).map((sensor, idx) => (
                    <div
                      key={`drift-${sensor.equipmentId}-${sensor.sensorType}`}
                      className="text-xs flex items-center justify-between"
                      data-testid={`item-drift-${idx}`}
                    >
                      <span>
                        <span className="font-medium" data-testid={`text-drift-sensor-${idx}`}>
                          {sensor.sensorType}
                        </span>
                        <span className="text-muted-foreground"> on {sensor.equipmentId}</span>
                      </span>
                      <span className="text-muted-foreground ml-2">
                        threshold: {getDriftThreshold(sensor.sensorType)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-500/50" data-testid="card-critical-equipment">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Critical</CardTitle>
              <ContextHelp
                title="Critical Equipment"
                description="Equipment with health index below 30%. Requires immediate attention to prevent failures."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive" data-testid="text-critical-count">
              {criticalEquipment.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/50" data-testid="card-warning-equipment">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Warning</CardTitle>
              <ContextHelp
                title="Warning Equipment"
                description="Equipment with health index 30-49%. Schedule maintenance soon to prevent degradation."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600" data-testid="text-warning-count">
              {warningEquipment.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/50" data-testid="card-healthy-equipment">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Healthy</CardTitle>
              <ContextHelp
                title="Healthy Equipment"
                description="Equipment with health index 75%+. Operating within normal parameters."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="text-healthy-count">
              {healthyEquipment.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {criticalEquipment.length > 0 && (
        <Card className="border-destructive" data-testid="card-critical-list">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Critical Equipment Requiring Attention</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="list-critical-equipment">
              {criticalEquipment.map((eq) => (
                <div
                  key={eq.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`item-critical-equipment-${eq.id}`}
                >
                  <div>
                    <p className="font-medium" data-testid={`text-equipment-name-${eq.id}`}>
                      {eq.name || eq.id}
                    </p>
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid={`text-equipment-metrics-${eq.id}`}
                    >
                      Health: {eq.healthIndex}% | Failure Risk: {eq.failureRisk}%
                    </p>
                  </div>
                  <Badge variant="destructive" data-testid={`badge-critical-${eq.id}`}>
                    CRITICAL
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {failurePredictions.length > 0 && (
        <CollapsibleSection
          title="Active Failure Predictions"
          badge={`${failurePredictions.length} active`}
          summary={`${highConfidencePredictions.length} high-confidence predictions`}
        >
          <div className="space-y-2" data-testid="list-predictions">
            {failurePredictions.slice(0, 8).map((pred, idx) => (
              <div
                key={pred.id || `pred-${idx}`}
                className="flex items-center justify-between gap-3 p-3 border rounded-lg"
                data-testid={`item-prediction-${idx}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className="font-medium text-sm"
                      data-testid={`text-prediction-equipment-${idx}`}
                    >
                      {pred.equipmentName || pred.equipmentId || "Unknown"}
                    </p>
                    <ConfidenceBadge confidence={pred.confidence || 0} />
                    <DataFreshnessBadge lastUpdated={pred.timestamp} />
                  </div>
                  {pred.failureType && (
                    <p className="text-xs text-muted-foreground mt-1">{pred.failureType}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Recent Anomalies"
        badge={
          unacknowledgedAnomalies.length > 0 ? `${unacknowledgedAnomalies.length} new` : undefined
        }
        summary={
          unacknowledgedAnomalies.length > 0
            ? `${unacknowledgedAnomalies.length} new, ${watchingAnomalies.length} watching`
            : `No new anomalies. ${acknowledgedCount > 0 ? `${acknowledgedCount} acknowledged this session.` : ""}`
        }
      >
        {unacknowledgedAnomalies.length === 0 && watchingAnomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No anomalies requiring attention.{" "}
            {acknowledgedCount > 0 && `${acknowledgedCount} acknowledged this session.`}
          </p>
        ) : (
          <div className="space-y-2">
            {[...unacknowledgedAnomalies.slice(0, 8), ...watchingAnomalies.slice(0, 4)].map(
              (anomaly, idx) => {
                const anomalyId = getAnomalyId(anomaly);
                const status = getAnomalyAckStatus(anomalyId);
                return (
                  <div
                    key={anomalyId}
                    className="flex items-center justify-between gap-3 p-3 border rounded-lg"
                    data-testid={`item-anomaly-${idx}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="font-medium text-sm"
                          data-testid={`text-anomaly-equipment-${idx}`}
                        >
                          {anomaly.equipmentName || anomaly.equipmentId}
                        </p>
                        <Badge
                          variant={getAckStatusVariant(status)}
                          className="text-xs"
                          data-testid={`badge-anomaly-status-${idx}`}
                        >
                          {getAckStatusLabel(status)}
                        </Badge>
                        <DataFreshnessBadge lastUpdated={anomaly.timestamp} />
                      </div>
                      <p
                        className="text-xs text-muted-foreground"
                        data-testid={`text-anomaly-details-${idx}`}
                      >
                        {anomaly.sensorType}: {anomaly.value}
                        {anomaly.unit} ({anomaly.zscore?.toFixed(1)}σ deviation)
                      </p>
                      <Badge
                        variant="outline"
                        className="mt-1 text-xs"
                        data-testid={`badge-anomaly-time-${idx}`}
                      >
                        {formatDistanceToNow(new Date(anomaly.timestamp), { addSuffix: true })}
                      </Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Link
                        href={`/equipment?id=${anomaly.equipmentId}&sensor=${anomaly.sensorType}`}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-view-graph-${idx}`}
                        >
                          <LineChartIcon className="h-3 w-3 mr-1" />
                          Graph
                        </Button>
                      </Link>
                      {status === "unacknowledged" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWatch(anomalyId)}
                            data-testid={`button-watch-anomaly-${idx}`}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Watch
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledge(anomalyId)}
                            data-testid={`button-acknowledge-anomaly-${idx}`}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Ack
                          </Button>
                        </>
                      )}
                      {status === "watching" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledge(anomalyId)}
                          data-testid={`button-acknowledge-anomaly-${idx}`}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Ack
                        </Button>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </CollapsibleSection>

      {equipmentHealthTrends.length > 0 && (
        <CollapsibleSection
          title="Equipment Health Trends"
          summary={`Showing trends for ${equipmentHealthTrends.slice(0, 3).length} equipment units`}
        >
          <div className="space-y-6">
            {equipmentHealthTrends.slice(0, 3).map((eq) => (
              <div
                key={eq.equipmentId}
                className="space-y-2"
                data-testid={`item-health-trend-${eq.equipmentId}`}
              >
                <div className="flex items-center justify-between">
                  <h4
                    className="text-sm font-medium"
                    data-testid={`text-trend-name-${eq.equipmentId}`}
                  >
                    {eq.name}
                  </h4>
                  <Badge
                    variant={eq.currentHealth < 50 ? "destructive" : "default"}
                    data-testid={`badge-trend-health-${eq.equipmentId}`}
                  >
                    {eq.currentHealth}% Health
                  </Badge>
                </div>
                <div className="h-48" data-testid={`chart-health-trend-${eq.equipmentId}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={eq.trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="health"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <div ref={telemetrySectionRef}>
        <CollapsibleSection
          title="Active Telemetry Streams"
          summary={`${streams.length} sensors reporting`}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedVessel}
                onValueChange={(v) => {
                  setSelectedVessel(v);
                  setSelectedEquipment("all");
                }}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-vessel">
                  <SelectValue placeholder="All Vessels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vessels</SelectItem>
                  {vessels.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                <SelectTrigger className="w-[180px]" data-testid="select-equipment">
                  <SelectValue placeholder="All Equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {filteredEquipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchStreams()}
                data-testid="button-refresh-streams"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              {streams.filter((s) => s.hasAnomaly).length > 0 && (
                <Badge variant="destructive" data-testid="badge-anomaly-count">
                  {streams.filter((s) => s.hasAnomaly).length} anomalies
                </Badge>
              )}
            </div>
            {streamsLoading ? (
              <div className="text-sm text-muted-foreground">Loading telemetry streams...</div>
            ) : streams.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No telemetry streams available. Check sensor configuration.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {streams.slice(0, 12).map((stream) => (
                  <SensorSparklineChart
                    key={`${stream.equipmentId}-${stream.sensorType}`}
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
                    onViewDetails={() => handleViewDetails(stream.equipmentId, stream.sensorType)}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
