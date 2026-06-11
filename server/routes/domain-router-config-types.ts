export interface DomainRouterConfig {
  name: string;
  importPath: string;
  functionName: string;
  getDeps: () => Record<string, unknown>;
  mountPath?: string;
  middlewareKeys?: string[];
}
