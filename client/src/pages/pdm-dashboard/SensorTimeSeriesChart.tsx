import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { TelemetryTrend } from "@/features/pdm";

export function SensorTimeSeriesChart({
  trends,
  isLoading,
}: {
  trends?: TelemetryTrend[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No sensor trend data available
      </div>
    );
  }

  const vibrationTrends = trends
    .filter(
      (t) =>
        t.sensorType.toLowerCase().includes("vibration") ||
        t.sensorType.toLowerCase().includes("rms") ||
        t.sensorType.toLowerCase().includes("temp")
    )
    .slice(0, 6);

  const chartData = vibrationTrends.map((t) => ({
    sensor: t.sensorType.length > 15 ? `${t.sensorType.slice(0, 15)}...` : t.sensorType,
    value: Math.round(t.avgValue * 100) / 100,
    min: Math.round(t.minValue * 100) / 100,
    max: Math.round(t.maxValue * 100) / 100,
    dataPoints: t.dataPoints,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No vibration/temperature data
      </div>
    );
  }

  const hasVibration = trends.some(
    (t) =>
      t.sensorType.toLowerCase().includes("vibration") || t.sensorType.toLowerCase().includes("rms")
  );
  const hasTemp = trends.some((t) => t.sensorType.toLowerCase().includes("temp"));

  const vibrationCritical = hasVibration ? 2.5 : null;
  const vibrationWarning = hasVibration ? 2.0 : null;
  const tempCritical = hasTemp ? 85 : null;
  const tempWarning = hasTemp ? 75 : null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sensorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="sensor"
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <Tooltip
          formatter={(value: number, name: string) => [
            value.toFixed(2),
            name === "value" ? "Average" : name,
          ]}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        {vibrationCritical !== null && (
          <ReferenceLine
            y={vibrationCritical}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{ value: "Vib Critical", position: "right", fontSize: 9, fill: "#ef4444" }}
          />
        )}
        {vibrationWarning !== null && (
          <ReferenceLine
            y={vibrationWarning}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            label={{ value: "Vib Warning", position: "right", fontSize: 9, fill: "#f59e0b" }}
          />
        )}
        {tempCritical !== null && (
          <ReferenceLine
            y={tempCritical}
            stroke="#dc2626"
            strokeDasharray="5 5"
            label={{ value: "Temp Critical", position: "right", fontSize: 9, fill: "#dc2626" }}
          />
        )}
        {tempWarning !== null && (
          <ReferenceLine
            y={tempWarning}
            stroke="#ea580c"
            strokeDasharray="3 3"
            label={{ value: "Temp Warning", position: "right", fontSize: 9, fill: "#ea580c" }}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(210, 70%, 50%)"
          fill="url(#sensorGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
