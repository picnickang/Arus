import { useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import type { HourlyConsumption } from "./_shared";

export function ConsumptionTrendChart({
  consumption,
  loading,
}: {
  consumption: HourlyConsumption[];
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    if (!consumption || consumption.length === 0) {
      return [];
    }
    return consumption.map((c) => ({
      hour: c.hour ? format(new Date(c.hour), "HH:mm") : "",
      total: c.avg_flow_kg_per_h ? parseFloat(c.avg_flow_kg_per_h) : 0,
      me: c.main_engine_flow ? parseFloat(c.main_engine_flow) : 0,
      gen: c.generator_flow ? parseFloat(c.generator_flow) : 0,
      boiler: c.boiler_flow ? parseFloat(c.boiler_flow) : 0,
    }));
  }, [consumption]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Consumption Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Consumption Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-6 text-muted-foreground">No trend data available</p>
        </CardContent>
      </Card>
    );
  }

  const maxVal = Math.max(...chartData.map((d) => d.total), 1);
  const chartW = 700;
  const chartH = 200;
  const padL = 50;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const stepX = plotW / Math.max(chartData.length - 1, 1);
  const scaleY = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const linePath = (key: "total" | "me" | "gen" | "boiler") =>
    chartData
      .map((d, i) => `${i === 0 ? "M" : "L"}${padL + i * stepX},${scaleY(d[key])}`)
      .join(" ");

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
  const xLabelInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <Card data-testid="card-consumption-trend">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Consumption Trend
        </CardTitle>
        <CardDescription>Hourly fuel flow trend (kg/h)</CardDescription>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={chartW - padR}
                y1={scaleY(tick)}
                y2={scaleY(tick)}
                stroke="currentColor"
                strokeOpacity={0.1}
              />
              <text
                x={padL - 5}
                y={scaleY(tick) + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {tick.toFixed(0)}
              </text>
            </g>
          ))}
          {chartData.map((d, i) =>
            i % xLabelInterval === 0 ? (
              <text
                key={i}
                x={padL + i * stepX}
                y={chartH - 5}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={8}
              >
                {d.hour}
              </text>
            ) : null
          )}
          <path d={linePath("total")} fill="none" stroke="#3b82f6" strokeWidth={2} />
          <path
            d={linePath("me")}
            fill="none"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          <path
            d={linePath("gen")}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          <path
            d={linePath("boiler")}
            fill="none"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        </svg>
        <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-blue-500" /> Total
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 bg-green-500"
              style={{ borderTop: "1px dashed" }}
            />{" "}
            ME
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 bg-amber-500"
              style={{ borderTop: "1px dashed" }}
            />{" "}
            Gen
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 bg-red-500"
              style={{ borderTop: "1px dashed" }}
            />{" "}
            Boiler
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
