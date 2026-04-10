/**
 * Inventory Status Report Generator
 * Generates inventory and low stock report
 */

import { vesselService, dbInventoryStorage } from '../../../repositories';
import type { IInventoryStatusGenerator } from '../domain/ports.js';
import type {
  InventoryStatusData,
  LowStockItem,
  VesselInventorySummary,
} from '../domain/types.js';
import { logger } from '../../../utils/logger.js';

const LOG_CTX = 'InventoryStatusGenerator';

export class InventoryStatusGenerator implements IInventoryStatusGenerator {
  readonly reportType = 'inventory_status' as const;

  async generate(orgId: string, vesselIds: string[] | null): Promise<InventoryStatusData> {
    logger.info(LOG_CTX, `Generating inventory status report for org ${orgId}`);

    try {
      const lowStockItems = await this.getLowStockItems(orgId, vesselIds);
      const vesselBreakdown = await this.getVesselBreakdown(orgId, vesselIds);
      const reorderRequired = lowStockItems.length;
      const totalValue = vesselBreakdown.reduce((sum, v) => sum + v.totalValue, 0);

      return {
        lowStockItems,
        reorderRequired,
        totalValue,
        vesselBreakdown,
      };
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to generate inventory status report', String(error));
      return {
        lowStockItems: [],
        reorderRequired: 0,
        totalValue: 0,
        vesselBreakdown: [],
      };
    }
  }

  private async getLowStockItems(
    orgId: string,
    vesselIds: string[] | null
  ): Promise<LowStockItem[]> {
    try {
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      const lowStockItems: LowStockItem[] = [];

      for (const vessel of filteredVessels) {
        const inventory = await dbInventoryStorage.getParts(orgId);

        for (const item of inventory) {
          const currentQty = (item as any).quantity || 0;
          const minQty = (item as any).minimumQuantity || (item as any).reorderPoint || 0;

          if (currentQty <= minQty) {
            lowStockItems.push({
              partId: item.id,
              partName: item.name,
              partNumber: item.partNumber || 'N/A',
              currentQuantity: currentQty,
              minimumQuantity: minQty,
              vesselName: vessel.name,
              estimatedCost: (item as any).unitCost || 0,
            });
          }
        }
      }

      return lowStockItems.sort((a, b) => {
        const aRatio = a.currentQuantity / (a.minimumQuantity || 1);
        const bRatio = b.currentQuantity / (b.minimumQuantity || 1);
        return aRatio - bRatio;
      });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to get low stock items', String(error));
      return [];
    }
  }

  private async getVesselBreakdown(
    orgId: string,
    vesselIds: string[] | null
  ): Promise<VesselInventorySummary[]> {
    try {
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      const summaries: VesselInventorySummary[] = [];

      for (const vessel of filteredVessels) {
        const inventory = await dbInventoryStorage.getParts(orgId);

        let totalValue = 0;
        let lowStockCount = 0;

        for (const item of inventory) {
          totalValue += ((item as any).quantity || 0) * ((item as any).unitCost || 0);

          const currentQty = (item as any).quantity || 0;
          const minQty = (item as any).minimumQuantity || (item as any).reorderPoint || 0;
          if (currentQty <= minQty) {
            lowStockCount++;
          }
        }

        summaries.push({
          vesselId: vessel.id,
          vesselName: vessel.name,
          totalParts: inventory.length,
          lowStockCount,
          totalValue,
        });
      }

      return summaries;
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to get vessel breakdown', String(error));
      return [];
    }
  }
}
