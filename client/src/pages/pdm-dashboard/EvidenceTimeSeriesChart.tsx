import { Skeleton } from "@/components/ui/skeleton";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PdmTelemetryReading as TelemetryReading } from "@/features/pdm";

export function EvidenceTimeSeriesChart({
  readings,
  isLoading,
  failureMode,
}: {
  readings?: TelemetryReading[];
  isLoading: boolean;
  failureMode: string;
}) {
  if (isLoading) {
    return <Skeleton className="h-[180px] w-full" />;
  }

  if (!readings || readings.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm border rounded-lg bg-muted/30">
        No telemetry data available for this asset
      </div>
    );
  }

  const isVibration =
    failureMode.toLowerCase().includes("vibration") ||
    failureMode.toLowerCase().includes("bearing");
  const isTemperature =
    failureMode.toLowerCase().includes("temperature") ||
    failureMode.toLowerCase().includes("overheating");

  const threshold = isVibration ? 2.5 : isTemperature ? 85 : null;
  const warningThreshold = isVibration ? 2.0 : isTemperature ? 75 : null;

  const chartData = readings
    .slice(0, 50)
    .map((r) => ({
      time: new Date(r.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      value: Math.round(r.value * 100) / 100,
      sensor: r.sensorType,
    }))
    .reverse();

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Sensor: {readings[0]?.sensorType || "Unknown"} | Last {readings.length} readings
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9 }}
            className="text-muted-foreground"
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" width={40} />
          <Tooltip
            formatter={(value: number) => [value.toFixed(2), "Value"]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          {threshold && (
            <ReferenceLine
              y={threshold}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: "Critical", position: "right", fontSize: 10, fill: "#ef4444" }}
            />
          )}
          {warningThreshold && (
            <ReferenceLine
              y={warningThreshold}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: "Warning", position: "right", fontSize: 10, fill: "#f59e0b" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(210, 70%, 50%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
