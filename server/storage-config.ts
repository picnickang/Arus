/**
 * Legacy storage-config service shim.
 */

export interface StorageConfig {
  id?: string;
  kind: string;
  name?: string;
  url?: string;
  active?: boolean;
  [k: string]: unknown;
}

export interface StorageTestResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

export interface OpsDbStatus {
  url: string | null;
  active: boolean;
}

export const storageConfigService = {
  async list(_kind?: string): Promise<StorageConfig[]> {
    return [];
  },
  async upsert(config: StorageConfig): Promise<StorageConfig> {
    return config;
  },
  async delete(_id: string): Promise<void> {
    // no-op
  },
  async test(_config: StorageConfig): Promise<StorageTestResult> {
    return { ok: false, message: "Storage config service is not configured." };
  },
};

export const opsDbService = {
  async getCurrent(): Promise<OpsDbStatus> {
    return { url: null, active: false };
  },
  async getStaged(): Promise<OpsDbStatus | null> {
    return null;
  },
  async stage(_url: string): Promise<void> {
    // no-op
  },
  async test(_url: string): Promise<StorageTestResult> {
    return { ok: false, message: "Ops DB service is not configured." };
  },
};
