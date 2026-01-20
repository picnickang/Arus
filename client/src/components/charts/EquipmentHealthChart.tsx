import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { ChartWrapper } from "./ChartWrapper";
import type { EquipmentHealthDTO } from "@shared/analytics-types";

interface EquipmentHealthChartProps {
  equipment: EquipmentHealthDTO[];
  isLoading?: boolean;
  error?: string | null;
  "data-testid"?: string;
}

const CONDITION_COLORS = {
  excellent: "hsl(142, 71%, 45%)",
  good: "hsl(var(--chart-2))",
  fair: "hsl(var(--warning))",
  poor: "hsl(var(--chart-4))",
  critical: "hsl(var(--destructive))",
};

const CONDITION_ORDER = ["excellent", "good", "fair", "poor", "critical"] as const;

export function EquipmentHealthChart({
  equipment,
  isLoading = false,
  error = null,
  "data-testid": testId = "chart-equipment-health",
}: EquipmentHealthChartProps) {
  // Group equipment by condition
  const chartData = equipment.length
    ? CONDITION_ORDER.map((condition) => {
        const count = equipment.filter((e) => e.condition === condition).length;
        return {
          condition: condition.charAt(0).toUpperCase() + condition.slice(1),
          count,
          fill: CONDITION_COLORS[condition],
        };
      }).filter((d) => d.count > 0)
    : [];

  const isEmpty = !chartData.length;

  interface TooltipEntry { payload: { condition: string; count: number }; }
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) => {
    if (active && payload?.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.condition}</p>
          <p className="text-sm text-muted-foreground">
            {data.count} equipment {data.count === 1 ? "unit" : "units"}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartWrapper
      title="Fleet Health Distribution"
      description="Equipment count by health condition"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="No equipment data available"
      data-testid={testId}
    >
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="condition" className="text-xs" tick={{ fill: "hsl(var(--foreground))" }} />
        <YAxis
          className="text-xs"
          tick={{ fill: "hsl(var(--foreground))" }}
          label={{ value: "Equipment Count", angle: -90, position: "insideLeft" }}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="count" name="Equipment Units" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartWrapper>
  );
}
