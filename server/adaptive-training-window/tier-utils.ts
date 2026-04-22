/**
 * Training Window Tier Utilities
 */

import type { DataQualityTier, TrainingWindowConfig } from "./types";
import { GLOBAL_CONFIG } from "./config";

export function calculateTierFromLookbackDays(lookbackDays: number): {
  tier: DataQualityTier;
  confidenceMultiplier: number;
} {
  if (lookbackDays >= GLOBAL_CONFIG.PLATINUM_MIN_DAYS) {
    return { tier: "platinum", confidenceMultiplier: 1.2 };
  }
  if (lookbackDays >= GLOBAL_CONFIG.GOLD_MIN_DAYS) {
    return { tier: "gold", confidenceMultiplier: 1.15 };
  }
  if (lookbackDays >= GLOBAL_CONFIG.SILVER_MIN_DAYS) {
    return { tier: "silver", confidenceMultiplier: 1 };
  }
  return { tier: "bronze", confidenceMultiplier: 0.85 };
}

const tierBadgeConfigs: Record<
  DataQualityTier,
  { label: string; color: string; icon: string; description: string }
> = {
  platinum: {
    label: "Platinum",
    color: "bg-purple-500 text-white",
    icon: "💎",
    description: "730+ days - Exceptional confidence",
  },
  gold: {
    label: "Gold",
    color: "bg-yellow-500 text-white",
    icon: "🥇",
    description: "365-730 days - High confidence",
  },
  silver: {
    label: "Silver",
    color: "bg-gray-400 text-white",
    icon: "🥈",
    description: "180-365 days - Good confidence",
  },
  bronze: {
    label: "Bronze",
    color: "bg-orange-600 text-white",
    icon: "🥉",
    description: "90-180 days - Basic predictions",
  },
};

export function getTierBadgeConfig(tier: DataQualityTier): {
  label: string;
  color: string;
  icon: string;
  description: string;
} {
  return tierBadgeConfigs[tier];
}

export function shouldAllowTraining(config: TrainingWindowConfig): {
  allowed: boolean;
  reason?: string;
} {
  if (config.metadata.availableDays < GLOBAL_CONFIG.ABSOLUTE_MIN_DAYS) {
    return {
      allowed: false,
      reason: `Insufficient data: ${config.metadata.availableDays} days available, ${GLOBAL_CONFIG.ABSOLUTE_MIN_DAYS} days required`,
    };
  }

  if (config.metadata.failureCount < GLOBAL_CONFIG.MIN_FAILURE_COUNT) {
    return {
      allowed: false,
      reason: `Insufficient failure examples: ${config.metadata.failureCount} found, ${GLOBAL_CONFIG.MIN_FAILURE_COUNT} required`,
    };
  }

  return { allowed: true };
}
