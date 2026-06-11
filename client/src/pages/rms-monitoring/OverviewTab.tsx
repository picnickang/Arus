import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, BellOff, CheckCircle, Droplets, Fuel, Gauge } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { FleetMapCard } from "./FleetMapCard";
import { EngineFlowGauges } from "./EngineFlowGauges";
import { SeverityIcon } from "./_shared";
import type {
  BunkeringEvent,
  FleetPosition,
  HourlyConsumption,
  RmsAlert,
  RobEstimate,
  TankReading,
  TrackPoint,
} from "./_shared";

export function OverviewTab({
  fleetPositions,
  vesselTrack,
  selectedVessel,
  onSelectVessel,
  unacknowledgedAlerts,
  bunkerings,
  consumption,
  tanks,
  rob,
  alertsLoading,
  acknowledgeMutation,
}: {
  fleetPositions: FleetPosition[];
  vesselTrack: TrackPoint[];
  selectedVessel: string;
  onSelectVessel: (id: string) => void;
  unacknowledgedAlerts: RmsAlert[];
  bunkerings: BunkeringEvent[];
  consumption: HourlyConsumption[];
  tanks: TankReading[];
  rob: RobEstimate | undefined;
  alertsLoading: boolean;
  acknowledgeMutation: UseMutationResult<void, Error, string, unknown>;
}) {
  return (
    <div className="space-y-4">
      <FleetMapCard
        positions={fleetPositions}
        vesselTrack={vesselTrack}
        selectedVessel={selectedVessel}
        onSelectVessel={onSelectVessel}
        alerts={unacknowledgedAlerts}
        bunkerings={bunkerings.filter((b) => b.status === "in_progress")}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                {tanks.map((tank, idx) => {
                  const sensorType =
                    (tank as object as { sensorType?: string }).sensorType ?? tank.sensor_type;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                      data-testid={`tank-level-${idx}`}
                    >
                      <span className="text-sm font-medium capitalize">
                        {sensorType?.replace("tank_", "").replace(/_/g, " ")}
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
                          {alert.created_at && format(new Date(alert.created_at), "dd MMM HH:mm")}
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
    </div>
  );
}
