import { Line } from "recharts";

export interface BenchmarkData {
  x: number;
  fleetAvg?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  baseline?: number;
}

interface BenchmarkLayerProps {
  data: BenchmarkData[];
  showBaseline?: boolean;
  showFleetAverage?: boolean;
  showPercentiles?: boolean;
  xKey?: string;
}

/**
 * Reusable benchmark overlay component for charts
 * Renders baseline, fleet average, and percentile lines
 */
export function BenchmarkLayer({
  data,
  showBaseline = false,
  showFleetAverage = false,
  showPercentiles = false,
  xKey: _xKey = "x",
}: BenchmarkLayerProps) {
  if (!data || data.length === 0) {return null;}

  return (
    <>
      {showBaseline && (
        <Line
          type="monotone"
          dataKey="baseline"
          stroke="#9333ea"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="Theoretical Baseline"
          isAnimationActive={false}
        />
      )}

      {showFleetAverage && (
        <Line
          type="monotone"
          dataKey="fleetAvg"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="8 4"
          dot={false}
          name="Fleet Average"
          isAnimationActive={false}
        />
      )}

      {showPercentiles && (
        <>
          <Line
            type="monotone"
            dataKey="p25"
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            name="25th Percentile"
            opacity={0.6}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
            name="50th Percentile (Median)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p75"
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            name="75th Percentile"
            opacity={0.6}
            isAnimationActive={false}
          />
        </>
      )}
    </>
  );
}
