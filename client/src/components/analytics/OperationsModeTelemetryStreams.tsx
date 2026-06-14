import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { SensorSparklineChart, useTelemetryStreams } from "@/features/telemetry";

export function OperationsModeTelemetryStreams() {
  const [, navigate] = useLocation();
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");

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

  const anomalyCount = streams.filter((s) => s.hasAnomaly).length;

  return (
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
            {anomalyCount > 0 && (
              <Badge variant="destructive" data-testid="badge-anomaly-count">
                {anomalyCount} anomalies
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
  );
}
