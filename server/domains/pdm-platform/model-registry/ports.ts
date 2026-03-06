import type { MlModel, ModelVersion, InsertModelVersion, ModelDeployment } from "@shared/schema";

export interface ModelRegistryPort {
  listModels(orgId: string): Promise<MlModel[]>;
  getModel(orgId: string, modelId: string): Promise<MlModel | null>;
  listVersions(orgId: string, modelId: string): Promise<ModelVersion[]>;
  createVersion(data: InsertModelVersion): Promise<ModelVersion>;
  getActiveDeployment(orgId: string, modelId: string): Promise<ModelDeployment | null>;
  deploy(orgId: string, modelId: string, modelVersionId: string, target: string): Promise<ModelDeployment>;
  rollback(orgId: string, deploymentId: number): Promise<ModelDeployment>;
}
