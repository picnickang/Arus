import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChartToggles } from "@/hooks/use-chart-toggles";
import { useUnitPreferences } from "@/hooks/use-unit-preferences";
import { convertPower, convertSpeed } from "@/lib/unit-conversions";

interface PowerSTWPoint {
  x: number;
  y: number;
}

interface PowerSTWMetadata {
  vesselId: string;
  vesselName: string;
  sampleCount: number;
  period: { start: string; end: string };
  timezone: string;
  hasSTWData: boolean;
  estimatedSTW: boolean;
}

interface PowerSTWResponse {
  actual: PowerSTWPoint[];
  baseline: PowerSTWPoint[];
  metadata: PowerSTWMetadata;
}

interface FleetBenchmark {
  speed: number;
  fleetAvgPower: number;
  p25: number;
  p50: number;
  p75: number;
}

interface FleetBenchmarksResponse {
  powerSTW?: FleetBenchmark[];
}

export interface EnrichedDataPoint {
  speed: number;
  actualPower?: number;
  baselinePower?: number;
  fleetAvg?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  baseline?: number;
}

export interface UsePowerSTWDataProps {
  vesselId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface UsePowerSTWDataReturn {
  data: PowerSTWResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  enrichedData: EnrichedDataPoint[];
  avgDeviation: number;
  speedUnit: string;
  powerUnit: string;
  toggles: ReturnType<typeof useChartToggles>["toggles"];
  setToggle: ReturnType<typeof useChartToggles>["setToggle"];
  showControls: boolean;
  setShowControls: (show: boolean) => void;
}

export function usePowerSTWData({
  vesselId,
  startDate,
  endDate,
}: UsePowerSTWDataProps): UsePowerSTWDataReturn {
  const startDateStr = startDate?.toISOString();
  const endDateStr = endDate?.toISOString();
  const { toggles, setToggle } = useChartToggles("power-stw");
  const { preferences } = useUnitPreferences();
  const [showControls, setShowControls] = useState(false);

  const { data, isLoading, error, isError } = useQuery<PowerSTWResponse>({
    queryKey: [
      "/api/vessels",
      vesselId,
      "power-stw-analysis",
      { start: startDateStr, end: endDateStr },
    ],
    enabled: !!vesselId,
    refetchInterval: 300000,
    staleTime: 120000,
  });

  const { data: fleetBenchmarks } = useQuery<FleetBenchmarksResponse>({
    queryKey: ["/api/fleet/benchmarks", { start: startDateStr, end: endDateStr }],
    enabled:
      (toggles.showFleetAverage || toggles.showPercentiles) && !!startDateStr && !!endDateStr,
    refetchInterval: 300000,
    staleTime: 120000,
  });

  const speedUnit = preferences.speed;
  const powerUnit = preferences.power;

  const { enrichedData, avgDeviation } = useMemo(() => {
    if (!data || data.actual.length === 0) {
      return { enrichedData: [], avgDeviation: 0 };
    }

    let deviation = 0;
    if (data.baseline.length > 0 && data.actual.length > 0) {
      const deviations: number[] = [];
      for (const actualPoint of data.actual) {
        const nearestBaseline = data.baseline.reduce(
          (prev, curr) =>
            Math.abs(curr.x - actualPoint.x) < Math.abs(prev.x - actualPoint.x) ? curr : prev,
          data.baseline[0]
        );
        if (nearestBaseline.y > 0) {
          const dev = ((actualPoint.y - nearestBaseline.y) / nearestBaseline.y) * 100;
          deviations.push(dev);
        }
      }

      if (deviations.length > 0) {
        deviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
      }
    }

    const combinedData: { speed: number; actualPower?: number; baselinePower?: number }[] =
      data.actual.map((point) => ({
        speed: point.x,
        actualPower: point.y,
        baselinePower: undefined,
      }));

    for (const baselinePoint of data.baseline) {
      const existing = combinedData.find((d) => Math.abs(d.speed - baselinePoint.x) < 0.1);
      if (existing) {
        existing.baselinePower = baselinePoint.y;
      } else {
        combinedData.push({
          speed: baselinePoint.x,
          actualPower: undefined,
          baselinePower: baselinePoint.y,
        });
      }
    }

    combinedData.sort((a, b) => a.speed - b.speed);

    const convertedData = combinedData.map((d) => ({
      ...d,
      speed: convertSpeed(d.speed, "knots", speedUnit),
      actualPower:
        d.actualPower === undefined ? undefined : convertPower(d.actualPower, "kW", powerUnit),
      baselinePower:
        d.baselinePower === undefined ? undefined : convertPower(d.baselinePower, "kW", powerUnit),
    }));

    const enriched: EnrichedDataPoint[] = convertedData.map((point) => {
      const benchmarkPoint = fleetBenchmarks?.powerSTW?.find(
        (b) => Math.abs(convertSpeed(b.speed, "knots", speedUnit) - point.speed) < 0.5
      );

      return {
        ...point,
        fleetAvg: benchmarkPoint
          ? convertPower(benchmarkPoint.fleetAvgPower, "kW", powerUnit)
          : undefined,
        p25: benchmarkPoint ? convertPower(benchmarkPoint.p25, "kW", powerUnit) : undefined,
        p50: benchmarkPoint ? convertPower(benchmarkPoint.p50, "kW", powerUnit) : undefined,
        p75: benchmarkPoint ? convertPower(benchmarkPoint.p75, "kW", powerUnit) : undefined,
        baseline: point.baselinePower,
      };
    });

    return { enrichedData: enriched, avgDeviation: deviation };
  }, [data, fleetBenchmarks, speedUnit, powerUnit]);

  return {
    data,
    isLoading,
    error,
    isError,
    enrichedData,
    avgDeviation,
    speedUnit,
    powerUnit,
    toggles,
    setToggle,
    showControls,
    setShowControls: useCallback((show: boolean) => setShowControls(show), []),
  };
}
