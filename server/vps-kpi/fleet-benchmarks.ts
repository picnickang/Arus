/**
 * VPS Fleet Benchmark Functions
 */

import { dbTelemetryStorage, dbEquipmentStorage, vesselService } from "../repositories.js";
import type { LoadHistBin, FleetLoadBenchmark, FleetPowerSTWBenchmark, PowerVsSTW } from "./types";
import { quantile, calculatePowerSTWCurve } from "./calculations";

export async function computeEquipmentLoadDistribution(
  equipmentId: string,
  orgId: string,
  timeRange: { start: Date; end: Date }
): Promise<LoadHistBin[]> {
  const telemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
    equipmentId,
    timeRange.start,
    timeRange.end,
    orgId
  );
  if (!telemetry || telemetry.length === 0) {
    return [];
  }

  const torqueData = telemetry
    .filter((t) => t.sensorType === "shaft_torque" || t.sensorType === "torque")
    .map((t) => t.value);

  if (torqueData.length === 0) {
    return [];
  }

  const maxTorque = quantile(torqueData, 0.95);
  const loadPct = torqueData.map((v) => Math.max(0, Math.min(100, (100 * v) / maxTorque)));

  const bins = [20, 30, 35, 43, 48, 50, 62, 70, 80, 90, 100];
  const counts = bins.map(() => 0);

  for (const load of loadPct) {
    let binIndex = counts.length - 1;
    for (let i = 0; i < bins.length; i++) {
      if (load <= bins[i]) {
        binIndex = i;
        break;
      }
    }
    counts[binIndex] += 1;
  }

  return bins.map((bin, i) => ({ bin, hours: counts[i] / 3600 }));
}

export async function computeFleetLoadBenchmarks(
  orgId: string,
  timeRange: { start: Date; end: Date },
  vesselType?: string
): Promise<FleetLoadBenchmark[]> {
  const vessels = await vesselService.getVessels(orgId);
  const filteredVessels = vesselType ? vessels.filter((v) => v.type === vesselType) : vessels;
  if (filteredVessels.length === 0) {
    return [];
  }

  const allEquipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
  const allDistributions: LoadHistBin[][] = [];

  for (const vessel of filteredVessels) {
    const equipment = allEquipment.filter((e) => e.vesselId === vessel.id);
    for (const eq of equipment) {
      try {
        const dist = await computeEquipmentLoadDistribution(eq.id, orgId, timeRange);
        if (dist.length > 0) {
          allDistributions.push(dist);
        }
      } catch (err) {
        console.error(`Error computing load distribution for ${eq.id}:`, err);
      }
    }
  }

  if (allDistributions.length === 0) {
    return [];
  }

  const bins = [20, 30, 35, 43, 48, 50, 62, 70, 80, 90, 100];

  return bins.map((bin, binIdx) => {
    const hoursInBin = allDistributions
      .map((dist) => dist[binIdx]?.hours || 0)
      .filter((h) => h > 0);
    if (hoursInBin.length === 0) {
      return { bin, fleetAvg: 0, p25: 0, p50: 0, p75: 0 };
    }

    return {
      bin,
      fleetAvg: hoursInBin.reduce((sum, h) => sum + h, 0) / hoursInBin.length,
      p25: quantile(hoursInBin, 0.25),
      p50: quantile(hoursInBin, 0.5),
      p75: quantile(hoursInBin, 0.75),
    };
  });
}

export async function computeFleetPowerSTWBenchmarks(
  orgId: string,
  timeRange: { start: Date; end: Date },
  vesselType?: string
): Promise<FleetPowerSTWBenchmark[]> {
  const vessels = await vesselService.getVessels(orgId);
  const filteredVessels = vesselType ? vessels.filter((v) => v.type === vesselType) : vessels;
  if (filteredVessels.length === 0) {
    return [];
  }

  const allPoints: PowerVsSTW[] = [];

  for (const vessel of filteredVessels) {
    try {
      const equipment = await dbEquipmentStorage.getEquipmentByVessel(vessel.id, orgId);
      for (const eq of equipment) {
        const telemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
          eq.id,
          timeRange.start,
          timeRange.end,
          orgId
        );
        if (!telemetry || telemetry.length === 0) {
          continue;
        }

        const rpm = telemetry.filter((t) => t.sensorType === "rpm").map((t) => t.value);
        const torque = telemetry
          .filter((t) => t.sensorType === "shaft_torque" || t.sensorType === "torque")
          .map((t) => t.value);
        const stw = telemetry
          .filter((t) => t.sensorType === "speed" || t.sensorType === "stw")
          .map((t) => t.value);

        if (rpm.length > 0 && torque.length > 0) {
          allPoints.push(...calculatePowerSTWCurve(rpm, torque, stw.length > 0 ? stw : undefined));
        }
      }
    } catch (err) {
      console.error(`Error computing power-STW for vessel ${vessel.id}:`, err);
    }
  }

  if (allPoints.length === 0) {
    return [];
  }

  const speedBins = new Map<number, number[]>();
  for (const point of allPoints) {
    const speedBin = Math.round(point.x);
    if (!speedBins.has(speedBin)) {
      speedBins.set(speedBin, []);
    }
    speedBins.get(speedBin)!.push(point.y);
  }

  const benchmarks: FleetPowerSTWBenchmark[] = [];
  for (const [speed, powers] of Array.from(speedBins.entries()).sort((a, b) => a[0] - b[0])) {
    if (powers.length === 0) {
      continue;
    }
    benchmarks.push({
      speed,
      fleetAvgPower: powers.reduce((sum, p) => sum + p, 0) / powers.length,
      p25: quantile(powers, 0.25),
      p50: quantile(powers, 0.5),
      p75: quantile(powers, 0.75),
    });
  }

  return benchmarks;
}
