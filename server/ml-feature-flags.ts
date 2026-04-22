/**
 * Feature Flags System for ML Features
 * Enables gradual rollout and A/B testing of new ML capabilities
 * Provides granular control over feature activation per organization/equipment
 *
 * MODULARIZED: 612 lines → 6 focused modules (~35-165 lines each)
 */

export type {
  FeatureFlagConfig,
  FeatureFlagEvaluation,
  FeatureFlagContext,
  FeatureFlagSummary,
  RolloutSchedule,
} from "./ml-feature-flags/types";

export { ML_FEATURE_FLAGS } from "./ml-feature-flags/constants";
export { createDefaultFlags } from "./ml-feature-flags/default-flags";
export { FeatureFlagManager, featureFlagManager } from "./ml-feature-flags/manager";
export { GradualRollout, gradualRollout } from "./ml-feature-flags/gradual-rollout";
export {
  isFeatureEnabled,
  initializeFeatureFlags,
  getFeatureFlags,
} from "./ml-feature-flags/helpers";
