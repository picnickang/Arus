export interface MlModelRecord {
  id: string;
  modelType: string;
  equipmentId?: string;
  version?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MlModelFilter {
  modelType?: string;
  equipmentId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MlModelHealth {
  state: "open" | "closed" | "half-open";
  failureCount: number;
  lastFailureTime: number | null;
}

export interface MlModelCacheStats {
  size: number;
  hits: number;
  misses: number;
}

export interface MlModelRegistry {
  state: "open" | "closed" | "half-open";
  failureCount: number;
  lastFailureTime: number | null;
  getModel(_id: string): Promise<MlModelRecord | null>;
  listModels(_filter?: MlModelFilter): Promise<MlModelRecord[]>;
  registerModel(_model: MlModelRecord): Promise<MlModelRecord | null>;
  getLatestVersion(_modelType: string): Promise<MlModelRecord | null>;
  getActiveModel(_modelType: string, _equipmentId?: string): Promise<MlModelRecord | null>;
  getModelHealth(): Promise<MlModelHealth>;
  getCacheStats?(): MlModelCacheStats;
  listCachedModels?(): MlModelRecord[];
}

const registry: MlModelRegistry = {
  state: "closed",
  failureCount: 0,
  lastFailureTime: null,
  async getModel(_id: string): Promise<MlModelRecord | null> {
    return null;
  },
  async listModels(_filter?: MlModelFilter): Promise<MlModelRecord[]> {
    return [];
  },
  async registerModel(_model: MlModelRecord): Promise<MlModelRecord | null> {
    return null;
  },
  async getLatestVersion(_modelType: string): Promise<MlModelRecord | null> {
    return null;
  },
  async getActiveModel(_modelType: string, _equipmentId?: string): Promise<MlModelRecord | null> {
    return null;
  },
  async getModelHealth(): Promise<MlModelHealth> {
    return { state: "closed", failureCount: 0, lastFailureTime: null };
  },
};

export const mlModelRegistry: MlModelRegistry = registry;

export function getModelRegistry(): MlModelRegistry {
  return registry;
}
