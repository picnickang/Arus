import type {
  AssetTwinTemplate,
  InsertAssetTwinTemplate,
  AssetTwin,
  InsertAssetTwin,
} from "@shared/schema";

export interface TwinDefinitionPort {
  listTemplates(orgId: string): Promise<AssetTwinTemplate[]>;
  getTemplate(orgId: string, templateId: string): Promise<AssetTwinTemplate | null>;
  createTemplate(data: InsertAssetTwinTemplate): Promise<AssetTwinTemplate>;

  listTwins(orgId: string): Promise<AssetTwin[]>;
  getTwin(orgId: string, twinId: string): Promise<AssetTwin | null>;
  createTwin(data: InsertAssetTwin): Promise<AssetTwin>;
}
