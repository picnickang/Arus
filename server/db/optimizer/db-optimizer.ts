/**
 * Optimizer - Database Storage
 */

import { eq, and, gte, lte, asc, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  optimizerConfigurations,
  resourceConstraints,
  optimizationResults,
  scheduleOptimizations,
  type OptimizerConfiguration,
  type InsertOptimizerConfiguration,
  type ResourceConstraint,
  type InsertResourceConstraint,
  type OptimizationResult,
  type InsertOptimizationResult,
  type ScheduleOptimization,
  type InsertScheduleOptimization,
} from "@shared/schema";

export class DbOptimizerStorage {
  async getOptimizerConfigurations(orgId?: string): Promise<OptimizerConfiguration[]> {
    let q = db.select().from(optimizerConfigurations).$dynamic();
    if (orgId) {
      q = q.where(eq(optimizerConfigurations.orgId, orgId));
    }
    const c = await q;
    return c.map((x) => ({
      ...x,
      createdAt: x.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: x.updatedAt?.toISOString() || new Date().toISOString(),
    })) as never as OptimizerConfiguration[];
  }
  async createOptimizerConfiguration(
    config: InsertOptimizerConfiguration
  ): Promise<OptimizerConfiguration> {
    const [n] = await db.insert(optimizerConfigurations).values(config).returning();
    if (!n) throw new Error("Failed to create optimizer configuration");
    return {
      ...n,
      createdAt: n.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: n.updatedAt?.toISOString() || new Date().toISOString(),
    } as never as OptimizerConfiguration;
  }
  async updateOptimizerConfiguration(
    id: string,
    config: Partial<InsertOptimizerConfiguration>
  ): Promise<OptimizerConfiguration> {
    const [u] = await db
      .update(optimizerConfigurations)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(optimizerConfigurations.id, id))
      .returning();
    if (!u) {
      throw new Error(`Optimizer configuration ${id} not found`);
    }
    return {
      ...u,
      createdAt: u.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: u.updatedAt?.toISOString() || new Date().toISOString(),
    } as never as OptimizerConfiguration;
  }
  async deleteOptimizerConfiguration(id: string): Promise<void> {
    await db.delete(optimizerConfigurations).where(eq(optimizerConfigurations.id, id));
  }

  async getResourceConstraints(
    optimizerConfigId?: string,
    orgId?: string
  ): Promise<ResourceConstraint[]> {
    // NOTE: optimizerConfigId filter is ignored — resource_constraints has no FK to
    // optimizer_configurations. Kept in signature for backward compat.
    void optimizerConfigId;
    const c = [];
    if (orgId) {
      c.push(eq(resourceConstraints.orgId, orgId));
    }
    let q = db.select().from(resourceConstraints).$dynamic();
    if (c.length > 0) {
      q = q.where(and(...c));
    }
    return q;
  }
  async createResourceConstraint(
    constraint: InsertResourceConstraint
  ): Promise<ResourceConstraint> {
    const [n] = await db.insert(resourceConstraints).values(constraint).returning();
    if (!n) throw new Error("Failed to create resource constraint");
    return n;
  }
  async updateResourceConstraint(
    id: string,
    constraint: Partial<InsertResourceConstraint>
  ): Promise<ResourceConstraint> {
    const [u] = await db
      .update(resourceConstraints)
      .set({ ...constraint, updatedAt: new Date() })
      .where(eq(resourceConstraints.id, id))
      .returning();
    if (!u) {
      throw new Error(`Resource constraint ${id} not found`);
    }
    return u;
  }
  async deleteResourceConstraint(id: string): Promise<void> {
    await db.delete(resourceConstraints).where(eq(resourceConstraints.id, id));
  }

  async getOptimizationResults(
    orgId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<OptimizationResult[]> {
    const c = [];
    if (orgId) {
      c.push(eq(optimizationResults.orgId, orgId));
    }
    if (startDate) {
      c.push(gte(optimizationResults.createdAt, startDate));
    }
    if (endDate) {
      c.push(lte(optimizationResults.createdAt, endDate));
    }
    let q = db.select().from(optimizationResults).$dynamic();
    if (c.length > 0) {
      q = q.where(and(...c));
    }
    return q.orderBy(sql`${optimizationResults.createdAt} DESC`);
  }
  async getOptimizationResult(id: string): Promise<OptimizationResult | undefined> {
    const [r] = await db
      .select()
      .from(optimizationResults)
      .where(eq(optimizationResults.id, id))
      .limit(1);
    return r;
  }
  async createOptimizationResult(result: InsertOptimizationResult): Promise<OptimizationResult> {
    const [n] = await db
      .insert(optimizationResults)
      .values({ ...result, createdAt: new Date() })
      .returning();
    if (!n) throw new Error("createOptimizationResult: insert returned no row");
    return n;
  }
  async updateOptimizationResult(
    id: string,
    result: Partial<InsertOptimizationResult>
  ): Promise<OptimizationResult> {
    const [u] = await db
      .update(optimizationResults)
      .set(result)
      .where(eq(optimizationResults.id, id))
      .returning();
    if (!u) {
      throw new Error(`Optimization result ${id} not found`);
    }
    return u;
  }
  async deleteOptimizationResult(id: string): Promise<void> {
    await db.delete(optimizationResults).where(eq(optimizationResults.id, id));
  }
  async deleteAllOptimizationResults(orgId: string): Promise<void> {
    await db.delete(optimizationResults).where(eq(optimizationResults.orgId, orgId));
  }

  async getScheduleOptimizations(optimizationResultId: string): Promise<ScheduleOptimization[]> {
    return db
      .select()
      .from(scheduleOptimizations)
      .where(eq(scheduleOptimizations.optimizationResultId, optimizationResultId))
      .orderBy(asc(scheduleOptimizations.recommendedScheduleDate));
  }
  async createScheduleOptimization(
    optimization: InsertScheduleOptimization
  ): Promise<ScheduleOptimization> {
    const [n] = await db
      .insert(scheduleOptimizations)
      .values({ ...optimization, createdAt: new Date() })
      .returning();
    if (!n) throw new Error("createScheduleOptimization: insert returned no row");
    return n;
  }
  async deleteScheduleOptimizationsByResult(optimizationResultId: string): Promise<void> {
    await db
      .delete(scheduleOptimizations)
      .where(eq(scheduleOptimizations.optimizationResultId, optimizationResultId));
  }
}
