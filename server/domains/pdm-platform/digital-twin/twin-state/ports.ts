import type { AssetTwinState, InsertAssetTwinState } from "@shared/schema";

export interface TwinStatePort {
  getLatestState(orgId: string, twinId: string): Promise<AssetTwinState | null>;
  getStateHistory(
    orgId: string,
    twinId: string,
    limit?: number,
    since?: Date
  ): Promise<AssetTwinState[]>;
  saveState(data: InsertAssetTwinState): Promise<AssetTwinState>;
}
