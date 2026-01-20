import { Scatter } from "recharts";

export interface AnomalyPoint {
  x: number;
  y: number;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  alertId?: string;
}

interface AnomalyMarkersProps {
  anomalies: AnomalyPoint[];
  onAnomalyClick?: (anomaly: AnomalyPoint) => void;
}

/**
 * Reusable anomaly marker overlay component for charts
 * Renders clickable anomaly markers on performance charts
 */
export function AnomalyMarkers({ anomalies, onAnomalyClick }: AnomalyMarkersProps) {
  if (!anomalies || anomalies.length === 0) {return null;}

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444"; // red-500
      case "high":
        return "#f97316"; // orange-500
      case "medium":
        return "#eab308"; // yellow-500
      case "low":
        return "#3b82f6"; // blue-500
      default:
        return "#6b7280"; // gray-500
    }
  };

  // Custom dot component for anomalies
  const CustomDot = (props: { cx?: number; cy?: number; payload?: AnomalyPoint }) => {
    const { cx, cy, payload } = props;
    if (!payload) {return null;}

    return (
      <g
        onClick={() => onAnomalyClick?.(payload)}
        style={{ cursor: onAnomalyClick ? "pointer" : "default" }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={getSeverityColor(payload.severity)}
          stroke="#fff"
          strokeWidth={2}
          opacity={0.9}
        />
        <circle cx={cx} cy={cy} r={10} fill={getSeverityColor(payload.severity)} opacity={0.2} />
      </g>
    );
  };

  return (
    <Scatter
      data={anomalies}
      fill="#ef4444"
      shape={<CustomDot />}
      name="Anomalies"
      isAnimationActive={false}
    />
  );
}
