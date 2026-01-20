/**
 * Adaptive Training Window Module - Public API
 */

export * from "./types";
export { EQUIPMENT_CONFIGS, DEFAULT_CONFIG, GLOBAL_CONFIG } from "./config";
export { getEquipmentDataRange } from "./data-range";
export { calculateTierFromLookbackDays, getTierBadgeConfig, shouldAllowTraining } from "./tier-utils";
export { determineOptimalTrainingWindow } from "./window-calculator";
