import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Activity, Loader2 } from "lucide-react";

interface LoadDistributionChartProps {
  equipmentId: string;
  startDate: string;
  endDate: string;
}

interface LoadBin {
  range: string;
  count: number;
  percentage: number;
  [key: string]: any;
}

interface LoadDistributionResponse {
  bins: LoadBin[];
  metadata: {
    equipmentId: string;
    equipmentName: string;
    equipmentType: string;
    sampleCount: number;
    period: { start: string; end: string };
    timezone: string;
  };
}

export function LoadDistributionChart({ equipmentId, startDate, endDate }: LoadDistributionChartProps) {
  const { data, isLoading, error } = useQuery<LoadDistributionResponse>({
    queryKey: [`/api/equipment/${equipmentId}/load-distribution`, { startDate, endDate }],
    enabled: !!equipmentId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });

  const bins = Array.isArray(data?.bins) ? data.bins : [];

  return (
    <Card data-testid="load-distribution-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Load Distribution
          {data?.metadata?.sampleCount != null && (
            <span className="text-xs font-normal text-muted-foreground">
              ({data.metadata.sampleCount} samples)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            Unable to load distribution data
          </div>
        ) : bins.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            No load data available for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bins}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number) => [`${value}%`, "Load"]}
              />
              <Bar dataKey="percentage" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
