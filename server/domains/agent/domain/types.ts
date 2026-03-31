export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  requiresApproval: boolean;
  execute: (input: any, context: ToolContext) => Promise<any>;
}

export interface ToolContext {
  orgId: string;
  userId?: string;
  conversationId: string;
}

export interface AgentRunResult {
  conversationId: string;
  messages: any[];
  finalResponse: string;
  toolCallCount: number;
  totalTokens: number;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
  input?: any;
  result?: any;
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
}

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
} as const;
