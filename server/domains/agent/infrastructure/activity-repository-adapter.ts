import { db } from "../../../db";
import { eq, desc, and, gte, lte, sql, count, inArray } from "drizzle-orm";
import {
  agentScheduleRuns,
  agentSchedules,
  agentConversations,
  agentMessages,
  agentToolCalls,
} from "@shared/schema";
import type {
  ActivityPort,
  AgentActivityItem,
  ActivityRawMetrics,
  ActivityFilter,
  ToolCallEntry,
} from "../domain/activity-types";

export class ActivityRepositoryAdapter implements ActivityPort {
  async list(orgId: string, filter?: ActivityFilter): Promise<AgentActivityItem[]> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    const items: AgentActivityItem[] = [];

    if (!filter?.triggerType || filter.triggerType === "scheduled") {
      items.push(...await this.getScheduledRuns(orgId, filter));
    }

    if (!filter?.triggerType || filter.triggerType === "user") {
      items.push(...await this.getUserRuns(orgId, filter));
    }

    items.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return items.slice(offset, offset + limit);
  }

  async getRawMetrics(orgId: string): Promise<ActivityRawMetrics> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const scheduleIds = await db
      .select({ id: agentSchedules.id })
      .from(agentSchedules)
      .where(eq(agentSchedules.orgId, orgId));
    const schedIds = scheduleIds.map(s => s.id);

    let runsToday = 0;
    let totalRuns7d = 0;
    let successCount7d = 0;
    let failureCount7d = 0;
    let totalTokens30d = 0;
    let totalRuns30d = 0;
    let tokenRunCount = 0;

    if (schedIds.length > 0) {
      const todayRuns = await db
        .select({ cnt: count() })
        .from(agentScheduleRuns)
        .where(and(
          inArray(agentScheduleRuns.scheduleId, schedIds),
          gte(agentScheduleRuns.startedAt, todayStart),
        ));
      runsToday += todayRuns[0]?.cnt ?? 0;

      const runs7d = await db
        .select({
          total: count(),
          completed: sql<number>`COUNT(*) FILTER (WHERE ${agentScheduleRuns.status} = 'completed')::int`,
          failed: sql<number>`COUNT(*) FILTER (WHERE ${agentScheduleRuns.status} = 'failed')::int`,
        })
        .from(agentScheduleRuns)
        .where(and(
          inArray(agentScheduleRuns.scheduleId, schedIds),
          gte(agentScheduleRuns.startedAt, sevenDaysAgo),
        ));
      totalRuns7d += runs7d[0]?.total ?? 0;
      successCount7d += runs7d[0]?.completed ?? 0;
      failureCount7d += runs7d[0]?.failed ?? 0;

      const tokens30d = await db
        .select({
          totalTokens: sql<number>`COALESCE(SUM(${agentScheduleRuns.tokenUsage}), 0)::int`,
          cnt: count(),
          tokenRunCount: sql<number>`COUNT(*) FILTER (WHERE ${agentScheduleRuns.tokenUsage} IS NOT NULL AND ${agentScheduleRuns.tokenUsage} > 0)::int`,
        })
        .from(agentScheduleRuns)
        .where(and(
          inArray(agentScheduleRuns.scheduleId, schedIds),
          gte(agentScheduleRuns.startedAt, thirtyDaysAgo),
        ));
      totalTokens30d += tokens30d[0]?.totalTokens ?? 0;
      totalRuns30d += tokens30d[0]?.cnt ?? 0;
      tokenRunCount += tokens30d[0]?.tokenRunCount ?? 0;
    }

    const convToday = await db
      .select({ cnt: count() })
      .from(agentConversations)
      .where(and(eq(agentConversations.orgId, orgId), gte(agentConversations.createdAt, todayStart)));
    runsToday += convToday[0]?.cnt ?? 0;

    const conv7d = await db
      .select({
        cnt: count(),
        completed: sql<number>`COUNT(*) FILTER (WHERE ${agentConversations.status} NOT IN ('error', 'active'))::int`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${agentConversations.status} = 'error')::int`,
      })
      .from(agentConversations)
      .where(and(eq(agentConversations.orgId, orgId), gte(agentConversations.createdAt, sevenDaysAgo)));
    totalRuns7d += conv7d[0]?.cnt ?? 0;
    successCount7d += conv7d[0]?.completed ?? 0;
    failureCount7d += conv7d[0]?.failed ?? 0;

    const convTokens30d = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${agentConversations.totalTokensUsed}), 0)::int`,
        cnt: count(),
        tokenRunCount: sql<number>`COUNT(*) FILTER (WHERE ${agentConversations.totalTokensUsed} IS NOT NULL AND ${agentConversations.totalTokensUsed} > 0)::int`,
      })
      .from(agentConversations)
      .where(and(eq(agentConversations.orgId, orgId), gte(agentConversations.createdAt, thirtyDaysAgo)));
    totalTokens30d += convTokens30d[0]?.totalTokens ?? 0;
    totalRuns30d += convTokens30d[0]?.cnt ?? 0;
    tokenRunCount += convTokens30d[0]?.tokenRunCount ?? 0;

    return {
      runsToday,
      totalRuns7d,
      successCount7d,
      failureCount7d,
      totalTokens30d,
      totalRuns30d,
      tokenRunCount,
    };
  }

  private async getScheduledRuns(orgId: string, filter?: ActivityFilter): Promise<AgentActivityItem[]> {
    const schedules = await db
      .select({ id: agentSchedules.id, name: agentSchedules.name })
      .from(agentSchedules)
      .where(eq(agentSchedules.orgId, orgId));

    if (schedules.length === 0) return [];

    const schedMap = new Map(schedules.map(s => [s.id, s.name]));
    const schedIds = schedules.map(s => s.id);

    const conditions = [inArray(agentScheduleRuns.scheduleId, schedIds)];
    if (filter?.startDate) conditions.push(gte(agentScheduleRuns.startedAt, filter.startDate));
    if (filter?.endDate) conditions.push(lte(agentScheduleRuns.startedAt, filter.endDate));
    if (filter?.status) {
      const dbStatus = filter.status === "running" ? "running" : filter.status;
      conditions.push(eq(agentScheduleRuns.status, dbStatus));
    }

    const fetchLimit = (filter?.limit ?? 50) + (filter?.offset ?? 0);

    const runs = await db
      .select()
      .from(agentScheduleRuns)
      .where(and(...conditions))
      .orderBy(desc(agentScheduleRuns.startedAt))
      .limit(fetchLimit);

    return runs.map(r => {
      const output = r.output as Record<string, unknown> | null;
      const toolCallCount = typeof output?.toolCallCount === "number" ? output.toolCallCount : 0;
      const response = typeof output?.finalResponse === "string"
        ? output.finalResponse
        : typeof output?.response === "string"
          ? output.response
          : null;

      const rawToolCalls = Array.isArray(output?.toolCalls) ? output.toolCalls : [];
      const toolEntries: ToolCallEntry[] = rawToolCalls.map((tc: Record<string, unknown>) => {
        let inputSummary: string | null = null;
        if (tc.input) {
          const inputStr = typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input);
          inputSummary = inputStr.length > 120 ? inputStr.slice(0, 117) + "..." : inputStr;
        }
        return {
          toolName: typeof tc.toolName === "string" ? tc.toolName : "unknown",
          inputSummary,
          durationMs: typeof tc.durationMs === "number" ? tc.durationMs : null,
          status: typeof tc.status === "string" ? tc.status : "unknown",
          error: typeof tc.error === "string" ? tc.error : null,
        };
      });

      return {
        id: r.id,
        triggerType: "scheduled" as const,
        scheduleName: schedMap.get(r.scheduleId) ?? null,
        scheduleId: r.scheduleId,
        conversationId: null,
        userId: null,
        status: r.status === "completed" ? "completed" as const
          : r.status === "failed" ? "failed" as const
          : "running" as const,
        startedAt: r.startedAt ? new Date(r.startedAt) : new Date(),
        completedAt: r.completedAt ? new Date(r.completedAt) : null,
        durationMs: r.startedAt && r.completedAt
          ? new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
          : null,
        tokenUsage: r.tokenUsage,
        toolCallCount: toolEntries.length || toolCallCount,
        toolCalls: toolEntries,
        response,
        error: r.error,
      };
    });
  }

  private async getUserRuns(orgId: string, filter?: ActivityFilter): Promise<AgentActivityItem[]> {
    const conditions = [eq(agentConversations.orgId, orgId)];
    if (filter?.startDate) conditions.push(gte(agentConversations.createdAt, filter.startDate));
    if (filter?.endDate) conditions.push(lte(agentConversations.createdAt, filter.endDate));
    if (filter?.status) {
      if (filter.status === "failed") {
        conditions.push(eq(agentConversations.status, "error"));
      } else if (filter.status === "running") {
        conditions.push(eq(agentConversations.status, "active"));
      } else {
        conditions.push(sql`${agentConversations.status} NOT IN ('error', 'active')`);
      }
    }

    const fetchLimit = (filter?.limit ?? 50) + (filter?.offset ?? 0);

    const conversations = await db
      .select()
      .from(agentConversations)
      .where(and(...conditions))
      .orderBy(desc(agentConversations.updatedAt))
      .limit(fetchLimit);

    const items: AgentActivityItem[] = [];

    for (const conv of conversations) {
      const toolCalls = await db
        .select()
        .from(agentToolCalls)
        .where(eq(agentToolCalls.conversationId, conv.id))
        .orderBy(agentToolCalls.createdAt);

      const toolEntries: ToolCallEntry[] = toolCalls.map(tc => {
        let inputSummary: string | null = null;
        if (tc.input) {
          const inputStr = typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input);
          inputSummary = inputStr.length > 120 ? inputStr.slice(0, 117) + "..." : inputStr;
        }
        return {
          toolName: tc.toolName,
          inputSummary,
          durationMs: tc.durationMs,
          status: tc.status,
          error: tc.error,
        };
      });

      const lastMsg = await db
        .select({ content: agentMessages.content })
        .from(agentMessages)
        .where(and(
          eq(agentMessages.conversationId, conv.id),
          eq(agentMessages.role, "assistant"),
        ))
        .orderBy(desc(agentMessages.createdAt))
        .limit(1);

      const lastResponse = lastMsg[0]?.content ?? null;

      const errorMsgs = await db
        .select({ content: agentMessages.content })
        .from(agentMessages)
        .where(and(
          eq(agentMessages.conversationId, conv.id),
          eq(agentMessages.role, "system"),
        ))
        .orderBy(desc(agentMessages.createdAt))
        .limit(1);

      const errorDetail = conv.status === "error"
        ? (errorMsgs[0]?.content ?? "Conversation ended with error status")
        : null;

      items.push({
        id: conv.id,
        triggerType: "user",
        scheduleName: null,
        scheduleId: null,
        conversationId: conv.id,
        userId: conv.userId,
        status: conv.status === "error" ? "failed"
          : conv.status === "active" ? "running"
          : "completed",
        startedAt: conv.createdAt ? new Date(conv.createdAt) : new Date(),
        completedAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : null,
        durationMs: conv.createdAt && conv.lastMessageAt
          ? new Date(conv.lastMessageAt).getTime() - new Date(conv.createdAt).getTime()
          : null,
        tokenUsage: conv.totalTokensUsed,
        toolCallCount: toolCalls.length,
        toolCalls: toolEntries,
        response: lastResponse ?? conv.title ?? null,
        error: errorDetail,
      });
    }

    return items;
  }
}
