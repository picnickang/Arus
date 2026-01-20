/**
 * Work Order Parts Enrichment Service
 * 
 * Enriches work order parts with stock status, part details, and delivery estimates.
 * Follows modular architecture pattern - max 300 lines.
 */

import { db } from "../../../db/index.js";
import { workOrderParts, parts, partsInventory, suppliers } from "@shared/schema.js";
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

interface InventoryItem {
  id: string;
  partNumber: string;
  partName: string;
  quantityOnHand: number;
  minStockLevel: number | null;
  unitCost: number;
  supplierName: string | null;
  leadTimeDays: number | null;
}

function aggregateInventoryByPartNumber(inventoryData: InventoryItem[]): Map<string, InventoryItem> {
  const result = new Map<string, InventoryItem>();
  for (const inv of inventoryData) {
    const existing = result.get(inv.partNumber);
    if (existing) {
      existing.quantityOnHand += inv.quantityOnHand;
    } else {
      result.set(inv.partNumber, { ...inv });
    }
  }
  return result;
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

  const inventoryData = await db
    .select({
      id: partsInventory.id,
      partNumber: partsInventory.partNumber,
      partName: partsInventory.partName,
      quantityOnHand: partsInventory.quantityOnHand,
      minStockLevel: partsInventory.minStockLevel,
      unitCost: partsInventory.unitCost,
      supplierName: partsInventory.supplierName,
      leadTimeDays: partsInventory.leadTimeDays,
    })
    .from(partsInventory)
    .where(and(eq(partsInventory.orgId, orgId), inArray(partsInventory.partNumber, partNumbers)));

  const inventoryByPartNoMap = aggregateInventoryByPartNumber(inventoryData);

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
    const invItem = catalogPart ? inventoryByPartNoMap.get(catalogPart.partNo) : null;
    const quantityOnHand = invItem?.quantityOnHand ?? 0;
    const supplierInfo = catalogPart?.primarySupplierId ? suppliersMap.get(catalogPart.primarySupplierId) : null;

    return {
      id: wop.id,
      workOrderId: wop.workOrderId,
      partId: wop.partId,
      partNo: catalogPart?.partNo || wop.partId,
      partName: catalogPart?.name || invItem?.partName || "Unknown Part",
      quantityUsed: wop.quantityUsed,
      quantityOnHand,
      unitCost: wop.unitCost || invItem?.unitCost || 0,
      totalCost: wop.totalCost || 0,
      stockStatus: determineStockStatus(quantityOnHand, catalogPart?.minStockQty || invItem?.minStockLevel || null),
      estimatedDeliveryDate: wop.estimatedDeliveryDate,
      actualDeliveryDate: wop.actualDeliveryDate,
      deliveryStatus: wop.deliveryStatus,
      supplierName: supplierInfo?.name || invItem?.supplierName || null,
      supplierLeadTimeDays: supplierInfo?.leadTimeDays || invItem?.leadTimeDays || null,
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

  const inventoryData = await db
    .select({
      id: partsInventory.id,
      partNumber: partsInventory.partNumber,
      partName: partsInventory.partName,
      quantityOnHand: partsInventory.quantityOnHand,
      minStockLevel: partsInventory.minStockLevel,
      unitCost: partsInventory.unitCost,
      supplierName: partsInventory.supplierName,
      leadTimeDays: partsInventory.leadTimeDays,
    })
    .from(partsInventory)
    .where(and(eq(partsInventory.orgId, orgId), inArray(partsInventory.partNumber, partNumbers)));

  const inventoryByPartNoMap = aggregateInventoryByPartNumber(inventoryData);

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
    const invItem = catalogPart ? inventoryByPartNoMap.get(catalogPart.partNo) : null;
    const quantityOnHand = invItem?.quantityOnHand ?? 0;
    const supplierInfo = catalogPart?.primarySupplierId ? suppliersMap.get(catalogPart.primarySupplierId) : null;
    const hasValidInventory = invItem !== null && invItem !== undefined;

    return {
      id: wop.id,
      workOrderId: wop.workOrderId,
      partId: wop.partId,
      inventoryItemId: invItem?.id || null,
      hasValidInventory,
      partNo: catalogPart?.partNo || wop.partId,
      partName: catalogPart?.name || invItem?.partName || "Unknown Part",
      quantityUsed: wop.quantityUsed,
      quantityOnHand,
      unitCost: wop.unitCost || invItem?.unitCost || 0,
      totalCost: wop.totalCost || 0,
      stockStatus: determineStockStatus(quantityOnHand, catalogPart?.minStockQty || invItem?.minStockLevel || null),
      estimatedDeliveryDate: wop.estimatedDeliveryDate,
      actualDeliveryDate: wop.actualDeliveryDate,
      deliveryStatus: wop.deliveryStatus,
      supplierName: supplierInfo?.name || invItem?.supplierName || null,
      supplierLeadTimeDays: supplierInfo?.leadTimeDays || invItem?.leadTimeDays || null,
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
