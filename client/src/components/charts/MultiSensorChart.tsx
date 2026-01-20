import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartWrapper } from "./ChartWrapper";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface SensorDataPoint {
  timestamp: Date | string;
  value: number;
}

interface SensorData {
  sensorType: string;
  unit: string;
  color: string;
  data: SensorDataPoint[];
}

interface MultiSensorChartProps {
  sensors: SensorData[];
  title: string;
  description?: string;
  timeRange?: "1h" | "6h" | "24h" | "7d";
  onTimeRangeChange?: (range: "1h" | "6h" | "24h" | "7d") => void;
  isLoading?: boolean;
  error?: string | null;
  "data-testid"?: string;
}

const CHART_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(142, 70%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 70%, 50%)",
  "hsl(180, 70%, 45%)",
];

function mergeTimeSeriesData(sensors: SensorData[]): Record<string, number>[] {
  const merged: Record<number, Record<string, number>> = {};

  sensors.forEach((sensor) => {
    sensor.data.forEach((point) => {
      const ts =
        typeof point.timestamp === "string"
          ? new Date(point.timestamp).getTime()
          : point.timestamp.getTime();

      if (!merged[ts]) {
        merged[ts] = { timestamp: ts };
      }
      merged[ts][sensor.sensorType] = point.value;
    });
  });

  return Object.values(merged).sort((a, b) => a.timestamp - b.timestamp);
}

function getUniqueUnits(sensors: SensorData[]): string[] {
  const units = new Set<string>();
  sensors.forEach((s) => units.add(s.unit));
  return Array.from(units);
}

export function MultiSensorChart({
  sensors,
  title,
  description,
  timeRange = "24h",
  onTimeRangeChange,
  isLoading = false,
  error = null,
  "data-testid": testId = "chart-multi-sensor",
}: MultiSensorChartProps) {
  const [visibleSensors, setVisibleSensors] = useState<Set<string>>(
    new Set(sensors.map((s) => s.sensorType))
  );

  const toggleSensor = (sensorType: string) => {
    const newVisible = new Set(visibleSensors);
    if (newVisible.has(sensorType)) {
      if (newVisible.size > 1) {
        newVisible.delete(sensorType);
      }
    } else {
      newVisible.add(sensorType);
    }
    setVisibleSensors(newVisible);
  };

  const toggleAll = () => {
    if (visibleSensors.size === sensors.length) {
      setVisibleSensors(new Set([sensors[0]?.sensorType].filter(Boolean)));
    } else {
      setVisibleSensors(new Set(sensors.map((s) => s.sensorType)));
    }
  };

  const visibleSensorData = useMemo(
    () => sensors.filter((s) => visibleSensors.has(s.sensorType)),
    [sensors, visibleSensors]
  );

  const chartData = useMemo(
    () => mergeTimeSeriesData(visibleSensorData),
    [visibleSensorData]
  );

  const uniqueUnits = useMemo(
    () => getUniqueUnits(visibleSensorData),
    [visibleSensorData]
  );

  const isEmpty = !sensors.length || !chartData.length;

  interface TooltipPayloadEntry { dataKey: string; color: string; value: number | null; payload: { timestamp: string }; }
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) => {
    if (!active || !payload?.length) {return null;}

    const timestamp = payload[0]?.payload?.timestamp;

    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg max-w-xs">
        <p className="font-medium text-sm mb-2 border-b pb-2">
          {format(new Date(timestamp), "MMM dd, HH:mm:ss")}
        </p>
        <div className="space-y-1">
          {payload.map((entry) => {
            const sensor = sensors.find(
              (s) => s.sensorType === entry.dataKey
            );
            return (
              <div
                key={entry.dataKey}
                className="flex items-center justify-between gap-4"
              >
                <span
                  className="text-sm flex items-center gap-2"
                  style={{ color: entry.color }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.dataKey}
                </span>
                <span className="text-sm font-medium">
                  {entry.value?.toFixed(2)} {sensor?.unit || ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const timeRangeActions = onTimeRangeChange && (
    <Select value={timeRange} onValueChange={onTimeRangeChange}>
      <SelectTrigger className="w-24" data-testid="select-time-range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1h">1 Hour</SelectItem>
        <SelectItem value="6h">6 Hours</SelectItem>
        <SelectItem value="24h">24 Hours</SelectItem>
        <SelectItem value="7d">7 Days</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <ChartWrapper
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="No sensor data available for the selected time range"
      actions={timeRangeActions}
      data-testid={testId}
    >
      <div className="flex flex-col h-full">
        <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
            data-testid="btn-toggle-all"
          >
            {visibleSensors.size === sensors.length ? "Hide All" : "Show All"}
          </Button>

          <div className="flex flex-wrap gap-4">
            {sensors.map((sensor, idx) => (
              <div
                key={sensor.sensorType}
                className="flex items-center gap-2"
              >
                <Checkbox
                  id={`sensor-${sensor.sensorType}`}
                  checked={visibleSensors.has(sensor.sensorType)}
                  onCheckedChange={() => toggleSensor(sensor.sensorType)}
                  data-testid={`checkbox-${sensor.sensorType}`}
                />
                <Label
                  htmlFor={`sensor-${sensor.sensorType}`}
                  className="cursor-pointer flex items-center gap-1.5 text-sm"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        sensor.color || CHART_COLORS[idx % CHART_COLORS.length],
                    }}
                  />
                  <span style={{ color: sensor.color || CHART_COLORS[idx % CHART_COLORS.length] }}>
                    {sensor.sensorType}
                  </span>
                  <span className="text-muted-foreground">({sensor.unit})</span>
                </Label>
              </div>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 60, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => format(new Date(ts), "HH:mm")}
              className="text-xs"
              tick={{ fill: "hsl(var(--foreground))" }}
            />

            {uniqueUnits[0] && (
              <YAxis
                yAxisId="left"
                className="text-xs"
                tick={{ fill: "hsl(var(--foreground))" }}
                label={{
                  value: uniqueUnits[0],
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "hsl(var(--foreground))" },
                }}
              />
            )}

            {uniqueUnits[1] && uniqueUnits[1] !== uniqueUnits[0] && (
              <YAxis
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: "hsl(var(--foreground))" }}
                label={{
                  value: uniqueUnits[1],
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "hsl(var(--foreground))" },
                }}
              />
            )}

            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {visibleSensorData.map((sensor, index) => {
              const sensorUnit = sensor.unit;
              const yAxisId =
                sensorUnit === uniqueUnits[0]
                  ? "left"
                  : uniqueUnits[1] && sensorUnit === uniqueUnits[1]
                    ? "right"
                    : "left";

              return (
                <Line
                  key={sensor.sensorType}
                  type="monotone"
                  dataKey={sensor.sensorType}
                  name={`${sensor.sensorType} (${sensor.unit})`}
                  stroke={
                    sensor.color || CHART_COLORS[index % CHART_COLORS.length]
                  }
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  yAxisId={yAxisId}
                  data-testid={`line-${sensor.sensorType}`}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
}
