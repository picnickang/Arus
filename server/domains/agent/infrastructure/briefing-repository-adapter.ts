import { db, libsqlClient } from "../../../db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { agentBriefings } from "@shared/schema";
import type { AgentBriefing, InsertAgentBriefing } from "@shared/schema";
import type { BriefingRepositoryPort } from "../domain/briefing-types";
import { withGeneratedInsertDefaults } from "./generated-id";

interface RawBriefingDates {
  generated_at?: string | number | Date | null;
  period_start?: string | number | Date | null;
  period_end?: string | number | Date | null;
  created_at?: string | number | Date | null;
}

function isUsableDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime()) && value.getFullYear() >= 2000;
}

function parseStoredDate(value: unknown): Date | null {
  if (isUsableDate(value)) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isUsableDate(parsed) ? parsed : null;
  }
  return null;
}

function unwrapRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    return ((result as { rows?: T[] }).rows ?? []) as T[];
  }
  return [];
}

export class BriefingRepositoryAdapter implements BriefingRepositoryPort {
  private async withNormalizedDates(briefing: AgentBriefing): Promise<AgentBriefing> {
    if (
      isUsableDate(briefing.generatedAt) &&
      isUsableDate(briefing.periodStart) &&
      isUsableDate(briefing.periodEnd) &&
      isUsableDate(briefing.createdAt)
    ) {
      return briefing;
    }

    try {
      const [raw] = libsqlClient
        ? unwrapRows<RawBriefingDates>(
            await libsqlClient.execute({
              sql: "SELECT CAST(generated_at AS TEXT) AS generated_at, CAST(period_start AS TEXT) AS period_start, CAST(period_end AS TEXT) AS period_end, CAST(created_at AS TEXT) AS created_at FROM agent_briefings WHERE id = ? LIMIT 1",
              args: [briefing.id],
            })
          )
        : unwrapRows<RawBriefingDates>(
            await db.execute(
              sql`SELECT CAST(generated_at AS TEXT) AS generated_at, CAST(period_start AS TEXT) AS period_start, CAST(period_end AS TEXT) AS period_end, CAST(created_at AS TEXT) AS created_at FROM agent_briefings WHERE id = ${briefing.id} LIMIT 1`
            )
          );
      if (!raw) {
        return briefing;
      }
      return {
        ...briefing,
        generatedAt: parseStoredDate(raw.generated_at) ?? briefing.generatedAt,
        periodStart: parseStoredDate(raw.period_start) ?? briefing.periodStart,
        periodEnd: parseStoredDate(raw.period_end) ?? briefing.periodEnd,
        createdAt: parseStoredDate(raw.created_at) ?? briefing.createdAt,
      };
    } catch {
      return briefing;
    }
  }

  async create(data: InsertAgentBriefing): Promise<AgentBriefing> {
    const [briefing] = await db
      .insert(agentBriefings)
      .values(withGeneratedInsertDefaults(data, ["generatedAt", "createdAt"]))
      .returning();
    if (!briefing) {
      throw new Error("Failed to create agent briefing");
    }
    return this.withNormalizedDates(briefing);
  }

  async getById(id: string, orgId: string): Promise<AgentBriefing | null> {
    const [briefing] = await db
      .select()
      .from(agentBriefings)
      .where(and(eq(agentBriefings.id, id), eq(agentBriefings.orgId, orgId)));
    return briefing ? this.withNormalizedDates(briefing) : null;
  }

  async getLatestForToday(orgId: string): Promise<AgentBriefing | null> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [briefing] = await db
      .select()
      .from(agentBriefings)
      .where(
        and(
          eq(agentBriefings.orgId, orgId),
          eq(agentBriefings.status, "ready"),
          gte(agentBriefings.generatedAt, todayStart),
          lte(agentBriefings.generatedAt, todayEnd)
        )
      )
      .orderBy(desc(agentBriefings.generatedAt))
      .limit(1);
    return briefing ? this.withNormalizedDates(briefing) : null;
  }

  async list(orgId: string, limit = 30): Promise<AgentBriefing[]> {
    const briefings = await db
      .select()
      .from(agentBriefings)
      .where(eq(agentBriefings.orgId, orgId))
      .orderBy(desc(agentBriefings.generatedAt))
      .limit(limit);
    return Promise.all(briefings.map((briefing) => this.withNormalizedDates(briefing)));
  }

  async listByDate(orgId: string, date: Date): Promise<AgentBriefing[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const briefings = await db
      .select()
      .from(agentBriefings)
      .where(
        and(
          eq(agentBriefings.orgId, orgId),
          gte(agentBriefings.generatedAt, dayStart),
          lte(agentBriefings.generatedAt, dayEnd)
        )
      )
      .orderBy(desc(agentBriefings.generatedAt));
    return Promise.all(briefings.map((briefing) => this.withNormalizedDates(briefing)));
  }

  async update(id: string, data: Partial<AgentBriefing>): Promise<AgentBriefing> {
    const [briefing] = await db
      .update(agentBriefings)
      .set(data)
      .where(eq(agentBriefings.id, id))
      .returning();
    if (!briefing) {
      throw new Error(`Agent briefing ${id} not found`);
    }
    return this.withNormalizedDates(briefing);
  }
}
