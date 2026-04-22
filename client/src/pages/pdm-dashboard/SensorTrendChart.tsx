import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TelemetryTrend } from "@/features/pdm";

export function SensorTrendChart({
  trends,
  isLoading,
  sensorFilter,
}: {
  trends?: TelemetryTrend[];
  isLoading: boolean;
  sensorFilter?: string;
}) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No sensor data available
      </div>
    );
  }

  const filteredTrends =
    sensorFilter && trends
      ? trends.filter((t) => t.sensorType.toLowerCase().includes(sensorFilter.toLowerCase()))
      : trends;

  const chartData = filteredTrends.slice(0, 10).map((t) => ({
    name: t.sensorType.length > 12 ? `${t.sensorType.slice(0, 12)}...` : t.sensorType,
    fullName: t.sensorType,
    avg: Math.round(t.avgValue * 10) / 10,
    min: Math.round(t.minValue * 10) / 10,
    max: Math.round(t.maxValue * 10) / 10,
    points: t.dataPoints,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No matching sensor data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 80, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
          width={70}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            value.toFixed(1),
            name === "avg" ? "Average" : name === "max" ? "Maximum" : "Minimum",
          ]}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        <Bar dataKey="min" fill="hsl(210, 70%, 60%)" name="Min" stackId="range" />
        <Bar dataKey="avg" fill="hsl(142, 70%, 45%)" name="Avg" />
        <Bar dataKey="max" fill="hsl(25, 95%, 53%)" name="Max" />
      </BarChart>
    </ResponsiveContainer>
  );
}
