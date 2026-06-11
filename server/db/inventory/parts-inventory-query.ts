import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "../../db-config";
import { parts as partsTable, stock } from "@shared/schema-runtime";
import type { Part, PartsInventory, Stock } from "@shared/schema-runtime";
import { partAndStockToPartsInventory } from "./db-parts.js";

export async function partAndStockAsPartsInventory(
  orgId?: string,
  opts?: {
    category?: string | undefined;
    search?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }
): Promise<PartsInventory[]> {
  const conditions: SQL<unknown>[] = [];
  if (orgId) {
    conditions.push(eq(partsTable.orgId, orgId));
  }
  if (opts?.category) {
    conditions.push(eq(partsTable.category, opts.category));
  }
  if (opts?.search) {
    const searchCond = or(
      ilike(partsTable.name, `%${opts.search}%`),
      ilike(partsTable.partNo, `%${opts.search}%`)
    );
    if (searchCond) {
      conditions.push(searchCond);
    }
  }
  const orderCol =
    opts?.sortBy === "partName"
      ? partsTable.name
      : opts?.sortBy === "category"
        ? partsTable.category
        : partsTable.name;
  const orderFn = opts?.sortOrder === "desc" ? desc(orderCol) : asc(orderCol);

  let partsQuery = db.select().from(partsTable);
  if (conditions.length > 0) {
    partsQuery = partsQuery.where(and(...conditions)) as typeof partsQuery;
  }
  let orderedParts = partsQuery.orderBy(orderFn);
  if (opts?.limit) {
    orderedParts = orderedParts.limit(opts.limit) as typeof orderedParts;
  }
  if (opts?.offset) {
    orderedParts = orderedParts.offset(opts.offset) as typeof orderedParts;
  }
  const partRows = await orderedParts;

  if (partRows.length === 0) {
    return [];
  }

  const partIds = partRows.map((p: Part) => p.id);
  const partIdsArray = sql`ARRAY[${sql.join(
    partIds.map((id: string) => sql`${id}`),
    sql`, `
  )}]::text[]`;
  const stockRows = await db
    .select()
    .from(stock)
    .where(sql`${stock.partId} = ANY(${partIdsArray})`);
  const stockMap = new Map<string, Stock[]>();
  for (const s of stockRows) {
    const arr = stockMap.get(s.partId) || [];
    arr.push(s);
    stockMap.set(s.partId, arr);
  }

  return partRows.map((p: Part) => partAndStockToPartsInventory(p, stockMap.get(p.id) || []));
}
