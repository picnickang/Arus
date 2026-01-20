/**
 * Adaptive Training Window Types
 */

export type DataQualityTier = "bronze" | "silver" | "gold" | "platinum";

export interface EquipmentDataRange {
  equipmentType: string;
  oldestTelemetryDate: Date | null;
  availableDays: number;
  failureCount: number;
}

export interface TrainingWindowConfig {
  lookbackDays: number;
  tier: DataQualityTier;
  confidenceMultiplier: number;
  warnings: string[];
  recommendations: string[];
  metadata: {
    availableDays: number;
    usedDays: number;
    failureCount: number;
    equipmentType: string;
    tierThresholds: {
      bronze: number;
      silver: number;
      gold: number;
      platinum: number;
    };
  };
}

export interface EquipmentTypeConfig {
  minDays: number;
  category: "critical" | "standard" | "accessory";
}
