import { and, eq, getTableColumns, gte, lte, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { WorkOrderCompletion } from "@shared/schema";
import { equipment, vessels, workOrders } from "@shared/schema-runtime";
import { dbWorkOrderStorage } from "../../../db/workorders/index.js";
import { createLogger } from "../../../lib/structured-logger";
import { ilike } from "../../../utils/sql-compat";
import type {
  WorkOrderCompletionAnalytics,
  WorkOrderCompletionAnalyticsFilters,
  WorkOrderFilters,
  WorkOrderPaginationResult,
  WorkOrderWithDetails,
} from "./types";

const logger = createLogger("Services:Domains:WorkOrderService");
type WorkOrderDb = typeof import("../../../db-config").db;

function buildWorkOrderConditions(
  equipmentId?: string,
  orgId?: string,
  filters?: WorkOrderFilters
): SQL[] {
  const conditions: SQL[] = [];
  if (equipmentId) {
    conditions.push(eq(workOrders.equipmentId, equipmentId));
  }
  if (orgId) {
    conditions.push(eq(workOrders.orgId, orgId));
  }
  if (filters?.vesselId) {
    conditions.push(eq(workOrders.vesselId, filters.vesselId));
  }
  if (filters?.assignedCrewId) {
    conditions.push(eq(workOrders.assignedCrewId, filters.assignedCrewId));
  }
  if (filters?.status && filters.status !== "all") {
    conditions.push(eq(workOrders.status, filters.status));
  }
  if (filters?.priority && filters.priority !== "all") {
    conditions.push(eq(workOrders.priority, Number.parseInt(filters.priority, 10)));
  }
  if (filters?.dueDateFrom) {
    conditions.push(gte(workOrders.plannedEndDate, filters.dueDateFrom));
  }
  if (filters?.dueDateTo) {
    conditions.push(lte(workOrders.plannedEndDate, filters.dueDateTo));
  }
  if (filters?.equipmentCategory && filters.equipmentCategory !== "all") {
    conditions.push(eq(equipment.type, filters.equipmentCategory));
  }
  if (filters?.workOrderType && filters.workOrderType !== "all") {
    conditions.push(eq(workOrders.workOrderType, filters.workOrderType));
  }
  if (filters?.search?.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    const orClause = or(
      ilike(workOrders.reason, term),
      ilike(workOrders.description, term),
      ilike(workOrders.woNumber, term)
    );
    if (orClause) {
      conditions.push(orClause);
    }
  }
  return conditions;
}

function withGeneratedWorkOrderNumber(wo: WorkOrderWithDetails): WorkOrderWithDetails {
  if (!wo.woNumber) {
    const year = wo.createdAt ? new Date(wo.createdAt).getFullYear() : new Date().getFullYear();
    const ts = wo.createdAt ? new Date(wo.createdAt).getTime() : Date.now();
    return { ...wo, woNumber: `WO-${year}-${String(Math.abs(ts % 10000)).padStart(4, "0")}` };
  }
  return wo;
}

export async function getWorkOrdersWithDetails(
  db: WorkOrderDb,
  equipmentId?: string,
  orgId?: string,
  filters?: WorkOrderFilters
): Promise<WorkOrderWithDetails[]> {
  try {
    const baseQuery = db
      .select({
        ...getTableColumns(workOrders),
        equipmentName: equipment.name,
        equipmentType: equipment.type,
        vesselName: vessels.name,
      })
      .from(workOrders)
      .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
      .leftJoin(vessels, eq(workOrders.vesselId, vessels.id));

    const conditions = buildWorkOrderConditions(equipmentId, orgId, filters);
    const filtered = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const results = await filtered.orderBy(sql`${workOrders.createdAt} DESC`);

    const detailedResults: WorkOrderWithDetails[] = results as never;
    return detailedResults.map(withGeneratedWorkOrderNumber);
  } catch (error) {
    logger.error("[WorkOrderService.getWorkOrdersWithDetails] Error:", undefined, error);
    throw error;
  }
}

export async function getWorkOrdersPaginated(
  db: WorkOrderDb,
  equipmentId: string | undefined,
  orgId: string | undefined,
  limit: number,
  offset: number,
  filters?: WorkOrderFilters
): Promise<WorkOrderPaginationResult> {
  try {
    const conditions = buildWorkOrderConditions(equipmentId, orgId, filters);
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(workOrders)
      .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id));
    const countResult =
      conditions.length > 0 ? await countQuery.where(and(...conditions)) : await countQuery;
    const total = Number(countResult[0]?.count ?? 0);

    const baseQuery = db
      .select({
        ...getTableColumns(workOrders),
        equipmentName: equipment.name,
        equipmentType: equipment.type,
        vesselName: vessels.name,
      })
      .from(workOrders)
      .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
      .leftJoin(vessels, eq(workOrders.vesselId, vessels.id));

    const filtered = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const results = await filtered
      .orderBy(sql`${workOrders.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const detailedItems: WorkOrderWithDetails[] = results as never;
    const items = detailedItems.map(withGeneratedWorkOrderNumber);

    return { items, total };
  } catch (error) {
    logger.error("[WorkOrderService.getWorkOrdersPaginated] Error:", undefined, error);
    throw error;
  }
}

export async function getWorkOrderCompletionAnalytics(
  _db: WorkOrderDb,
  filters?: WorkOrderCompletionAnalyticsFilters
): Promise<WorkOrderCompletionAnalytics> {
  const completions = await dbWorkOrderStorage.getWorkOrderCompletions(filters);
  if (completions.length === 0) {
    return {
      totalCompletions: 0,
      avgDurationVariance: 0,
      avgCostVariance: 0,
      onTimeCompletionRate: 0,
      totalDowntimeHours: 0,
    };
  }
  type CompletionExt = WorkOrderCompletion & {
    durationVariancePercent?: number | null;
    costVariancePercent?: number | null;
    onTimeCompletion?: boolean | null;
  };
  const cExt: CompletionExt[] = completions as never;
  const dv = cExt
      .filter((x) => x.durationVariancePercent != null)
      .map((x) => x.durationVariancePercent as number),
    cv = cExt
      .filter((x) => x.costVariancePercent != null)
      .map((x) => x.costVariancePercent as number),
    ot = cExt.filter((x) => x.onTimeCompletion === true).length,
    td = cExt.reduce((s, x) => s + (x.actualDowntimeHours || 0), 0);
  return {
    totalCompletions: completions.length,
    avgDurationVariance: dv.length > 0 ? dv.reduce((a, b) => a + b, 0) / dv.length : 0,
    avgCostVariance: cv.length > 0 ? cv.reduce((a, b) => a + b, 0) / cv.length : 0,
    onTimeCompletionRate: completions.length > 0 ? (ot / completions.length) * 100 : 0,
    totalDowntimeHours: td,
  };
}
