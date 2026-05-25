import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../../../../db";
import { assetTwinState, type AssetTwinState, type InsertAssetTwinState } from "@shared/schema";
import type { TwinStatePort } from "./ports";

export class TwinStateAdapter implements TwinStatePort {
  async getLatestState(orgId: string, twinId: string): Promise<AssetTwinState | null> {
    const [result] = await db
      .select()
      .from(assetTwinState)
      .where(and(eq(assetTwinState.orgId, orgId), eq(assetTwinState.twinId, twinId)))
      .orderBy(desc(assetTwinState.timestamp))
      .limit(1);
    return result ?? null;
  }

  async getStateHistory(
    orgId: string,
    twinId: string,
    limit = 100,
    since?: Date
  ): Promise<AssetTwinState[]> {
    const conditions = [eq(assetTwinState.orgId, orgId), eq(assetTwinState.twinId, twinId)];
    if (since) conditions.push(gte(assetTwinState.timestamp, since));
    return db
      .select()
      .from(assetTwinState)
      .where(and(...conditions))
      .orderBy(desc(assetTwinState.timestamp))
      .limit(limit);
  }

  async saveState(data: InsertAssetTwinState): Promise<AssetTwinState> {
    const [result] = await db.insert(assetTwinState).values(data).returning();
    if (!result) {
      throw new Error("Failed to save twin state");
    }
    return result;
  }
}
