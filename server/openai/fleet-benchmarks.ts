// @ts-nocheck
/**
 * Fleet Benchmarks Calculator - Calculate fleet-wide metrics and comparisons
 */

import type { EquipmentHealth } from "../db/equipment/types.js";
import type { FleetBenchmarks, CrossEquipmentComparison } from "./types";
import type { EquipmentDossier } from "./dossier-builder";

export interface FleetBenchmarkResult {
  fleetBenchmarks: FleetBenchmarks;
  equipmentComparisons: CrossEquipmentComparison[];
}

/**
 * Calculate fleet benchmarks and equipment comparisons
 */
export function calculateFleetBenchmarks(
  equipmentHealthData: EquipmentHealth[],
  equipmentDossiers: EquipmentDossier[]
): FleetBenchmarkResult {
  const healthIndexes = equipmentHealthData.map((eq) => eq.healthIndex);
  const predictedDueDays = equipmentHealthData.map((eq) => eq.predictedDueDays);

  const fleetAvgHealth = healthIndexes.reduce((sum, h) => sum + h, 0) / healthIndexes.length;
  const fleetAvgDueDays = predictedDueDays.reduce((sum, d) => sum + d, 0) / predictedDueDays.length;

  const sortedHealthIndexes = [...healthIndexes].sort((a, b) => b - a);
  const top10Percent = sortedHealthIndexes[Math.floor(sortedHealthIndexes.length * 0.1)] || 100;
  const median = sortedHealthIndexes[Math.floor(sortedHealthIndexes.length * 0.5)] || 70;
  const bottom10Percent = sortedHealthIndexes[Math.floor(sortedHealthIndexes.length * 0.9)] || 30;

  const rankedEquipment = equipmentHealthData
    .map((eq) => ({
      ...eq,
      alertCount:
        equipmentDossiers.find((d: any) => d.id === eq.id)?.context.alertPattern.total || 0,
    }))
    .sort((a, b) => b.healthIndex - a.healthIndex);

  const bestPerformers = rankedEquipment
    .slice(0, Math.max(1, Math.ceil(rankedEquipment.length * 0.2)))
    .map((eq) => ({
      equipmentId: eq.id,
      healthIndex: eq.healthIndex,
      daysToMaintenance: eq.predictedDueDays,
      vesselName: eq.vessel,
    }));

  const worstPerformers = rankedEquipment
    .slice(-Math.max(1, Math.ceil(rankedEquipment.length * 0.2)))
    .map((eq) => ({
      equipmentId: eq.id,
      healthIndex: eq.healthIndex,
      daysToMaintenance: eq.predictedDueDays,
      vesselName: eq.vessel,
      issuesCount: eq.alertCount,
    }));

  const fleetBenchmarks: FleetBenchmarks = {
    fleetAverage: {
      healthIndex: Math.round(fleetAvgHealth * 10) / 10,
      predictedDueDays: Math.round(fleetAvgDueDays * 10) / 10,
      maintenanceFrequency: Math.round((365 / fleetAvgDueDays) * 10) / 10,
    },
    performancePercentiles: { top10Percent, median, bottom10Percent },
    bestPerformers,
    worstPerformers,
  };

  const equipmentComparisons = buildEquipmentComparisons(
    equipmentHealthData,
    rankedEquipment,
    fleetAvgHealth
  );

  return { fleetBenchmarks, equipmentComparisons };
}

function buildEquipmentComparisons(
  equipmentHealthData: EquipmentHealth[],
  rankedEquipment: any[],
  fleetAvgHealth: number
): CrossEquipmentComparison[] {
  return equipmentHealthData.map((equipment) => {
    const fleetRanking = rankedEquipment.findIndex((eq) => eq.id === equipment.id) + 1;

    let relativePerformance: "Top25%" | "Above Average" | "Below Average" | "Bottom25%";
    if (fleetRanking <= rankedEquipment.length * 0.25) {
      relativePerformance = "Top25%";
    } else if (equipment.healthIndex >= fleetAvgHealth) {
      relativePerformance = "Above Average";
    } else if (fleetRanking >= rankedEquipment.length * 0.75) {
      relativePerformance = "Bottom25%";
    } else {
      relativePerformance = "Below Average";
    }

    const sameVesselEquipment = equipmentHealthData.filter((eq) => eq.vessel === equipment.vessel);
    const avgPeerHealth =
      sameVesselEquipment.reduce((sum, eq) => sum + eq.healthIndex, 0) / sameVesselEquipment.length;
    const vesselRanking =
      sameVesselEquipment
        .sort((a, b) => b.healthIndex - a.healthIndex)
        .findIndex((eq) => eq.id === equipment.id) + 1;

    return {
      equipmentId: equipment.id,
      relativePerformance,
      fleetRanking,
      healthIndexVsFleetAvg: Math.round((equipment.healthIndex - fleetAvgHealth) * 10) / 10,
      peerGroupComparison: {
        similarEquipmentCount: sameVesselEquipment.length,
        rankInPeerGroup: vesselRanking,
        avgPeerHealth: Math.round(avgPeerHealth * 10) / 10,
      },
      vesselComparison: {
        rankOnVessel: vesselRanking,
        vesselAvgHealth: Math.round(avgPeerHealth * 10) / 10,
        equipmentCountOnVessel: sameVesselEquipment.length,
      },
    };
  });
}
