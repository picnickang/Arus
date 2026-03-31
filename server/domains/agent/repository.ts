import { db } from "../../db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  agentConversations,
  agentMessages,
  agentToolCalls,
  agentDrafts,
  agentConfig,
  agentSuggestions,
  agentSchedules,
  agentScheduleRuns,
} from "@shared/schema";
import type {
  AgentConversation,
  InsertAgentConversation,
  AgentMessage,
  InsertAgentMessage,
  AgentDraft,
  InsertAgentDraft,
  AgentConfigType,
  InsertAgentConfig,
  AgentSuggestion,
  InsertAgentSuggestion,
  AgentSchedule,
  InsertAgentSchedule,
  AgentScheduleRun,
} from "@shared/schema";

export const agentRepository = {
  async createConversation(data: InsertAgentConversation): Promise<AgentConversation> {
    const [conv] = await db.insert(agentConversations).values(data).returning();
    return conv;
  },

  async getConversation(id: string, orgId: string): Promise<AgentConversation | undefined> {
    const [conv] = await db.select().from(agentConversations)
      .where(and(eq(agentConversations.id, id), eq(agentConversations.orgId, orgId)));
    return conv;
  },

  async listConversations(orgId: string, userId?: string, limit = 50): Promise<AgentConversation[]> {
    let query = db.select().from(agentConversations)
      .where(userId
        ? and(eq(agentConversations.orgId, orgId), eq(agentConversations.userId, userId))
        : eq(agentConversations.orgId, orgId))
      .orderBy(desc(agentConversations.updatedAt))
      .limit(limit);
    return query;
  },

  async updateConversation(id: string, data: Partial<AgentConversation>): Promise<AgentConversation> {
    const [conv] = await db.update(agentConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentConversations.id, id))
      .returning();
    return conv;
  },

  async incrementMessageCount(id: string, tokenCount: number = 0): Promise<void> {
    await db.update(agentConversations)
      .set({
        messageCount: sql`${agentConversations.messageCount} + 1`,
        totalTokensUsed: sql`COALESCE(${agentConversations.totalTokensUsed}, 0) + ${tokenCount}`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentConversations.id, id));
  },

  async createMessage(data: InsertAgentMessage): Promise<AgentMessage> {
    const [msg] = await db.insert(agentMessages).values(data).returning();
    return msg;
  },

  async getMessages(conversationId: string, limit = 50): Promise<AgentMessage[]> {
    return db.select().from(agentMessages)
      .where(eq(agentMessages.conversationId, conversationId))
      .orderBy(agentMessages.createdAt)
      .limit(limit);
  },

  async createToolCall(data: {
    conversationId: string;
    messageId: string;
    toolName: string;
    input: any;
    output?: any;
    status: string;
    durationMs?: number;
    error?: string;
  }): Promise<typeof agentToolCalls.$inferSelect> {
    const [tc] = await db.insert(agentToolCalls).values(data).returning();
    return tc;
  },

  async getToolCalls(conversationId: string): Promise<(typeof agentToolCalls.$inferSelect)[]> {
    return db.select().from(agentToolCalls)
      .where(eq(agentToolCalls.conversationId, conversationId))
      .orderBy(agentToolCalls.createdAt);
  },

  async createDraft(data: InsertAgentDraft): Promise<AgentDraft> {
    const [draft] = await db.insert(agentDrafts).values(data).returning();
    return draft;
  },

  async getDraft(id: string, orgId: string): Promise<AgentDraft | undefined> {
    const [draft] = await db.select().from(agentDrafts)
      .where(and(eq(agentDrafts.id, id), eq(agentDrafts.orgId, orgId)));
    return draft;
  },

  async listDrafts(orgId: string, status?: string): Promise<AgentDraft[]> {
    return db.select().from(agentDrafts)
      .where(status
        ? and(eq(agentDrafts.orgId, orgId), eq(agentDrafts.status, status))
        : eq(agentDrafts.orgId, orgId))
      .orderBy(desc(agentDrafts.createdAt));
  },

  async updateDraft(id: string, data: Partial<AgentDraft>): Promise<AgentDraft> {
    const [draft] = await db.update(agentDrafts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentDrafts.id, id))
      .returning();
    return draft;
  },

  async getConfig(orgId: string): Promise<AgentConfigType | undefined> {
    const [config] = await db.select().from(agentConfig)
      .where(eq(agentConfig.orgId, orgId));
    return config;
  },

  async upsertConfig(data: InsertAgentConfig): Promise<AgentConfigType> {
    const existing = await this.getConfig(data.orgId);
    if (existing) {
      const [config] = await db.update(agentConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agentConfig.id, existing.id))
        .returning();
      return config;
    }
    const [config] = await db.insert(agentConfig).values(data).returning();
    return config;
  },

  async createSuggestion(data: InsertAgentSuggestion): Promise<AgentSuggestion> {
    const [sug] = await db.insert(agentSuggestions).values(data).returning();
    return sug;
  },

  async listSuggestions(orgId: string, status?: string, limit = 50): Promise<AgentSuggestion[]> {
    return db.select().from(agentSuggestions)
      .where(status
        ? and(eq(agentSuggestions.orgId, orgId), eq(agentSuggestions.status, status))
        : eq(agentSuggestions.orgId, orgId))
      .orderBy(desc(agentSuggestions.createdAt))
      .limit(limit);
  },

  async updateSuggestion(id: string, data: Partial<AgentSuggestion>): Promise<AgentSuggestion> {
    const [sug] = await db.update(agentSuggestions)
      .set(data)
      .where(eq(agentSuggestions.id, id))
      .returning();
    return sug;
  },

  async createSchedule(data: InsertAgentSchedule): Promise<AgentSchedule> {
    const [sched] = await db.insert(agentSchedules).values(data).returning();
    return sched;
  },

  async listSchedules(orgId: string): Promise<AgentSchedule[]> {
    return db.select().from(agentSchedules)
      .where(eq(agentSchedules.orgId, orgId))
      .orderBy(desc(agentSchedules.createdAt));
  },

  async getSchedule(id: string, orgId: string): Promise<AgentSchedule | undefined> {
    const [sched] = await db.select().from(agentSchedules)
      .where(and(eq(agentSchedules.id, id), eq(agentSchedules.orgId, orgId)));
    return sched;
  },

  async updateSchedule(id: string, data: Partial<AgentSchedule>): Promise<AgentSchedule> {
    const [sched] = await db.update(agentSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentSchedules.id, id))
      .returning();
    return sched;
  },

  async deleteSchedule(id: string): Promise<void> {
    await db.delete(agentSchedules).where(eq(agentSchedules.id, id));
  },

  async createScheduleRun(data: { scheduleId: string; status: string }): Promise<AgentScheduleRun> {
    const [run] = await db.insert(agentScheduleRuns).values(data).returning();
    return run;
  },

  async updateScheduleRun(id: string, data: Partial<AgentScheduleRun>): Promise<AgentScheduleRun> {
    const [run] = await db.update(agentScheduleRuns)
      .set(data)
      .where(eq(agentScheduleRuns.id, id))
      .returning();
    return run;
  },

  async getScheduleRuns(scheduleId: string, limit = 20): Promise<AgentScheduleRun[]> {
    return db.select().from(agentScheduleRuns)
      .where(eq(agentScheduleRuns.scheduleId, scheduleId))
      .orderBy(desc(agentScheduleRuns.startedAt))
      .limit(limit);
  },
};
