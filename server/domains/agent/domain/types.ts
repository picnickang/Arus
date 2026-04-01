export type ToolCategory = "fleet" | "maintenance" | "alerts" | "predictions" | "crew" | "inventory" | "work-orders" | "analytics" | "files" | "knowledge-base" | "meta";

export type RiskLevel = "read" | "low-write" | "high-write";

export type PermissionTier = "strict" | "balanced" | "autonomous";

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  parameters: Record<string, unknown>;
  inputSchema?: import("zod").ZodType;
  requiresApproval: boolean;
  execute: (input: Record<string, unknown>, context: ToolContext) => Promise<Record<string, unknown>>;
}

export interface ToolContext {
  orgId: string;
  userId?: string;
  conversationId: string;
  userRole?: string;
  knowledgeBase?: import("./ports").KnowledgeBasePort;
}

export interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
  durationMs: number;
  error?: string;
}

export interface AgentRunResult {
  conversationId: string;
  toolCalls: ToolCallTrace[];
  finalResponse: string;
  toolCallCount: number;
  totalTokens: number;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  conversationId?: string;
  error?: string;
}

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  remainingTokens?: number;
}

export interface UsageStats {
  conversationCount: number;
  messageCount: number;
  totalTokens: number;
  toolCallCount: number;
  avgTokensPerConversation: number;
  topTools: { toolName: string; count: number }[];
  dailyUsage: { date: string; tokens: number; messages: number }[];
  approvalStats: { total: number; approved: number; rejected: number; pending: number; approvalRate: number };
  estimatedCost: number;
}

export const WRITE_TOOLS = ["draftWorkOrder", "shareReport"] as const;
export const MAINTENANCE_ROLES = ["admin", "chief_engineer", "second_engineer", "captain", "chief_officer"] as const;

export interface FileAttachment {
  filename: string;
  mimetype: string;
  path: string;
  size: number;
}

export const AGENT_EVENTS = {
  CONVERSATION_CREATED: "agent.conversation.created",
  MESSAGE_SENT: "agent.message.sent",
  TOOL_CALLED: "agent.tool.called",
  DRAFT_CREATED: "agent.draft.created",
  DRAFT_APPROVED: "agent.draft.approved",
  DRAFT_REJECTED: "agent.draft.rejected",
  SUGGESTION_GENERATED: "agent.suggestion.generated",
  SCHEDULE_EXECUTED: "agent.schedule.executed",
} as const;

export const DEFAULT_CONFIG = {
  defaultModel: "gpt-4o-mini",
  maxIterationsPerRun: 10,
  maxTokensPerConversation: 50000,
  dailyTokenLimit: 500000,
  monthlyTokenLimit: 5000000,
  contextCompaction: true,
  compactionThreshold: 30,
  toolOutputCharLimit: 4000,
  deferredToolLoading: true,
  permissionTier: "strict" as PermissionTier,
} as const;
