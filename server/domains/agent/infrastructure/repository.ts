import { db } from "../../../db";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import {
  agentConversations,
  agentMessages,
  agentToolCalls,
  agentDrafts,
  agentApprovals,
  agentConfig,
  agentSuggestions,
  agentSchedules,
  agentScheduleRuns,
} from "@shared/schema";
import type { SuggestionPreferences } from "../domain/ports";
import type {
  AgentConversation,
  InsertAgentConversation,
  AgentMessage,
  InsertAgentMessage,
  AgentDraft,
  InsertAgentDraft,
  AgentApproval,
  InsertAgentApproval,
  AgentConfigType,
  InsertAgentConfig,
  AgentSuggestion,
  InsertAgentSuggestion,
  AgentSchedule,
  InsertAgentSchedule,
  AgentScheduleRun,
} from "@shared/schema";
import type { AgentRepositoryPort } from "../domain/ports";

export function createAgentRepository(): AgentRepositoryPort {
  return {
    conversations: {
      async create(data: InsertAgentConversation): Promise<AgentConversation> {
        const [conv] = await db.insert(agentConversations).values(data).returning();
        if (!conv) throw new Error("agentConversations.create: no row returned");
        return conv;
      },
      async get(id: string, orgId: string): Promise<AgentConversation | undefined> {
        const [conv] = await db
          .select()
          .from(agentConversations)
          .where(and(eq(agentConversations.id, id), eq(agentConversations.orgId, orgId)));
        return conv;
      },
      async list(orgId: string, userId?: string, limit = 50): Promise<AgentConversation[]> {
        return db
          .select()
          .from(agentConversations)
          .where(
            userId
              ? and(eq(agentConversations.orgId, orgId), eq(agentConversations.userId, userId))
              : eq(agentConversations.orgId, orgId)
          )
          .orderBy(desc(agentConversations.updatedAt))
          .limit(limit);
      },
      async update(id: string, data: Partial<AgentConversation>): Promise<AgentConversation> {
        const [conv] = await db
          .update(agentConversations)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(agentConversations.id, id))
          .returning();
        if (!conv) throw new Error(`agentConversations.update ${id}: not found`);
        return conv;
      },
      async incrementMessageCount(id: string, tokenCount = 0): Promise<void> {
        await db
          .update(agentConversations)
          .set({
            messageCount: sql`${agentConversations.messageCount} + 1`,
            totalTokensUsed: sql`COALESCE(${agentConversations.totalTokensUsed}, 0) + ${tokenCount}`,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agentConversations.id, id));
      },
      async delete(id: string): Promise<void> {
        await db.delete(agentMessages).where(eq(agentMessages.conversationId, id));
        await db.delete(agentToolCalls).where(eq(agentToolCalls.conversationId, id));
        await db.delete(agentDrafts).where(eq(agentDrafts.conversationId, id));
        await db.delete(agentConversations).where(eq(agentConversations.id, id));
      },
    },

    messages: {
      async create(data: InsertAgentMessage): Promise<AgentMessage> {
        const [msg] = await db.insert(agentMessages).values(data).returning();
        if (!msg) throw new Error("agentMessages.create: no row returned");
        return msg;
      },
      async list(conversationId: string, limit = 50): Promise<AgentMessage[]> {
        return db
          .select()
          .from(agentMessages)
          .where(eq(agentMessages.conversationId, conversationId))
          .orderBy(agentMessages.createdAt)
          .limit(limit);
      },
      async listRecent(conversationId: string, limit = 50): Promise<AgentMessage[]> {
        const rows = await db
          .select()
          .from(agentMessages)
          .where(eq(agentMessages.conversationId, conversationId))
          .orderBy(desc(agentMessages.createdAt))
          .limit(limit);
        return rows.reverse();
      },
    },

    toolCalls: {
      async create(data) {
        const [tc] = await db.insert(agentToolCalls).values(data).returning();
        if (!tc) throw new Error("agentToolCalls.create: no row returned");
        return tc;
      },
      async list(conversationId: string) {
        return db
          .select()
          .from(agentToolCalls)
          .where(eq(agentToolCalls.conversationId, conversationId))
          .orderBy(agentToolCalls.createdAt);
      },
    },

    drafts: {
      async create(data: InsertAgentDraft): Promise<AgentDraft> {
        const [draft] = await db.insert(agentDrafts).values(data).returning();
        if (!draft) throw new Error("agentDrafts.create: no row returned");
        return draft;
      },
      async get(id: string, orgId: string): Promise<AgentDraft | undefined> {
        const [draft] = await db
          .select()
          .from(agentDrafts)
          .where(and(eq(agentDrafts.id, id), eq(agentDrafts.orgId, orgId)));
        return draft;
      },
      async list(orgId: string, status?: string): Promise<AgentDraft[]> {
        return db
          .select()
          .from(agentDrafts)
          .where(
            status
              ? and(eq(agentDrafts.orgId, orgId), eq(agentDrafts.status, status))
              : eq(agentDrafts.orgId, orgId)
          )
          .orderBy(desc(agentDrafts.createdAt));
      },
      async update(id: string, data: Partial<AgentDraft>): Promise<AgentDraft> {
        const [draft] = await db
          .update(agentDrafts)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(agentDrafts.id, id))
          .returning();
        if (!draft) throw new Error(`agentDrafts.update ${id}: not found`);
        return draft;
      },
    },

    approvals: {
      async create(data: InsertAgentApproval): Promise<AgentApproval> {
        const [approval] = await db.insert(agentApprovals).values(data).returning();
        if (!approval) throw new Error("agentApprovals.create: no row returned");
        return approval;
      },
      async list(orgId: string, draftId?: string): Promise<AgentApproval[]> {
        return db
          .select()
          .from(agentApprovals)
          .where(
            draftId
              ? and(eq(agentApprovals.orgId, orgId), eq(agentApprovals.draftId, draftId))
              : eq(agentApprovals.orgId, orgId)
          )
          .orderBy(desc(agentApprovals.createdAt));
      },
    },

    config: {
      async get(orgId: string): Promise<AgentConfigType | undefined> {
        const [config] = await db.select().from(agentConfig).where(eq(agentConfig.orgId, orgId));
        return config;
      },
      async upsert(data: InsertAgentConfig): Promise<AgentConfigType> {
        const [existing] = await db
          .select()
          .from(agentConfig)
          .where(eq(agentConfig.orgId, data.orgId));
        if (existing) {
          const [config] = await db
            .update(agentConfig)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(agentConfig.id, existing.id))
            .returning();
          if (!config) throw new Error("agentConfig.upsert update: no row returned");
          return config;
        }
        const [config] = await db.insert(agentConfig).values(data).returning();
        if (!config) throw new Error("agentConfig.upsert insert: no row returned");
        return config;
      },
    },

    suggestions: {
      async create(data: InsertAgentSuggestion): Promise<AgentSuggestion> {
        const [sug] = await db.insert(agentSuggestions).values(data).returning();
        if (!sug) throw new Error("agentSuggestions.create: no row returned");
        return sug;
      },
      async list(orgId: string, status?: string, limit = 50): Promise<AgentSuggestion[]> {
        return db
          .select()
          .from(agentSuggestions)
          .where(
            status
              ? and(eq(agentSuggestions.orgId, orgId), eq(agentSuggestions.status, status))
              : eq(agentSuggestions.orgId, orgId)
          )
          .orderBy(desc(agentSuggestions.createdAt))
          .limit(limit);
      },
      async getById(id: string): Promise<AgentSuggestion | null> {
        const [sug] = await db
          .select()
          .from(agentSuggestions)
          .where(eq(agentSuggestions.id, id))
          .limit(1);
        return sug || null;
      },
      async update(id: string, data: Partial<AgentSuggestion>): Promise<AgentSuggestion> {
        const [sug] = await db
          .update(agentSuggestions)
          .set(data)
          .where(eq(agentSuggestions.id, id))
          .returning();
        if (!sug) throw new Error(`agentSuggestions.update ${id}: not found`);
        return sug;
      },
      async listResolved(orgId: string, since: Date): Promise<AgentSuggestion[]> {
        return db
          .select()
          .from(agentSuggestions)
          .where(
            and(
              eq(agentSuggestions.orgId, orgId),
              sql`${agentSuggestions.status} IN ('acted', 'dismissed', 'deferred')`,
              gte(
                sql`COALESCE(${agentSuggestions.outcomeAt}, ${agentSuggestions.createdAt})`,
                since
              )
            )
          );
      },
      async getPreferences(orgId: string, userId?: string): Promise<SuggestionPreferences | null> {
        const config = await db
          .select()
          .from(agentConfig)
          .where(eq(agentConfig.orgId, orgId))
          .limit(1);
        if (!config[0]) {
          return null;
        }
        const allPrefs = config[0].suggestionPreferences as Record<string, unknown> | null;
        if (!allPrefs || typeof allPrefs !== "object") {
          return null;
        }
        const key = userId || "__org_default";
        const userPrefs = allPrefs[key];
        if (userPrefs && typeof userPrefs === "object") {
          return userPrefs as SuggestionPreferences;
        }
        if (userId && allPrefs["__org_default"] && typeof allPrefs["__org_default"] === "object") {
          return allPrefs["__org_default"] as SuggestionPreferences;
        }
        return null;
      },
      async savePreferences(
        orgId: string,
        prefs: Partial<SuggestionPreferences>,
        userId?: string
      ): Promise<SuggestionPreferences> {
        const defaults: SuggestionPreferences = {
          maintenance: true,
          predictions: true,
          crew: true,
          inventory: true,
          alerts: true,
          minSeverity: "info",
        };
        const existing = await this.getPreferences(orgId, userId);
        const merged = { ...defaults, ...existing, ...prefs };
        const key = userId || "__org_default";
        const config = await db
          .select()
          .from(agentConfig)
          .where(eq(agentConfig.orgId, orgId))
          .limit(1);
        if (config[0]) {
          const currentAllPrefs = (config[0].suggestionPreferences || {}) as Record<
            string,
            unknown
          >;
          const updated: Record<string, unknown> = { ...currentAllPrefs, [key]: merged };
          await db
            .update(agentConfig)
            .set({
              suggestionPreferences: updated,
              updatedAt: new Date(),
            })
            .where(eq(agentConfig.id, config[0].id));
        } else {
          const initial: Record<string, unknown> = { [key]: merged };
          await db.insert(agentConfig).values({
            orgId,
            suggestionPreferences: initial,
          });
        }
        return merged;
      },
    },

    schedules: {
      async create(data: InsertAgentSchedule): Promise<AgentSchedule> {
        const [sched] = await db.insert(agentSchedules).values(data).returning();
        if (!sched) throw new Error("agentSchedules.create: no row returned");
        return sched;
      },
      async get(id: string, orgId: string): Promise<AgentSchedule | undefined> {
        const [sched] = await db
          .select()
          .from(agentSchedules)
          .where(and(eq(agentSchedules.id, id), eq(agentSchedules.orgId, orgId)));
        return sched;
      },
      async list(orgId: string): Promise<AgentSchedule[]> {
        return db
          .select()
          .from(agentSchedules)
          .where(eq(agentSchedules.orgId, orgId))
          .orderBy(desc(agentSchedules.createdAt));
      },
      async update(id: string, data: Partial<AgentSchedule>): Promise<AgentSchedule> {
        const [sched] = await db
          .update(agentSchedules)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(agentSchedules.id, id))
          .returning();
        if (!sched) throw new Error(`agentSchedules.update ${id}: not found`);
        return sched;
      },
      async delete(id: string): Promise<void> {
        await db.delete(agentSchedules).where(eq(agentSchedules.id, id));
      },
      async createRun(data: { scheduleId: string; status: string }): Promise<AgentScheduleRun> {
        const [run] = await db.insert(agentScheduleRuns).values(data).returning();
        if (!run) throw new Error("agentScheduleRuns.create: no row returned");
        return run;
      },
      async getRuns(scheduleId: string, limit = 20): Promise<AgentScheduleRun[]> {
        return db
          .select()
          .from(agentScheduleRuns)
          .where(eq(agentScheduleRuns.scheduleId, scheduleId))
          .orderBy(desc(agentScheduleRuns.startedAt))
          .limit(limit);
      },
      async updateRun(id: string, data: Partial<AgentScheduleRun>): Promise<AgentScheduleRun> {
        const [run] = await db
          .update(agentScheduleRuns)
          .set(data)
          .where(eq(agentScheduleRuns.id, id))
          .returning();
        if (!run) throw new Error(`agentScheduleRuns.update ${id}: not found`);
        return run;
      },
    },
  };
}

export const agentRepo = createAgentRepository();
