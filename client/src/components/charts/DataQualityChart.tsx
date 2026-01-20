import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { ChartWrapper } from "./ChartWrapper";
import type { ReconciliationReport } from "@shared/analytics-types";

interface DataQualityChartProps {
  report: ReconciliationReport | null;
  isLoading?: boolean;
  error?: string | null;
  "data-testid"?: string;
}

const SEVERITY_COLORS = {
  critical: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  info: "hsl(var(--primary))",
};

export function DataQualityChart({
  report,
  isLoading = false,
  error = null,
  "data-testid": testId = "chart-data-quality",
}: DataQualityChartProps) {
  // Transform issues into chart data grouped by severity
  const chartData = report?.issues.length
    ? Object.entries(
        report.issues.reduce(
          (acc, issue) => {
            const key = issue.severity;
            acc[key] = (acc[key] || 0) + (issue.affectedRecords || 1);
            return acc;
          },
          {} as Record<string, number>
        )
      ).map(([severity, count]) => ({
        severity: severity.charAt(0).toUpperCase() + severity.slice(1),
        count,
        fill: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.info,
      }))
    : [];

  const isEmpty = !chartData.length;

  return (
    <ChartWrapper
      title="Data Quality Issues by Severity"
      description="Distribution of validation issues across severity levels"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="No data quality issues detected"
      data-testid={testId}
    >
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="severity" className="text-xs" tick={{ fill: "hsl(var(--foreground))" }} />
        <YAxis
          className="text-xs"
          tick={{ fill: "hsl(var(--foreground))" }}
          label={{ value: "Affected Records", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
        />
        <Legend />
        <Bar dataKey="count" name="Affected Records" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartWrapper>
  );
}
