import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import {
  assetTwins,
  assetTwinState,
  twinResiduals,
  type AssetTwin,
} from "@shared/schema";
import type { ITwinFreshnessStorage } from "./ports";

export class TwinFreshnessAdapter implements ITwinFreshnessStorage {
  async getActiveTwins(orgId: string): Promise<AssetTwin[]> {
    return db
      .select()
      .from(assetTwins)
      .where(and(eq(assetTwins.orgId, orgId), eq(assetTwins.status, "active")));
  }

  async getLatestStateTimestamp(orgId: string, twinId: string): Promise<Date | null> {
    const [result] = await db
      .select({ timestamp: assetTwinState.timestamp })
      .from(assetTwinState)
      .where(and(eq(assetTwinState.orgId, orgId), eq(assetTwinState.twinId, twinId)))
      .orderBy(desc(assetTwinState.timestamp))
      .limit(1);
    return result?.timestamp ?? null;
  }

  async getLatestResidualTimestamp(orgId: string, twinId: string): Promise<Date | null> {
    const [result] = await db
      .select({ timestamp: twinResiduals.timestamp })
      .from(twinResiduals)
      .where(and(eq(twinResiduals.orgId, orgId), eq(twinResiduals.twinId, twinId)))
      .orderBy(desc(twinResiduals.timestamp))
      .limit(1);
    return result?.timestamp ?? null;
  }
}
