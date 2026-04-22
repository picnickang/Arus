/**
 * Training Window Calculator
 */

import type { DataQualityTier, TrainingWindowConfig } from "./types";
import { EQUIPMENT_CONFIGS, DEFAULT_CONFIG, GLOBAL_CONFIG } from "./config";
import { getEquipmentDataRange } from "./data-range";

export async function determineOptimalTrainingWindow(
  orgId: string,
  equipmentType?: string
): Promise<TrainingWindowConfig> {
  const normalizedType = equipmentType === "general" || !equipmentType ? undefined : equipmentType;
  const equipConfig = normalizedType
    ? EQUIPMENT_CONFIGS[normalizedType] || DEFAULT_CONFIG
    : DEFAULT_CONFIG;

  const dataRange = await getEquipmentDataRange(orgId, normalizedType);
  const { availableDays, failureCount } = dataRange;
  const warnings: string[] = [];
  const recommendations: string[] = [];

  let lookbackDays: number;
  let tier: DataQualityTier;
  let confidenceMultiplier: number;

  if (availableDays < GLOBAL_CONFIG.ABSOLUTE_MIN_DAYS) {
    warnings.push(
      `Insufficient data: ${availableDays} days available, ${GLOBAL_CONFIG.ABSOLUTE_MIN_DAYS} days required`
    );
    recommendations.push(
      `Collect ${GLOBAL_CONFIG.ABSOLUTE_MIN_DAYS - availableDays} more days of telemetry data before training`
    );

    return {
      lookbackDays: availableDays,
      tier: "bronze",
      confidenceMultiplier: 0.5,
      warnings,
      recommendations,
      metadata: {
        availableDays,
        usedDays: availableDays,
        failureCount,
        equipmentType: equipmentType || "all",
        tierThresholds: {
          bronze: GLOBAL_CONFIG.BRONZE_MIN_DAYS,
          silver: GLOBAL_CONFIG.SILVER_MIN_DAYS,
          gold: GLOBAL_CONFIG.GOLD_MIN_DAYS,
          platinum: GLOBAL_CONFIG.PLATINUM_MIN_DAYS,
        },
      },
    };
  }

  if (availableDays < equipConfig.minDays) {
    warnings.push(
      `${equipConfig.category} equipment requires ${equipConfig.minDays} days minimum, ${availableDays} days available`
    );
    recommendations.push(
      `Collect ${equipConfig.minDays - availableDays} more days for ${equipConfig.category} equipment standards`
    );
  }

  if (failureCount < GLOBAL_CONFIG.MIN_FAILURE_COUNT) {
    warnings.push(
      `Only ${failureCount} failure events found, ${GLOBAL_CONFIG.MIN_FAILURE_COUNT} minimum recommended`
    );
    recommendations.push(
      `Training will proceed with limited failure examples - expect lower accuracy`
    );
  } else if (failureCount < GLOBAL_CONFIG.RECOMMENDED_FAILURE_COUNT) {
    recommendations.push(
      `${failureCount} failures available, ${GLOBAL_CONFIG.RECOMMENDED_FAILURE_COUNT}+ recommended for optimal accuracy`
    );
  }

  lookbackDays = Math.min(availableDays, GLOBAL_CONFIG.MAX_DAYS);

  if (availableDays >= GLOBAL_CONFIG.PLATINUM_MIN_DAYS) {
    tier = "platinum";
    confidenceMultiplier = 1.2;
    recommendations.push(
      `Platinum tier: Exceptional data quality with ${Math.floor(availableDays / 30)} months of history`
    );
  } else if (availableDays >= GLOBAL_CONFIG.GOLD_MIN_DAYS) {
    tier = "gold";
    confidenceMultiplier = 1.15;
    recommendations.push(
      `Gold tier: Excellent data quality - ${Math.floor((GLOBAL_CONFIG.PLATINUM_MIN_DAYS - availableDays) / 30)} more months for Platinum`
    );
  } else if (availableDays >= GLOBAL_CONFIG.SILVER_MIN_DAYS) {
    tier = "silver";
    confidenceMultiplier = 1;
    recommendations.push(
      `Silver tier: Good data quality - ${Math.floor((GLOBAL_CONFIG.GOLD_MIN_DAYS - availableDays) / 30)} more months for Gold tier`
    );
  } else {
    tier = "bronze";
    confidenceMultiplier = 0.85;
    recommendations.push(
      `Bronze tier: Basic predictions - ${Math.floor((GLOBAL_CONFIG.SILVER_MIN_DAYS - availableDays) / 30)} more months for Silver tier`
    );
  }

  if (availableDays > GLOBAL_CONFIG.MAX_DAYS) {
    recommendations.push(
      `Using optimal ${GLOBAL_CONFIG.MAX_DAYS} days (2 years) - research shows diminishing returns beyond this`
    );
  }

  return {
    lookbackDays,
    tier,
    confidenceMultiplier,
    warnings,
    recommendations,
    metadata: {
      availableDays,
      usedDays: lookbackDays,
      failureCount,
      equipmentType: equipmentType || "all",
      tierThresholds: {
        bronze: GLOBAL_CONFIG.BRONZE_MIN_DAYS,
        silver: GLOBAL_CONFIG.SILVER_MIN_DAYS,
        gold: GLOBAL_CONFIG.GOLD_MIN_DAYS,
        platinum: GLOBAL_CONFIG.PLATINUM_MIN_DAYS,
      },
    },
  };
}
