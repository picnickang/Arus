import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  type TooltipProps,
} from "recharts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SensorBaselineBands } from "../../hooks/useSensorBaselines";

export interface MultiSensorSeries {
  sensorType: string;
  unit: string;
  color: string;
  data: { timestamp: Date; value: number }[];
}

interface MultiSensorChartProps {
  sensorData: MultiSensorSeries[];
  baselines?: SensorBaselineBands | undefined;
  isLoading?: boolean | undefined;
}

/** "oil_quality" -> "Oil Quality" */
function formatSensorLabel(sensorType: string): string {
  return sensorType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SensorTooltip({ active, payload, unit }: TooltipProps<number, string> & { unit: string }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0];
  if (!point) {
    return null;
  }
  const ts = Number(point.payload.t);
  return (
    <div className="rounded-lg border bg-popover p-2 text-xs shadow-lg">
      <p className="font-medium">{format(new Date(ts), "MMM dd HH:mm")}</p>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground">{Number(point.value).toFixed(2)}</span>{" "}
        {unit}
      </p>
    </div>
  );
}

function SensorChartCard({
  sensor,
  baseline,
}: {
  sensor: MultiSensorSeries;
  baseline?: { p50: number; bandLow: number; bandHigh: number } | undefined;
}) {
  const chartData = useMemo(
    () =>
      sensor.data
        .map((point) => ({ t: point.timestamp.getTime(), value: point.value }))
        .sort((a, b) => a.t - b.t),
    [sensor.data]
  );
  const latest = chartData.length ? chartData[chartData.length - 1]?.value : undefined;

  return (
    <Card data-testid={`sensor-chart-${sensor.sensorType}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: sensor.color }}
            aria-hidden="true"
          />
          <span className="text-sm font-semibold">{formatSensorLabel(sensor.sensorType)}</span>
        </div>
        {latest !== undefined && (
          <span
            className="text-sm font-bold tabular-nums"
            data-testid={`sensor-latest-${sensor.sensorType}`}
          >
            {latest.toFixed(2)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{sensor.unit}</span>
          </span>
        )}
      </CardHeader>
      <CardContent className="pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10 }}
              tickFormatter={(t) => format(new Date(t), "HH:mm")}
              className="text-muted-foreground"
            />
            <YAxis tick={{ fontSize: 10 }} width={36} domain={["auto", "auto"]} />
            <Tooltip content={<SensorTooltip unit={sensor.unit} />} />
            {/* Expected operating envelope (median ± 2σ) behind the live series. */}
            {baseline && (
              <ReferenceArea
                y1={baseline.bandLow}
                y2={baseline.bandHigh}
                fill={sensor.color}
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            )}
            {baseline && (
              <ReferenceLine
                y={baseline.p50}
                stroke={sensor.color}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={sensor.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name={sensor.sensorType}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Small-multiples telemetry chart for the PdM Overview tab: one mini line
 * chart per sensor (sensors carry different units, so a shared Y-axis would
 * squash the smaller-scale series). Each chart draws the sensor's expected
 * operating envelope (from useSensorBaselines) as a faint band behind the
 * live series.
 */
export function MultiSensorChart({ sensorData, baselines, isLoading }: MultiSensorChartProps) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
        data-testid="multi-sensor-chart-loading"
      >
        {["skeleton-a", "skeleton-b"].map((id) => (
          <Skeleton key={id} className="h-[220px] w-full" />
        ))}
      </div>
    );
  }

  if (!sensorData.length) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
        data-testid="telemetry-empty"
      >
        No telemetry recorded in this time window.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="multi-sensor-chart">
      {sensorData.map((sensor) => (
        <SensorChartCard
          key={sensor.sensorType}
          sensor={sensor}
          baseline={baselines?.[sensor.sensorType]}
        />
      ))}
    </div>
  );
}
