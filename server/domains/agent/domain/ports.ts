import type {
  AgentConversation,
  InsertAgentConversation,
  AgentMessage,
  InsertAgentMessage,
  AgentToolCall,
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

export interface AgentConversationPort {
  create(data: InsertAgentConversation): Promise<AgentConversation>;
  get(id: string, orgId: string): Promise<AgentConversation | undefined>;
  list(orgId: string, userId?: string, limit?: number): Promise<AgentConversation[]>;
  update(id: string, data: Partial<AgentConversation>): Promise<AgentConversation>;
  incrementMessageCount(id: string, tokenCount?: number): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface AgentMessagePort {
  create(data: InsertAgentMessage): Promise<AgentMessage>;
  list(conversationId: string, limit?: number): Promise<AgentMessage[]>;
}

export interface AgentToolCallPort {
  create(data: {
    conversationId: string;
    messageId: string;
    toolName: string;
    input: any;
    output?: any;
    status: string;
    durationMs?: number;
    error?: string;
  }): Promise<AgentToolCall>;
  list(conversationId: string): Promise<AgentToolCall[]>;
}

export interface AgentDraftPort {
  create(data: InsertAgentDraft): Promise<AgentDraft>;
  get(id: string, orgId: string): Promise<AgentDraft | undefined>;
  list(orgId: string, status?: string): Promise<AgentDraft[]>;
  update(id: string, data: Partial<AgentDraft>): Promise<AgentDraft>;
}

export interface AgentConfigPort {
  get(orgId: string): Promise<AgentConfigType | undefined>;
  upsert(data: InsertAgentConfig): Promise<AgentConfigType>;
}

export interface AgentSuggestionPort {
  create(data: InsertAgentSuggestion): Promise<AgentSuggestion>;
  list(orgId: string, status?: string, limit?: number): Promise<AgentSuggestion[]>;
  update(id: string, data: Partial<AgentSuggestion>): Promise<AgentSuggestion>;
}

export interface AgentSchedulePort {
  create(data: InsertAgentSchedule): Promise<AgentSchedule>;
  get(id: string, orgId: string): Promise<AgentSchedule | undefined>;
  list(orgId: string): Promise<AgentSchedule[]>;
  update(id: string, data: Partial<AgentSchedule>): Promise<AgentSchedule>;
  delete(id: string): Promise<void>;
  createRun(data: { scheduleId: string; status: string }): Promise<AgentScheduleRun>;
  getRuns(scheduleId: string, limit?: number): Promise<AgentScheduleRun[]>;
  updateRun(id: string, data: Partial<AgentScheduleRun>): Promise<AgentScheduleRun>;
}

export interface AgentRepositoryPort {
  conversations: AgentConversationPort;
  messages: AgentMessagePort;
  toolCalls: AgentToolCallPort;
  drafts: AgentDraftPort;
  config: AgentConfigPort;
  suggestions: AgentSuggestionPort;
  schedules: AgentSchedulePort;
}
