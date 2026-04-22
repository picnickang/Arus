import { db } from "../../../db";
import { eq, and, sql } from "drizzle-orm";
import { suppliers, purchaseOrders } from "@shared/schema";
import { evaluateSupplierPerformance } from "../../../inventory-engine/supplier-performance.js";
import type { DeliveryHistoryRecord } from "../../../inventory-engine/types";

export interface SupplierPerformanceSummaryDTO {
  supplierId: string;
  name: string;
  performanceScore: number;
  onTimeRate: number;
  qualityRating: number;
  totalOrders: number;
  status: string;
}

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: SupplierPerformanceSummaryDTO[]; expiresAt: number }>();

async function buildDeliveryHistory(
  orgId: string,
  supplierMap: Map<string, number>
): Promise<DeliveryHistoryRecord[]> {
  const receivedOrders = await db
    .select({
      supplierId: purchaseOrders.supplierId,
      createdAt: purchaseOrders.createdAt,
      expectedDate: purchaseOrders.expectedDate,
      updatedAt: purchaseOrders.updatedAt,
    })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.orgId, orgId),
        eq(purchaseOrders.status, "received"),
        sql`${purchaseOrders.expectedDate} IS NOT NULL`
      )
    );

  return receivedOrders
    .filter((o) => o.createdAt && o.expectedDate)
    .map((o) => ({
      supplierId: o.supplierId,
      orderDate: new Date(o.createdAt!),
      deliveryDate: o.updatedAt ? new Date(o.updatedAt) : new Date(o.expectedDate!),
      expectedDeliveryDate: new Date(o.expectedDate!),
      qualityScore: supplierMap.get(o.supplierId) ?? 0,
    }));
}

export async function getSupplierPerformanceSummaries(
  orgId: string
): Promise<SupplierPerformanceSummaryDTO[]> {
  const cached = cache.get(orgId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const activeSuppliers = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.orgId, orgId), eq(suppliers.isActive, true)));
  const supplierQualityMap = new Map(activeSuppliers.map((s) => [s.id, s.qualityRating ?? 0]));

  const deliveryHistory = await buildDeliveryHistory(orgId, supplierQualityMap);

  const performances = evaluateSupplierPerformance(activeSuppliers, deliveryHistory);

  const summaries: SupplierPerformanceSummaryDTO[] = performances.map((p) => ({
    supplierId: p.supplierId,
    name: p.name,
    performanceScore: p.performanceScore,
    onTimeRate: p.onTimeDeliveryRate,
    qualityRating: p.qualityRating,
    totalOrders: p.totalOrders,
    status: p.status,
  }));

  cache.set(orgId, { data: summaries, expiresAt: Date.now() + CACHE_TTL });
  return summaries;
}
