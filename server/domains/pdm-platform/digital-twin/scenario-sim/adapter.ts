import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../../db";
import {
  twinScenarios,
  type TwinScenario,
  type InsertTwinScenario,
} from "@shared/schema";
import type { ScenarioSimPort } from "./ports";

export class ScenarioSimAdapter implements ScenarioSimPort {
  async listScenarios(orgId: string, twinId: string): Promise<TwinScenario[]> {
    return db
      .select()
      .from(twinScenarios)
      .where(
        and(eq(twinScenarios.orgId, orgId), eq(twinScenarios.twinId, twinId))
      )
      .orderBy(desc(twinScenarios.createdAt));
  }

  async getScenario(orgId: string, scenarioId: string): Promise<TwinScenario | null> {
    const [result] = await db
      .select()
      .from(twinScenarios)
      .where(
        and(eq(twinScenarios.orgId, orgId), eq(twinScenarios.id, scenarioId))
      );
    return result ?? null;
  }

  async saveScenario(data: InsertTwinScenario): Promise<TwinScenario> {
    const [result] = await db.insert(twinScenarios).values(data).returning();
    return result;
  }
}
