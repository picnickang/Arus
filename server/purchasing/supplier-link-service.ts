/**
 * Supplier Link Service
 * Linking and unlinking suppliers to parts
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { parts, suppliers } from "@shared/schema";
import * as repo from "./repository";
import type { InsertItemSupplier } from "./types";

export async function linkSupplierToPart(data: InsertItemSupplier) {
  const [part] = await db
    .select()
    .from(parts)
    .where(and(eq(parts.id, data.partId), eq(parts.orgId, data.orgId)));
  if (!part) {throw new Error("Part not found or does not belong to organization");}

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, data.supplierId), eq(suppliers.orgId, data.orgId)));
  if (!supplier) {throw new Error("Supplier not found or does not belong to organization");}

  return repo.linkItemSupplier(data);
}

export async function unlinkSupplierFromPart(
  partId: string,
  supplierId: string,
  orgId: string
) {
  return repo.unlinkItemSupplier(partId, supplierId, orgId);
}

export async function getPartSuppliers(partId: string, orgId: string) {
  return repo.getItemSuppliers(partId, orgId);
}
