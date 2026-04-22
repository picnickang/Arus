// Stub file - beast mode config
export { DEFAULT_ORG_ID } from "@shared/config/tenant";

export type BeastModeFeature = "vibration" | "acoustic" | "thermal" | "pressure";

export const beastModeConfig = {
  enabled: false,
  samplingRate: 1000,
  fftWindowSize: 1024,
};

export function getBeastModeConfig() {
  return beastModeConfig;
}

export function isBeastModeEnabled(): boolean {
  return false;
}

export const beastModeManager = {
  isEnabled: (_feature: BeastModeFeature) => false,
  isFeatureEnabled: (_orgId: string, _feature: string) => false,
  enable: (_feature: BeastModeFeature) => {},
  disable: (_feature: BeastModeFeature) => {},
  getConfig: () => beastModeConfig,
  setConfig: (_config: Partial<typeof beastModeConfig>) => {},
};
