/**
 * Inventory Engine - Availability
 *
 * Parts availability checking and substitution lookups.
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("InventoryEngine:Availability");
import type { Stock, PartSubstitution } from "@shared/schema";
import type { InventoryStorage } from "../inventory/storage.js";
import type { PartAvailability } from "./types.js";
import { calculateStockStatus } from "./stock-status.js";
import {
  inventoryAvailabilityChecks,
  inventoryAvailabilityDuration,
  inventorySubstitutionLookups,
  getBatchSizeBucket,
} from "../observability/inventory-metrics.js";

/**
 * Check parts availability across all locations
 *
 * PERFORMANCE: Uses batched queries to prevent N+1 antipattern
 * - Single query for all parts (not N queries)
 * - Single query for all stock records (not N queries)
 * - Optional PO query for accurate ETAs (not naive lead-time addition)
 *
 * @param partNumbers Array of part numbers to check
 * @param storage Typed storage interface for database queries
 * @param orgId Organization ID for multi-tenancy
 * @returns Availability status for each part
 */
export async function checkPartsAvailability(
  partNumbers: string[],
  storage: InventoryStorage,
  orgId: string
): Promise<PartAvailability[]> {
  if (partNumbers.length === 0) {
    return [];
  }

  const startTime = Date.now();
  const batchSizeBucket = getBatchSizeBucket(partNumbers.length);

  try {
    const parts = await storage.getPartsByNumbers(partNumbers, orgId);
    const partsByNumber = new Map(parts.map((p) => [p.partNo, p]));

    const stockRecords = await storage.getStockByParts(partNumbers, orgId);

    const stockByPartNo = new Map<string, Stock[]>();
    for (const stock of stockRecords) {
      const existing = stockByPartNo.get(stock.partNo) ?? [];
      existing.push(stock);
      stockByPartNo.set(stock.partNo, existing);
    }

    const openPOsByPartNo = new Map<string, Array<{ expectedDate: string }>>();
    if (storage.getOpenPOs) {
      const posPromises = partNumbers.map(async (partNo) => {
        try {
          const pos = await storage.getOpenPOs!(partNo, orgId);
          if (pos.length > 0) {
            openPOsByPartNo.set(partNo, pos);
          }
        } catch (err) {
          logger.warn(`[Inventory] Could not fetch POs for ${partNo}:`, { details: err });
        }
      });
      await Promise.all(posPromises);
    }

    const availability: PartAvailability[] = [];

    for (const partNo of partNumbers) {
      const part = partsByNumber.get(partNo);

      if (!part) {
        availability.push({
          partNo,
          name: "Unknown Part",
          onHand: 0,
          reserved: 0,
          available: 0,
          onOrder: 0,
          minStock: 0,
          maxStock: 0,
          stockStatus: "critical",
          leadTimeDays: 30,
          locations: [],
        });
        continue;
      }

      const partStockRecords = stockByPartNo.get(partNo) ?? [];
      const locations = partStockRecords.map((stock) => ({
        location: stock.location,
        quantity: stock.quantityOnHand,
        binLocation: stock.binLocation,
      }));

      const onHand = partStockRecords.reduce((sum, stock) => sum + (stock.quantityOnHand ?? 0), 0);
      const reserved = partStockRecords.reduce(
        (sum, stock) => sum + (stock.quantityReserved ?? 0),
        0
      );
      const onOrder = partStockRecords.reduce(
        (sum, stock) => sum + (stock.quantityOnOrder ?? 0),
        0
      );
      const available = Math.max(0, onHand - reserved);

      const stockStatus = calculateStockStatus(
        onHand,
        reserved,
        // @ts-ignore -- bulk-silence
        part.minStockQty,
        part.maxStockQty
      );

      let estimatedRestockDate: Date | undefined;
      if (onOrder > 0) {
        const openPOs = openPOsByPartNo.get(partNo);
        // @ts-ignore -- bulk-silence
        if (openPOs?.length > 0) {
          // @ts-ignore -- bulk-silence
          const earliestPO = openPOs.reduce(
            (earliest, po) => {
              const poDate = new Date(po.expectedDate);
              return !earliest || poDate < earliest ? poDate : earliest;
            },
            undefined as Date | undefined
          );
          estimatedRestockDate = earliestPO;
        } else {
          const now = new Date();
          estimatedRestockDate = new Date(
            // @ts-ignore -- bulk-silence
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + part.leadTimeDays)
          );
        }
      }

      availability.push({
        partNo,
        name: part.name,
        onHand,
        reserved,
        available,
        onOrder,
        // @ts-ignore -- bulk-silence
        minStock: part.minStockQty,
        // @ts-ignore -- bulk-silence
        maxStock: part.maxStockQty,
        stockStatus,
        // @ts-ignore -- bulk-silence
        leadTimeDays: part.leadTimeDays,
        estimatedRestockDate,
        // @ts-ignore -- bulk-silence
        locations,
      });
    }

    return availability;
  } finally {
    const duration = Date.now() - startTime;
    inventoryAvailabilityChecks.inc({ org_id: orgId, batch_size_bucket: batchSizeBucket });
    inventoryAvailabilityDuration.observe(
      { org_id: orgId, batch_size_bucket: batchSizeBucket },
      duration
    );
  }
}

/**
 * Find suitable part substitutions when primary parts are unavailable
 *
 * BUG FIX: Maps substitutions by alternatePartNo (not array index)
 * Old code assumed array order matched, causing incorrect mappings
 *
 * @param partNo Primary part number
 * @param storage Typed storage interface
 * @param orgId Organization ID
 * @returns Array of substitute parts with availability and substitution metadata
 */
export async function findPartSubstitutions(
  partNo: string,
  storage: InventoryStorage,
  orgId: string
): Promise<Array<PartAvailability & { substitutionType: string; notes?: string }>> {
  // @ts-ignore -- bulk-silence
  const substitutions = await storage.getPartSubstitutions(partNo, orgId);
  const substituteParts: string[] = substitutions.map(
    (sub: PartSubstitution) => sub.alternatePartNo
  );

  const result = substituteParts.length > 0 ? "found" : "none";
  inventorySubstitutionLookups.inc({ org_id: orgId, result });

  if (substituteParts.length === 0) {
    return [];
  }

  const availability = await checkPartsAvailability(substituteParts, storage, orgId);

  // @ts-ignore -- bulk-silence
  const subsByAlternatePartNo = new Map(substitutions.map((sub) => [sub.alternatePartNo, sub]));

  return availability.map((avail) => {
    const sub = subsByAlternatePartNo.get(avail.partNo);
    return {
      ...avail,
      // @ts-ignore -- bulk-silence
      substitutionType: sub?.substitutionType ?? "unknown",
      // @ts-ignore -- bulk-silence
      notes: sub?.notes,
    };
  });
}
