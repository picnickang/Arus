/**
 * SensorSparklineChart Component
 * 
 * Mini sparkline graph for sensor telemetry with anomaly markers.
 * Displays current value, status, and optional z-score for anomalies.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, LineChart, Line, ReferenceDot, YAxis } from "recharts";
import { AlertTriangle, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface SensorSparklineChartProps {
  sensorType: string;
  equipmentId: string;
  currentValue: number;
  unit: string;
  status: "normal" | "warning" | "critical";
  hasAnomaly: boolean;
  anomalyZScore?: number;
  anomalyTimestamp?: string;
  data: Array<{ timestamp: string; value: number }>;
  lastUpdate: string;
  onAcknowledge?: () => void;
  onViewDetails?: () => void;
}

export function SensorSparklineChart({
  sensorType,
  equipmentId,
  currentValue,
  unit,
  status,
  hasAnomaly,
  anomalyZScore,
  anomalyTimestamp,
  data,
  lastUpdate,
  onAcknowledge,
  onViewDetails,
}: SensorSparklineChartProps) {
  const getStatusColor = () => {
    if (hasAnomaly) {return "border-destructive";}
    if (status === "critical") {return "border-destructive";}
    if (status === "warning") {return "border-amber-500";}
    return "border-border";
  };

  const getStatusDotColor = () => {
    if (hasAnomaly || status === "critical") {return "bg-destructive";}
    if (status === "warning") {return "bg-amber-500";}
    return "bg-green-500";
  };

  const chartData = data.map((d, idx) => ({
    idx,
    value: d.value,
    timestamp: d.timestamp,
  }));

  const anomalyPoint = anomalyTimestamp
    ? chartData.find((d) => d.timestamp === anomalyTimestamp)
    : null;

  return (
    <Card 
      className={`${getStatusColor()} ${hasAnomaly ? "border-2" : ""}`}
      data-testid={`card-sensor-${sensorType}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${getStatusDotColor()}`} />
            <span className="text-sm font-medium truncate" data-testid={`text-sensor-${sensorType}`}>
              {sensorType}
            </span>
          </div>
          {hasAnomaly && (
            <Badge variant="destructive" className="text-xs flex-shrink-0">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {anomalyZScore ? `${anomalyZScore.toFixed(1)}σ` : "Anomaly"}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground truncate mb-2">{equipmentId}</p>

        <div className="h-16 mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis hide domain={["auto", "auto"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={hasAnomaly ? "#ef4444" : "#3b82f6"}
                strokeWidth={1.5}
                dot={false}
              />
              {anomalyPoint && (
                <ReferenceDot
                  x={anomalyPoint.idx}
                  y={anomalyPoint.value}
                  r={4}
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold" data-testid={`text-value-${sensorType}`}>
              {typeof currentValue === "number" ? currentValue.toFixed(1) : currentValue}
            </span>
            <span className="text-sm text-muted-foreground ml-1">{unit}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })}
          </span>
        </div>

        {hasAnomaly && (
          <div className="flex gap-2 mt-2">
            {onAcknowledge && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAcknowledge}
                className="flex-1"
                data-testid={`button-acknowledge-${sensorType}`}
              >
                <Check className="h-3 w-3 mr-1" />
                Ack
              </Button>
            )}
            {onViewDetails && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onViewDetails}
                className="flex-1"
                data-testid={`button-view-${sensorType}`}
              >
                Details
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
