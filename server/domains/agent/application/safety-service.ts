import { db } from "../../../db";
import { sql } from "drizzle-orm";
import type { AgentRepositoryPort } from "../domain/ports";
import type { SafetyCheckResult, UsageStats } from "../domain/types";
import { InputSanitizer } from "../../../services/rag/security/input-sanitizer";
import { DEFAULT_RAG_SECURITY_CONFIG } from "../../../services/rag/security/types";

interface DbQueryRow {
  total?: string | number;
  conv_count?: string | number;
  msg_count?: string | number;
  token_total?: string | number;
  tool_name?: string;
  call_count?: string | number;
  day?: string;
  tokens?: string | number;
  messages?: string | number;
}

interface DbQueryResult {
  rows: DbQueryRow[];
}

const inputSanitizer = new InputSanitizer(DEFAULT_RAG_SECURITY_CONFIG.promptSecurity);

export class SafetyService {
  constructor(private repo: AgentRepositoryPort) {}

  async checkTokenBudget(
    orgId: string,
    conversationId: string,
    config: { maxTokensPerConversation?: number | null; dailyTokenLimit?: number | null; monthlyTokenLimit?: number | null },
  ): Promise<SafetyCheckResult> {
    const conv = await this.repo.conversations.get(conversationId, orgId);
    const convTokens = conv?.totalTokensUsed || 0;
    const maxConvTokens = config.maxTokensPerConversation || 50000;

    if (convTokens >= maxConvTokens) {
      return { allowed: false, reason: "Conversation token limit reached. Start a new conversation.", remainingTokens: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyResult = await db.execute(sql`
      SELECT COALESCE(SUM(m.token_count), 0)::int as total
      FROM agent_messages m
      JOIN agent_conversations c ON m.conversation_id = c.id
      WHERE c.org_id = ${orgId} AND m.created_at >= ${today}
    `) as unknown as DbQueryResult;
    const dailyTokens = Number(dailyResult.rows?.[0]?.total || 0);
    const dailyLimit = config.dailyTokenLimit || 500000;

    if (dailyTokens >= dailyLimit) {
      return { allowed: false, reason: "Daily token limit reached. Try again tomorrow.", remainingTokens: 0 };
    }

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyResult = await db.execute(sql`
      SELECT COALESCE(SUM(m.token_count), 0)::int as total
      FROM agent_messages m
      JOIN agent_conversations c ON m.conversation_id = c.id
      WHERE c.org_id = ${orgId} AND m.created_at >= ${monthStart}
    `) as unknown as DbQueryResult;
    const monthlyTokens = Number(monthlyResult.rows?.[0]?.total || 0);
    const monthlyLimit = config.monthlyTokenLimit || 5000000;

    if (monthlyTokens >= monthlyLimit) {
      return { allowed: false, reason: "Monthly token limit reached.", remainingTokens: 0 };
    }

    return {
      allowed: true,
      remainingTokens: Math.min(maxConvTokens - convTokens, dailyLimit - dailyTokens),
    };
  }

  async getUsageStats(orgId: string, days = 30): Promise<UsageStats> {
    const since = new Date(Date.now() - days * 86400000);

    const [convStats, toolStats, dailyStats, approvalStats, costStats] = await Promise.all([
      db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM agent_conversations WHERE org_id = ${orgId} AND created_at >= ${since}) as conv_count,
          (SELECT COUNT(*)::int FROM agent_messages m JOIN agent_conversations c ON m.conversation_id = c.id WHERE c.org_id = ${orgId} AND m.created_at >= ${since}) as msg_count,
          (SELECT COALESCE(SUM(m.token_count), 0)::int FROM agent_messages m JOIN agent_conversations c ON m.conversation_id = c.id WHERE c.org_id = ${orgId} AND m.created_at >= ${since}) as token_total
      `) as unknown as DbQueryResult,
      db.execute(sql`
        SELECT tool_name, COUNT(*)::int as call_count
        FROM agent_tool_calls tc
        JOIN agent_conversations c ON tc.conversation_id = c.id
        WHERE c.org_id = ${orgId} AND tc.created_at >= ${since}
        GROUP BY tool_name ORDER BY call_count DESC LIMIT 10
      `) as unknown as DbQueryResult,
      db.execute(sql`
        SELECT DATE(m.created_at) as day,
               COALESCE(SUM(m.token_count), 0)::int as tokens,
               COUNT(*)::int as messages
        FROM agent_messages m
        JOIN agent_conversations c ON m.conversation_id = c.id
        WHERE c.org_id = ${orgId} AND m.created_at >= ${since}
        GROUP BY DATE(m.created_at) ORDER BY day DESC LIMIT ${days}
      `) as unknown as DbQueryResult,
      db.execute(sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
          COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending
        FROM agent_drafts
        WHERE org_id = ${orgId} AND created_at >= ${since}
      `) as unknown as { rows: Array<{ total?: string | number; approved?: string | number; rejected?: string | number; pending?: string | number }> },
      db.execute(sql`
        SELECT COALESCE(SUM(estimated_cost), 0) as cost
        FROM llm_cost_tracking
        WHERE org_id = ${orgId} AND created_at >= ${since}
          AND request_type = 'agent'
      `) as unknown as { rows: Array<{ cost?: string | number }> },
    ]);

    const convRow = convStats.rows?.[0] || {};
    const toolRows = toolStats.rows || [];
    const dailyRows = dailyStats.rows || [];
    const approvalRow = approvalStats.rows?.[0] || {};
    const costRow = costStats.rows?.[0] || {};

    const convCount = Number(convRow.conv_count || 0);
    const tokenTotal = Number(convRow.token_total || 0);
    const approvedCount = Number(approvalRow.approved || 0);
    const rejectedCount = Number(approvalRow.rejected || 0);
    const pendingCount = Number(approvalRow.pending || 0);
    const totalDrafts = Number(approvalRow.total || 0);
    const decidedCount = approvedCount + rejectedCount;

    return {
      conversationCount: convCount,
      messageCount: Number(convRow.msg_count || 0),
      totalTokens: tokenTotal,
      toolCallCount: toolRows.reduce((sum: number, r: DbQueryRow) => sum + Number(r.call_count || 0), 0),
      avgTokensPerConversation: convCount > 0 ? Math.round(tokenTotal / convCount) : 0,
      topTools: toolRows.map((r: DbQueryRow) => ({ toolName: r.tool_name || "", count: Number(r.call_count) })),
      dailyUsage: dailyRows.map((r: DbQueryRow) => ({
        date: String(r.day || ""), tokens: Number(r.tokens), messages: Number(r.messages),
      })),
      approvalStats: {
        total: totalDrafts,
        approved: approvedCount,
        rejected: rejectedCount,
        pending: pendingCount,
        approvalRate: decidedCount > 0 ? Math.round((approvedCount / decidedCount) * 100) : 0,
      },
      estimatedCost: Number(Number(costRow.cost || 0).toFixed(4)),
    };
  }

  checkWriteToolAccess(toolName: string, userRole: string | undefined): boolean {
    const writeTools = ["draftWorkOrder"];
    if (!writeTools.includes(toolName)) return true;
    const maintenanceRoles = ["admin", "chief_engineer", "second_engineer", "captain", "chief_officer"];
    const role = (userRole || "").toLowerCase();
    return maintenanceRoles.includes(role);
  }

  sanitizeInput(text: string): string {
    const result = inputSanitizer.sanitize(text);
    return result.sanitized;
  }

  validateToolAccess(toolName: string, enabledTools: string[] | null | undefined): boolean {
    if (!enabledTools || !Array.isArray(enabledTools)) return true;
    return enabledTools.includes(toolName);
  }
}
