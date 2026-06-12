export interface AgentConfig {
  defaultModel: string;
  maxIterationsPerRun: number;
  maxTokensPerConversation: number;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  customSystemPrompt?: string;
  enabledTools?: string[] | null;
  contextCompaction?: boolean;
  compactionThreshold?: number;
  toolOutputCharLimit?: number;
  deferredToolLoading?: boolean;
  permissionTier?: string;
  autoTriggerEnabled?: boolean;
  autoTriggerThreshold?: number;
}

export interface UsageStats {
  conversationCount: number;
  messageCount: number;
  totalTokens: number;
  toolCallCount: number;
  avgTokensPerConversation: number;
  topTools: { toolName: string; count: number }[];
  approvalStats: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
  };
  estimatedCost: number;
}

export interface Schedule {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  outputDestination: string;
  allowWriteTools: boolean;
  enabled: boolean;
  consecutiveFailures: number;
  lastRunAt?: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  requiresApproval: boolean;
}

export interface EffectivenessSummary {
  totalResolved: number;
  actedCount: number;
  dismissedCount: number;
  deferredCount: number;
  acceptanceRate: number;
  dismissalRate: number;
  topDismissalReasons: { reason: string; count: number }[];
  outcomeCounts: Record<string, number>;
}
