// @ts-nocheck
/**
 * Parts Repository - Manages parts inventory and compatibility
 * Production-ready implementation for parts-related operations
 */

import { db } from "../../db";
import { eq, and, or, sql } from "drizzle-orm";
import { TenantScopedRepository } from "./base";

export class PartsRepository extends TenantScopedRepository {
  /**
   * Get all parts for this organization
   * Optionally filter by category or criticality
   */
  async getAll(filters?: { category?: string; criticality?: string }) {
    const { parts } = await import("@shared/schema");

    let whereClause = this.orgWhere(parts);

    if (filters?.category) {
      whereClause = and(whereClause, eq(parts.category, filters.category));
    }

    if (filters?.criticality) {
      whereClause = and(whereClause, eq(parts.criticality, filters.criticality));
    }

    return db.select().from(parts).where(whereClause).orderBy(parts.name);
  }

  /**
   * Get part by ID
   */
  async getById(id: string) {
    const { parts } = await import("@shared/schema");

    const result = await db
      .select()
      .from(parts)
      .where(this.orgWhere(parts, eq(parts.id, id)))
      .limit(1);

    return result[0];
  }

  /**
   * Get compatible parts for specific equipment
   */
  async getCompatibleParts(equipmentId: string) {
    const { parts } = await import("@shared/schema");

    return db
      .select()
      .from(parts)
      .where(this.orgWhere(parts, sql`${equipmentId} = ANY(${parts.compatibleEquipment})`))
      .orderBy(parts.criticality, parts.name);
  }

  /**
   * Get suggested parts based on equipment type and criticality
   */
  async getSuggestedParts(equipmentId: string) {
    const { parts, stock } = await import("@shared/schema");

    const suggestions = await db
      .select({
        part: parts,
        currentStock: stock.quantityOnHand,
        stockLocation: stock.location,
      })
      .from(parts)
      .leftJoin(stock, and(eq(parts.id, stock.partId), eq(stock.orgId, this.orgId)))
      .where(
        this.orgWhere(
          parts,
          and(
            sql`${equipmentId} = ANY(${parts.compatibleEquipment})`,
            or(
              sql`${stock.quantityOnHand} < ${parts.minStockQty}`,
              sql`${stock.quantityOnHand} IS NULL`
            )
          )
        )
      )
      .orderBy(
        sql`CASE ${parts.criticality} 
             WHEN 'critical' THEN 1 
             WHEN 'high' THEN 2 
             WHEN 'medium' THEN 3 
             ELSE 4 END`,
        sql`CASE ${parts.riskLevel} 
             WHEN 'critical' THEN 1 
             WHEN 'high' THEN 2 
             WHEN 'medium' THEN 3 
             ELSE 4 END`,
        parts.name
      );

    return suggestions.map((s) => ({
      ...s.part,
      currentStock: s.currentStock ?? 0,
      stockLocation: s.stockLocation,
      urgency: this.calculateUrgency(s.part, s.currentStock ?? 0),
    }));
  }

  /**
   * Calculate urgency level for parts ordering
   */
  private calculateUrgency(
    part: any,
    currentStock: number
  ): "critical" | "high" | "medium" | "low" {
    const minStock = part.minStockQty ?? 0;
    const criticality = part.criticality || "medium";

    if (currentStock === 0 && (criticality === "critical" || criticality === "high")) {
      return "critical";
    }

    if (currentStock < minStock && criticality === "critical") {
      return "critical";
    }

    if (currentStock < minStock && criticality === "high") {
      return "high";
    }

    if (currentStock < minStock) {
      return "medium";
    }

    return "low";
  }

  /**
   * Create part
   * Automatically sets orgId
   */
  async create(data: Omit<any, "id" | "orgId">) {
    const { parts } = await import("@shared/schema");

    const [created] = await db
      .insert(parts)
      .values({
        ...data,
        orgId: this.orgId,
      })
      .returning();

    return created;
  }

  /**
   * Update part
   * Validates ownership before update
   */
  async update(id: string, data: Partial<any>) {
    const { parts } = await import("@shared/schema");

    const existing = await this.getById(id);
    if (!existing) {
      throw new Error("Part not found");
    }

    const [updated] = await db
      .update(parts)
      .set(data)
      .where(this.orgWhere(parts, eq(parts.id, id)))
      .returning();

    return updated;
  }

  /**
   * Delete part
   * Validates ownership before deletion
   */
  async delete(id: string) {
    const { parts } = await import("@shared/schema");

    const existing = await this.getById(id);
    if (!existing) {
      throw new Error("Part not found");
    }

    await db.delete(parts).where(this.orgWhere(parts, eq(parts.id, id)));

    return true;
  }
}
