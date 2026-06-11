import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../../db";
import {
  assetTwinTemplates,
  assetTwins,
  type AssetTwinTemplate,
  type InsertAssetTwinTemplate,
  type AssetTwin,
  type InsertAssetTwin,
} from "@shared/schema";
import type { TwinDefinitionPort } from "./ports";

export class TwinDefinitionAdapter implements TwinDefinitionPort {
  async listTemplates(orgId: string): Promise<AssetTwinTemplate[]> {
    return db
      .select()
      .from(assetTwinTemplates)
      .where(eq(assetTwinTemplates.orgId, orgId))
      .orderBy(desc(assetTwinTemplates.createdAt));
  }

  async getTemplate(orgId: string, templateId: string): Promise<AssetTwinTemplate | null> {
    const [result] = await db
      .select()
      .from(assetTwinTemplates)
      .where(and(eq(assetTwinTemplates.orgId, orgId), eq(assetTwinTemplates.id, templateId)));
    return result ?? null;
  }

  async createTemplate(data: InsertAssetTwinTemplate): Promise<AssetTwinTemplate> {
    const [result] = await db.insert(assetTwinTemplates).values(data).returning();
    if (!result) {
      throw new Error("Failed to create twin template");
    }
    return result;
  }

  async listTwins(orgId: string): Promise<AssetTwin[]> {
    return db
      .select()
      .from(assetTwins)
      .where(eq(assetTwins.orgId, orgId))
      .orderBy(desc(assetTwins.createdAt));
  }

  async getTwin(orgId: string, twinId: string): Promise<AssetTwin | null> {
    const [result] = await db
      .select()
      .from(assetTwins)
      .where(and(eq(assetTwins.orgId, orgId), eq(assetTwins.id, twinId)));
    return result ?? null;
  }

  async createTwin(data: InsertAssetTwin): Promise<AssetTwin> {
    const [result] = await db.insert(assetTwins).values(data).returning();
    if (!result) {
      throw new Error("Failed to create asset twin");
    }
    return result;
  }
}
