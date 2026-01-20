import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { ChartWrapper } from "./ChartWrapper";
import type { ReconciliationReport } from "@shared/analytics-types";

interface IssueTypeChartProps {
  report: ReconciliationReport | null;
  isLoading?: boolean;
  error?: string | null;
  "data-testid"?: string;
}

const ISSUE_TYPE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
  "hsl(280, 70%, 50%)",
  "hsl(40, 70%, 50%)",
];

export function IssueTypeChart({
  report,
  isLoading = false,
  error = null,
  "data-testid": testId = "chart-issue-type",
}: IssueTypeChartProps) {
  // Transform issues into chart data grouped by type
  const chartData = report?.issues.length
    ? Object.entries(
        report.issues.reduce(
          (acc, issue) => {
            const key = issue.issueType || "unknown";
            acc[key] = (acc[key] || 0) + (issue.affectedRecords || 1);
            return acc;
          },
          {} as Record<string, number>
        )
      ).map(([type, count]) => ({
        name: type
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        value: count,
      }))
    : [];

  const isEmpty = !chartData.length;

  const renderLabel = (entry: { name: string; value: number; percent: number }) => {
    return `${entry.name}: ${entry.value} (${(entry.percent * 100).toFixed(0)}%)`;
  };

  return (
    <ChartWrapper
      title="Issues by Type"
      description="Breakdown of validation issues by category"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="No issues to display"
      data-testid={testId}
    >
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={ISSUE_TYPE_COLORS[index % ISSUE_TYPE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        <Legend />
      </PieChart>
    </ChartWrapper>
  );
}
