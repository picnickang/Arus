/**
 * Alert Settings Repository - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type { ClaimResult, CooldownSnapshot, EmailLogOptions } from "./settings/index.js";
export { AlertSettingsRepository, alertSettingsRepository } from "./settings/index.js";
