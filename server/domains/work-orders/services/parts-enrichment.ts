/**
 * Work Order Parts Enrichment Service
 * 
 * Enriches work order parts with stock status, part details, and delivery estimates.
 * Follows modular architecture pattern - max 300 lines.
 */

import { db } from "../../../db/index.js";
import { workOrderParts, parts, stock, suppliers } from "@shared/schema.js";
import { eq, and, inArray } from "drizzle-orm";

export interface EnrichedWorkOrderPart {
  id: string;
  workOrderId: string;
  partId: string;
  partNo: string;
  partName: string;
  quantityUsed: number;
  quantityOnHand: number;
  unitCost: number;
  totalCost: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  estimatedDeliveryDate: Date | null;
  actualDeliveryDate: Date | null;
  deliveryStatus: string | null;
  supplierName: string | null;
  supplierLeadTimeDays: number | null;
  notes: string | null;
  usedBy: string | null;
  usedAt: Date | null;
}

export interface OutOfStockSuggestion {
  partId: string;
  partNo: string;
  partName: string;
  quantityNeeded: number;
  quantityOnHand: number;
  shortfall: number;
  suggestedOrderQuantity: number;
  supplierLeadTimeDays: number | null;
}

function determineStockStatus(quantityOnHand: number, minStockLevel: number | null): "in_stock" | "low_stock" | "out_of_stock" {
  if (quantityOnHand <= 0) return "out_of_stock";
  if (minStockLevel && quantityOnHand <= minStockLevel) return "low_stock";
  return "in_stock";
}


export async function getEnrichedWorkOrderParts(workOrderId: string, orgId: string): Promise<EnrichedWorkOrderPart[]> {
  const woParts = await db
    .select({
      id: workOrderParts.id,
      workOrderId: workOrderParts.workOrderId,
      partId: workOrderParts.partId,
      quantityUsed: workOrderParts.quantityUsed,
      unitCost: workOrderParts.unitCost,
      totalCost: workOrderParts.totalCost,
      notes: workOrderParts.notes,
      usedBy: workOrderParts.usedBy,
      usedAt: workOrderParts.usedAt,
      estimatedDeliveryDate: workOrderParts.estimatedDeliveryDate,
      actualDeliveryDate: workOrderParts.actualDeliveryDate,
      deliveryStatus: workOrderParts.deliveryStatus,
      supplierId: workOrderParts.supplierId,
    })
    .from(workOrderParts)
    .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

  if (woParts.length === 0) return [];

  const partIds = woParts.map((p) => p.partId);

  const catalogParts = await db
    .select({
      id: parts.id,
      partNo: parts.partNo,
      name: parts.name,
      minStockQty: parts.minStockQty,
      primarySupplierId: parts.primarySupplierId,
    })
    .from(parts)
    .where(inArray(parts.id, partIds));

  const catalogMap = new Map(catalogParts.map((p) => [p.id, p]));
  const partNumbers = catalogParts.map((p) => p.partNo);

  const stockData = await db
    .select({
      id: stock.id,
      partId: stock.partId,
      partNo: stock.partNo,
      quantityOnHand: stock.quantityOnHand,
      unitCost: stock.unitCost,
    })
    .from(stock)
    .where(and(eq(stock.orgId, orgId), inArray(stock.partNo, partNumbers)));

  const stockByPartNoMap = new Map<string, { quantityOnHand: number; unitCost: number | null }>();
  for (const s of stockData) {
    const key = s.partNo;
    const existing = stockByPartNoMap.get(key);
    stockByPartNoMap.set(key, {
      quantityOnHand: (existing?.quantityOnHand ?? 0) + (s.quantityOnHand ?? 0),
      unitCost: s.unitCost ?? existing?.unitCost ?? null,
    });
  }

  const supplierIds = [...new Set(catalogParts.map((p) => p.primarySupplierId).filter(Boolean))] as string[];
  let suppliersMap = new Map<string, { name: string; leadTimeDays: number | null }>();
  if (supplierIds.length > 0) {
    const suppliersData = await db
      .select({ id: suppliers.id, name: suppliers.name, leadTimeDays: suppliers.leadTimeDays })
      .from(suppliers)
      .where(inArray(suppliers.id, supplierIds));
    suppliersMap = new Map(suppliersData.map((s) => [s.id, { name: s.name, leadTimeDays: s.leadTimeDays }]));
  }

  return woParts.map((wop) => {
    const catalogPart = catalogMap.get(wop.partId);
    const invItem = catalogPart ? stockByPartNoMap.get(catalogPart.partNo) : null;
    const quantityOnHand = invItem?.quantityOnHand ?? 0;
    const supplierInfo = catalogPart?.primarySupplierId ? suppliersMap.get(catalogPart.primarySupplierId) : null;

    return {
      id: wop.id,
      workOrderId: wop.workOrderId,
      partId: wop.partId,
      partNo: catalogPart?.partNo || wop.partId,
      partName: catalogPart?.name || "Unknown Part",
      quantityUsed: wop.quantityUsed,
      quantityOnHand,
      unitCost: wop.unitCost || invItem?.unitCost || 0,
      totalCost: wop.totalCost || 0,
      stockStatus: determineStockStatus(quantityOnHand, catalogPart?.minStockQty || null),
      estimatedDeliveryDate: wop.estimatedDeliveryDate,
      actualDeliveryDate: wop.actualDeliveryDate,
      deliveryStatus: wop.deliveryStatus,
      supplierName: supplierInfo?.name || null,
      supplierLeadTimeDays: supplierInfo?.leadTimeDays || null,
      notes: wop.notes,
      usedBy: wop.usedBy,
      usedAt: wop.usedAt,
    };
  });
}

export interface EnrichedWorkOrderPartWithInventory extends EnrichedWorkOrderPart {
  hasValidInventory: boolean;
  inventoryItemId: string | null;
}

export async function getEnrichedWorkOrderPartsWithInventoryFlag(workOrderId: string, orgId: string): Promise<EnrichedWorkOrderPartWithInventory[]> {
  const woParts = await db
    .select({
      id: workOrderParts.id,
      workOrderId: workOrderParts.workOrderId,
      partId: workOrderParts.partId,
      quantityUsed: workOrderParts.quantityUsed,
      unitCost: workOrderParts.unitCost,
      totalCost: workOrderParts.totalCost,
      notes: workOrderParts.notes,
      usedBy: workOrderParts.usedBy,
      usedAt: workOrderParts.usedAt,
      estimatedDeliveryDate: workOrderParts.estimatedDeliveryDate,
      actualDeliveryDate: workOrderParts.actualDeliveryDate,
      deliveryStatus: workOrderParts.deliveryStatus,
      supplierId: workOrderParts.supplierId,
    })
    .from(workOrderParts)
    .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

  if (woParts.length === 0) return [];

  const partIds = woParts.map((p) => p.partId);

  const catalogParts = await db
    .select({
      id: parts.id,
      partNo: parts.partNo,
      name: parts.name,
      minStockQty: parts.minStockQty,
      primarySupplierId: parts.primarySupplierId,
    })
    .from(parts)
    .where(inArray(parts.id, partIds));

  const catalogMap = new Map(catalogParts.map((p) => [p.id, p]));
  const partNumbers = catalogParts.map((p) => p.partNo);

  const stockData = await db
    .select({
      id: stock.id,
      partId: stock.partId,
      partNo: stock.partNo,
      quantityOnHand: stock.quantityOnHand,
      unitCost: stock.unitCost,
    })
    .from(stock)
    .where(and(eq(stock.orgId, orgId), inArray(stock.partNo, partNumbers)));

  const stockByPartNoMap = new Map<string, { quantityOnHand: number; unitCost: number | null }>();
  for (const s of stockData) {
    const key = s.partNo;
    const existing = stockByPartNoMap.get(key);
    stockByPartNoMap.set(key, {
      quantityOnHand: (existing?.quantityOnHand ?? 0) + (s.quantityOnHand ?? 0),
      unitCost: s.unitCost ?? existing?.unitCost ?? null,
    });
  }

  const supplierIds = [...new Set(catalogParts.map((p) => p.primarySupplierId).filter(Boolean))] as string[];
  let suppliersMap = new Map<string, { name: string; leadTimeDays: number | null }>();
  if (supplierIds.length > 0) {
    const suppliersData = await db
      .select({ id: suppliers.id, name: suppliers.name, leadTimeDays: suppliers.leadTimeDays })
      .from(suppliers)
      .where(inArray(suppliers.id, supplierIds));
    suppliersMap = new Map(suppliersData.map((s) => [s.id, { name: s.name, leadTimeDays: s.leadTimeDays }]));
  }

  return woParts.map((wop) => {
    const catalogPart = catalogMap.get(wop.partId);
    const invItem = catalogPart ? stockByPartNoMap.get(catalogPart.partNo) : null;
    const quantityOnHand = invItem?.quantityOnHand ?? 0;
    const supplierInfo = catalogPart?.primarySupplierId ? suppliersMap.get(catalogPart.primarySupplierId) : null;
    const hasValidInventory = invItem !== null && invItem !== undefined;

    return {
      id: wop.id,
      workOrderId: wop.workOrderId,
      partId: wop.partId,
      inventoryItemId: wop.partId || null,
      hasValidInventory,
      partNo: catalogPart?.partNo || wop.partId,
      partName: catalogPart?.name || "Unknown Part",
      quantityUsed: wop.quantityUsed,
      quantityOnHand,
      unitCost: wop.unitCost || invItem?.unitCost || 0,
      totalCost: wop.totalCost || 0,
      stockStatus: determineStockStatus(quantityOnHand, catalogPart?.minStockQty || null),
      estimatedDeliveryDate: wop.estimatedDeliveryDate,
      actualDeliveryDate: wop.actualDeliveryDate,
      deliveryStatus: wop.deliveryStatus,
      supplierName: supplierInfo?.name || null,
      supplierLeadTimeDays: supplierInfo?.leadTimeDays || null,
      notes: wop.notes,
      usedBy: wop.usedBy,
      usedAt: wop.usedAt,
    };
  });
}

export async function getOutOfStockSuggestions(workOrderId: string, orgId: string): Promise<OutOfStockSuggestion[]> {
  const enrichedParts = await getEnrichedWorkOrderPartsWithInventoryFlag(workOrderId, orgId);

  return enrichedParts
    .filter((p) => 
      p.hasValidInventory && 
      p.inventoryItemId &&
      (p.stockStatus === "out_of_stock" || p.quantityUsed > p.quantityOnHand)
    )
    .map((p) => {
      const shortfall = Math.max(0, p.quantityUsed - p.quantityOnHand);
      return {
        partId: p.inventoryItemId!,
        partNo: p.partNo,
        partName: p.partName,
        quantityNeeded: p.quantityUsed,
        quantityOnHand: p.quantityOnHand,
        shortfall,
        suggestedOrderQuantity: shortfall,
        supplierLeadTimeDays: p.supplierLeadTimeDays,
      };
    });
}
