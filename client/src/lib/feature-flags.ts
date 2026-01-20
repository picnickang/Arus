/**
 * ML/AI UI Refactor Feature Flags
 * 
 * Flags control the gradual rollout of new ML/AI UI components.
 * Precedence: LocalStorage override > Environment variable > Default
 * 
 * Usage:
 *   import { featureFlags } from '@/lib/feature-flags';
 *   if (featureFlags.enableNewModelManagement) { ... }
 * 
 * Dev tools (browser console):
 *   globalThis.featureFlags.enableAll()  // Enable all flags
 *   globalThis.featureFlags.disableAll() // Disable all flags
 *   globalThis.featureFlags.debug()      // Show current state
 */

interface FeatureFlags {
  // Master toggle for entire AI Studio page
  mlAiStudio: boolean;
  
  // Phase 1: AI Management Studio
  enableNewModelManagement: boolean;
  enableUnifiedTrainingForm: boolean;
  enableNewAcousticUI: boolean;
  enableDataExports: boolean;
  
  // Phase 2: AI Performance
  enableNewPerformanceDashboard: boolean;
  enableNewExplanations: boolean;
  enableNewFeedbackUI: boolean;
  
  // Phase 3: AI Insights
  enableNewAIReports: boolean;
  enableVesselIntelligence: boolean;
  enableEquipmentKnowledge: boolean;

  // Scheduling System Overhaul (SmartPAL-style)
  newSchedulerEnabled: boolean; // Master toggle for new scheduling UI
  enableSchedulingSettings: boolean; // Enable admin scheduling settings tab
  enableAiSuggestions: boolean; // Enable AI-powered crew suggestions
  enableTimelineView: boolean; // Enable new timeline grid view
  enableScheduleGenerator: boolean; // Enable Schedule Generator (AI-powered auto-scheduling)
}

const defaultFlags: FeatureFlags = {
  // Master toggle - Enable for instant 2-minute rollback if issues arise
  mlAiStudio: true,
  
  // Phase 1 - All disabled by default for progressive rollout
  enableNewModelManagement: false,
  enableUnifiedTrainingForm: false,
  enableNewAcousticUI: false,
  enableDataExports: false,
  
  // Phase 2
  enableNewPerformanceDashboard: false,
  enableNewExplanations: false,
  enableNewFeedbackUI: false,
  
  // Phase 3
  enableNewAIReports: false,
  enableVesselIntelligence: false,
  enableEquipmentKnowledge: false,

  // Scheduling System Overhaul - Enabled for production use
  newSchedulerEnabled: true,
  enableSchedulingSettings: true,
  enableAiSuggestions: true,
  enableTimelineView: true,
  enableScheduleGenerator: true, // Enabled for development testing
};

/**
 * Get feature flag value with precedence:
 * 1. LocalStorage override (for developers)
 * 2. Environment variable (VITE_FEATURE_*)
 * 3. Default value
 */
function getFlag(key: keyof FeatureFlags): boolean {
  // LocalStorage override (dev testing)
  const localOverride = localStorage.getItem(`feature_${key}`);
  if (localOverride !== null) {
    return localOverride === 'true';
  }
  
  // Environment variable
  const envKey = `VITE_FEATURE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
  const envValue = import.meta.env[envKey];
  if (envValue !== undefined) {
    return envValue === 'true';
  }
  
  // Default
  return defaultFlags[key];
}

export const featureFlags: FeatureFlags = {
  // Master toggle
  mlAiStudio: getFlag('mlAiStudio'),
  
  // Phase 1
  enableNewModelManagement: getFlag('enableNewModelManagement'),
  enableUnifiedTrainingForm: getFlag('enableUnifiedTrainingForm'),
  enableNewAcousticUI: getFlag('enableNewAcousticUI'),
  enableDataExports: getFlag('enableDataExports'),
  
  // Phase 2
  enableNewPerformanceDashboard: getFlag('enableNewPerformanceDashboard'),
  enableNewExplanations: getFlag('enableNewExplanations'),
  enableNewFeedbackUI: getFlag('enableNewFeedbackUI'),
  
  // Phase 3
  enableNewAIReports: getFlag('enableNewAIReports'),
  enableVesselIntelligence: getFlag('enableVesselIntelligence'),
  enableEquipmentKnowledge: getFlag('enableEquipmentKnowledge'),

  // Scheduling System Overhaul
  newSchedulerEnabled: getFlag('newSchedulerEnabled'),
  enableSchedulingSettings: getFlag('enableSchedulingSettings'),
  enableAiSuggestions: getFlag('enableAiSuggestions'),
  enableTimelineView: getFlag('enableTimelineView'),
  enableScheduleGenerator: getFlag('enableScheduleGenerator'),
};

/**
 * Check if a feature is enabled by key name
 * Useful for dynamic feature checking in routing
 */
export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return featureFlags[key];
}

/**
 * Helper for debugging - shows all active flags in console
 */
export function debugFeatureFlags(): void {
  console.table(featureFlags);
}

/**
 * Dev tool: Enable all flags for testing
 */
export function enableAllFlags(): void {
  Object.keys(defaultFlags).forEach((key) => {
    localStorage.setItem(`feature_${key}`, 'true');
  });
  console.info('✅ All feature flags enabled. Refresh page to apply.');
}

/**
 * Dev tool: Disable all flags (revert to defaults)
 */
export function disableAllFlags(): void {
  Object.keys(defaultFlags).forEach((key) => {
    localStorage.removeItem(`feature_${key}`);
  });
  console.info('✅ All feature flags disabled. Refresh page to apply.');
}

/**
 * Dev tool: Set specific flag
 */
export function setFlag(key: keyof FeatureFlags, value: boolean): void {
  if (value) {
    localStorage.setItem(`feature_${key}`, 'true');
  } else {
    localStorage.setItem(`feature_${key}`, 'false');
  }
  console.info(`✅ Flag "${key}" set to ${value}. Refresh page to apply.`);
}

// Expose to window for console access in development
if (import.meta.env.DEV) {
  (window as unknown as { featureFlags: object }).featureFlags = {
    current: featureFlags,
    debug: debugFeatureFlags,
    enableAll: enableAllFlags,
    disableAll: disableAllFlags,
    setFlag,
  };
  
  // Log available commands on first load
  console.info(
    '%c🚩 Feature Flags Available',
    'color: #10b981; font-weight: bold; font-size: 14px;'
  );
  console.info('Commands:');
  console.info('  globalThis.featureFlags.debug()     - Show all flags');
  console.info('  globalThis.featureFlags.enableAll() - Enable all flags');
  console.info('  globalThis.featureFlags.disableAll() - Disable all flags');
  console.info('  globalThis.featureFlags.setFlag("enableNewModelManagement", true)');
}
