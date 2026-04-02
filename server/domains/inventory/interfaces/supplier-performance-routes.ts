import { Router } from "express";
import { db } from "../../../db";
import { eq, and, sql } from "drizzle-orm";
import { suppliers, purchaseOrders } from "@shared/schema";
import { evaluateSupplierPerformance } from "../../../inventory-engine/supplier-performance.js";
import { asyncHandler } from "../../../lib/async-handler";
import { createLogger } from "../../../lib/structured-logger";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth";
import { createRateLimiter } from "../../../lib/rate-limit-factory";
import type { DeliveryHistoryRecord } from "../../../inventory-engine/types";

const logger = createLogger("supplier-performance-routes");
export const supplierPerformanceRouter = Router();

const generalLimit = createRateLimiter("general");
const CACHE_TTL = 5 * 60 * 1000;
const performanceCache = new Map<string, { data: unknown[]; expiresAt: number }>();

async function getActiveSuppliers(orgId: string) {
  return db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.orgId, orgId), eq(suppliers.isActive, true)))
    .limit(500);
}

async function getDeliveryHistory(orgId: string): Promise<DeliveryHistoryRecord[]> {
  const orders = await db
    .select({
      supplierId: purchaseOrders.supplierId,
      createdAt: purchaseOrders.createdAt,
      expectedDate: purchaseOrders.expectedDate,
    })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.orgId, orgId),
        eq(purchaseOrders.status, "received"),
        sql`${purchaseOrders.createdAt} IS NOT NULL`,
        sql`${purchaseOrders.expectedDate} IS NOT NULL`
      )
    );

  return orders.map((o) => ({
    supplierId: o.supplierId,
    orderDate: new Date(o.createdAt!),
    deliveryDate: new Date(o.expectedDate!),
    expectedDeliveryDate: new Date(o.expectedDate!),
    qualityScore: 7,
  }));
}

supplierPerformanceRouter.get(
  "/suppliers/performance-summary",
  requireOrgId,
  generalLimit,
  asyncHandler(async (req, res) => {
    const orgId = (req as AuthenticatedRequest).orgId!;

    const cached = performanceCache.get(orgId);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json(cached.data);
    }

    const activeSuppliers = await getActiveSuppliers(orgId);
    const deliveryHistory = await getDeliveryHistory(orgId);

    const performances = evaluateSupplierPerformance(activeSuppliers, deliveryHistory);

    const summary = performances.map((p) => ({
      supplierId: p.supplierId,
      name: p.name,
      performanceScore: p.performanceScore,
      onTimeRate: p.onTimeDeliveryRate,
      qualityRating: p.qualityRating,
      totalOrders: p.totalOrders,
      status: p.status,
    }));

    performanceCache.set(orgId, { data: summary, expiresAt: Date.now() + CACHE_TTL });
    res.json(summary);
  })
);
