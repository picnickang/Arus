const registry: any = {
  state: "closed",
  failureCount: 0,
  lastFailureTime: null,
  async getModel(_id: string): Promise<any> {
    return null;
  },
  async listModels(_filter?: any): Promise<any[]> {
    return [];
  },
  async registerModel(_model: any): Promise<any> {
    return null;
  },
  async getLatestVersion(_modelType: string): Promise<any> {
    return null;
  },
  async getActiveModel(_modelType: string, _equipmentId?: string): Promise<any> {
    return null;
  },
  async getModelHealth(): Promise<any> {
    return { state: "closed", failureCount: 0, lastFailureTime: null };
  },
};

export const mlModelRegistry: any = registry;

export function getModelRegistry(): any {
  return registry;
}

export default mlModelRegistry;
