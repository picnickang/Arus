import type { AssetTwinState, InsertAssetTwinState } from "@shared/schema";

export interface TwinStatePort {
  getLatestState(orgId: string, twinId: string): Promise<AssetTwinState | null>;
  getStateHistory(orgId: string, twinId: string, limit?: number): Promise<AssetTwinState[]>;
  saveState(data: InsertAssetTwinState): Promise<AssetTwinState>;
}
