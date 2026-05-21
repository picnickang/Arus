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

export interface BeastFeatureConfig {
  enabled: boolean;
  configuration?: Record<string, unknown>;
  lastModifiedBy?: string;
}

export const beastModeManager = {
  isEnabled: (_feature: BeastModeFeature) => false,
  isFeatureEnabled: (_orgId: string, _feature: string) => false,
  enable: (_feature: BeastModeFeature) => {},
  disable: (_feature: BeastModeFeature) => {},
  getConfig: () => beastModeConfig,
  setConfig: (_config: Partial<typeof beastModeConfig>) => {},
  async getAllFeatureConfigs(_orgId: string): Promise<Record<string, BeastFeatureConfig>> {
    return {};
  },
  async getFeatureConfig(_orgId: string, _feature: string): Promise<BeastFeatureConfig | null> {
    return null;
  },
  async enableFeature(
    _orgId: string,
    _feature: string,
    _configuration?: Record<string, unknown>,
    _lastModifiedBy?: string
  ): Promise<boolean> {
    return false;
  },
  async disableFeature(
    _orgId: string,
    _feature: string,
    _lastModifiedBy?: string
  ): Promise<boolean> {
    return false;
  },
};
