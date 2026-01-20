import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from "recharts";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, TrendingUp } from "lucide-react";

interface AccuracyDataPoint {
  date: string | Date;
  accuracy: number;
  modelName?: string;
}

interface AccuracyTrendChartProps {
  data: AccuracyDataPoint[];
  timeRange: '7d' | '30d' | '90d';
  onTimeRangeChange: (range: '7d' | '30d' | '90d') => void;
  loading?: boolean;
  title?: string;
  height?: number;
  className?: string;
  'data-testid'?: string;
}

type ChartType = 'line' | 'bar';

const timeRangeLabels = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
};

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {return null;}

  const data = payload[0];
  const originalDate = data.payload.originalDate;
  const accuracy = data.value;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium mb-1">
        {originalDate ? format(new Date(originalDate), 'MMM dd, yyyy') : data.payload.date}
      </p>
      <p className="text-sm text-muted-foreground">
        Accuracy: <span className="font-semibold text-foreground">{accuracy?.toFixed(1)}%</span>
      </p>
      {data.payload.modelName && (
        <p className="text-xs text-muted-foreground mt-1">
          {data.payload.modelName}
        </p>
      )}
    </div>
  );
}

export function AccuracyTrendChart({
  data,
  timeRange,
  onTimeRangeChange,
  loading = false,
  title = "Model Accuracy Trend",
  height = 300,
  className,
  'data-testid': testId,
}: AccuracyTrendChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line');

  // Format data for charts
  const formattedData = data.map(item => ({
    ...item,
    originalDate: item.date,
    date: typeof item.date === 'string' ? item.date : format(new Date(item.date), 'MMM dd'),
    accuracy: Number(item.accuracy),
  }));

  if (loading) {
    return (
      <Card className={className} data-testid={testId}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className={`h-[${height}px] w-full`} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid={testId}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base md:text-lg">{title}</CardTitle>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Chart Type Toggle */}
            <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <TabsList className="h-8">
                <TabsTrigger 
                  value="line" 
                  className="text-xs px-2"
                  data-testid={`${testId}-chart-type-line`}
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Line
                </TabsTrigger>
                <TabsTrigger 
                  value="bar" 
                  className="text-xs px-2"
                  data-testid={`${testId}-chart-type-bar`}
                >
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Bar
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Time Range Selector */}
            <Tabs value={timeRange} onValueChange={(v) => onTimeRangeChange(v as "7d" | "30d" | "90d")}>
              <TabsList className="h-8">
                <TabsTrigger 
                  value="7d" 
                  className="text-xs px-2"
                  data-testid={`${testId}-range-7d`}
                >
                  {timeRangeLabels['7d']}
                </TabsTrigger>
                <TabsTrigger 
                  value="30d" 
                  className="text-xs px-2"
                  data-testid={`${testId}-range-30d`}
                >
                  {timeRangeLabels['30d']}
                </TabsTrigger>
                <TabsTrigger 
                  value="90d" 
                  className="text-xs px-2"
                  data-testid={`${testId}-range-90d`}
                >
                  {timeRangeLabels['90d']}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {formattedData.length === 0 ? (
          <div 
            className={cn("flex items-center justify-center text-muted-foreground", `h-[${height}px]`)}
            data-testid={`${testId}-empty`}
          >
            No data available for selected time range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {chartType === 'line' ? (
              <LineChart data={formattedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Accuracy"
                />
              </LineChart>
            ) : (
              <BarChart data={formattedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="accuracy"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  name="Accuracy"
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
