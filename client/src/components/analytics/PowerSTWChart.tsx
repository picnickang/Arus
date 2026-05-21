import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Ship, AlertCircle, TrendingUp, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BenchmarkLayer } from "./chart-overlays/BenchmarkLayer";
import {
  usePowerSTWData,
  type EnrichedDataPoint,
} from "@/features/analytics/hooks/usePowerSTWData";
import { formatNumber } from "@/lib/formatters";

interface PowerSTWChartProps {
  vesselId: string;
  startDate?: Date;
  endDate?: Date;
}

export function PowerSTWChart({ vesselId, startDate, endDate }: PowerSTWChartProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    enrichedData,
    avgDeviation,
    speedUnit,
    powerUnit,
    toggles,
    setToggle,
    showControls,
    setShowControls,
  } = usePowerSTWData({ vesselId, startDate, endDate });

  if (isLoading) {
    return (
      <Card data-testid="card-power-stw-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Power vs Speed Through Water
          </CardTitle>
          <CardDescription>Propulsion efficiency and hull fouling analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" data-testid="skeleton-power-stw" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/50" data-testid="card-power-stw-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Power-STW Analysis Error
          </CardTitle>
          <CardDescription>Failed to load power-STW data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="text-error-message">
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.actual.length === 0) {
    return (
      <Card data-testid="card-power-stw-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Power vs Speed Through Water
          </CardTitle>
          <CardDescription>Propulsion efficiency and hull fouling analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center h-80 text-center"
            data-testid="empty-state"
          >
            <Ship className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-data">
              No RPM/torque data available for the selected period.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Power-STW analysis requires engine RPM and shaft torque sensors.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-power-stw">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Power vs Speed Through Water
            </CardTitle>
            <CardDescription>
              Propulsion efficiency analysis • {formatNumber(data.metadata.sampleCount)} samples
              {data.metadata.estimatedSTW && (
                <Badge
                  variant="outline"
                  className="ml-2 text-xs"
                  data-testid="badge-speed-estimated"
                >
                  Speed Estimated
                </Badge>
              )}
            </CardDescription>
          </div>
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            data-testid="button-toggle-controls"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {showControls && (
          <div
            className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3"
            data-testid="container-chart-controls"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="baseline-toggle"
                  checked={toggles.showBaseline}
                  onCheckedChange={(checked) => setToggle("showBaseline", checked)}
                  data-testid="switch-baseline"
                />
                <Label htmlFor="baseline-toggle" className="text-sm cursor-pointer">
                  Baseline
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="fleet-avg-toggle"
                  checked={toggles.showFleetAverage}
                  onCheckedChange={(checked) => setToggle("showFleetAverage", checked)}
                  data-testid="switch-fleet-avg"
                />
                <Label htmlFor="fleet-avg-toggle" className="text-sm cursor-pointer">
                  Fleet Average
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="percentiles-toggle"
                  checked={toggles.showPercentiles}
                  onCheckedChange={(checked) => setToggle("showPercentiles", checked)}
                  data-testid="switch-percentiles"
                />
                <Label htmlFor="percentiles-toggle" className="text-sm cursor-pointer">
                  Percentiles
                </Label>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={enrichedData} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="speed"
              type="number"
              name="Speed"
              unit={` ${speedUnit}`}
              label={{
                value: `Speed Through Water (${speedUnit})`,
                position: "insideBottom",
                offset: -15,
              }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="number"
              name="Power"
              unit={` ${powerUnit}`}
              label={{
                value: `Propulsion Power (${powerUnit})`,
                angle: -90,
                position: "insideLeft",
              }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const d = payload[0]!.payload as EnrichedDataPoint;
                  return (
                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm mb-2">Performance Data</p>
                      <p className="text-sm text-muted-foreground">
                        Speed:{" "}
                        <span className="font-mono text-foreground">
                          {d.speed?.toFixed(1)} {speedUnit}
                        </span>
                      </p>
                      {d.actualPower !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Actual Power:{" "}
                          <span className="font-mono text-foreground">
                            {d.actualPower.toFixed(0)} {powerUnit}
                          </span>
                        </p>
                      )}
                      {d.baselinePower !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Baseline:{" "}
                          <span className="font-mono text-foreground">
                            {d.baselinePower.toFixed(0)} {powerUnit}
                          </span>
                        </p>
                      )}
                      {d.fleetAvg !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Fleet Avg:{" "}
                          <span className="font-mono text-foreground">
                            {d.fleetAvg.toFixed(0)} {powerUnit}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="circle" />
            <BenchmarkLayer
              data={enrichedData as object as import("./chart-overlays/BenchmarkLayer").BenchmarkData[]}
              showBaseline={toggles.showBaseline}
              showFleetAverage={toggles.showFleetAverage}
              showPercentiles={toggles.showPercentiles}
              xKey="speed"
            />
            <Scatter
              name="Actual Performance"
              data={enrichedData.filter((d) => d.actualPower !== undefined)}
              fill="hsl(var(--primary))"
              opacity={0.6}
              dataKey="actualPower"
            />
          </ScatterChart>
        </ResponsiveContainer>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg" data-testid="container-hull-analysis">
          <h4 className="font-medium text-sm mb-2">Hull Efficiency Analysis</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Average Deviation:</p>
              <p
                className={`font-mono font-medium ${avgDeviation > 20 ? "text-destructive" : avgDeviation > 10 ? "text-warning" : "text-success"}`}
                data-testid="text-avg-deviation"
              >
                {avgDeviation > 0 ? "+" : ""}
                {avgDeviation.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status:</p>
              <Badge
                variant={
                  avgDeviation > 20 ? "destructive" : avgDeviation > 10 ? "default" : "secondary"
                }
                data-testid="badge-hull-status"
              >
                {avgDeviation > 20
                  ? "Hull Fouling Likely"
                  : avgDeviation > 10
                    ? "Efficiency Reduced"
                    : "Normal Performance"}
              </Badge>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            <p data-testid="text-hull-recommendation">
              {avgDeviation > 20 &&
                "🚨 Significant power increase detected - hull cleaning recommended"}
              {avgDeviation > 10 &&
                avgDeviation <= 20 &&
                "⚠️ Moderate efficiency loss - monitor hull condition"}
              {avgDeviation <= 10 && "✅ Hull performance within normal range"}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          <p>
            Period: {new Date(data.metadata.period.start).toLocaleDateString()} -{" "}
            {new Date(data.metadata.period.end).toLocaleDateString()}
          </p>
          <p className="mt-1">
            Vessel: <span className="font-medium text-foreground">{data.metadata.vesselName}</span>
            {data.metadata.estimatedSTW && (
              <span className="ml-2 text-orange-600">
                (Speed estimated from RPM - install GPS/speed sensor for accuracy)
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
