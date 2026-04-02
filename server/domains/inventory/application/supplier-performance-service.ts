import { db } from "../../../db";
import { eq, and } from "drizzle-orm";
import { suppliers } from "@shared/schema";
import { evaluateSupplierPerformance } from "../../../inventory-engine/supplier-performance.js";

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

export async function getSupplierPerformanceSummaries(orgId: string): Promise<SupplierPerformanceSummaryDTO[]> {
  const cached = cache.get(orgId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const activeSuppliers = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.orgId, orgId), eq(suppliers.isActive, true)))
    .limit(500);

  const performances = evaluateSupplierPerformance(activeSuppliers, []);

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
