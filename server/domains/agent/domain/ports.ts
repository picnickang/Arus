import type {
  AgentConversation,
  InsertAgentConversation,
  AgentMessage,
  InsertAgentMessage,
  AgentToolCall,
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
  listRecent(conversationId: string, limit?: number): Promise<AgentMessage[]>;
}

export interface AgentToolCallPort {
  create(data: {
    conversationId: string;
    messageId: string;
    toolName: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
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

export interface SuggestionPreferences {
  maintenance: boolean;
  predictions: boolean;
  crew: boolean;
  inventory: boolean;
  alerts: boolean;
  minSeverity: "info" | "warning" | "critical";
}

export interface AgentSuggestionPort {
  create(data: InsertAgentSuggestion): Promise<AgentSuggestion>;
  getById(id: string): Promise<AgentSuggestion | null>;
  list(orgId: string, status?: string, limit?: number): Promise<AgentSuggestion[]>;
  update(id: string, data: Partial<AgentSuggestion>): Promise<AgentSuggestion>;
  getPreferences(orgId: string, userId?: string): Promise<SuggestionPreferences | null>;
  savePreferences(orgId: string, prefs: Partial<SuggestionPreferences>, userId?: string): Promise<SuggestionPreferences>;
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

export interface AgentApprovalPort {
  create(data: InsertAgentApproval): Promise<AgentApproval>;
  list(orgId: string, draftId?: string): Promise<AgentApproval[]>;
}

/** A single citation referencing a chunk from a KB document. */
export interface KnowledgeBaseCitation {
  docId: string;
  docName: string;
  chunkId: string;
  text: string;
  /** Relevance score between 0 and 1. */
  relevance: number;
  /** Ordinal position of the citation within the result set. */
  ord: number;
}

/**
 * Result of a KB search query.
 * On success, `answer` contains the generated response and `error` is undefined.
 * On failure, `error` contains a human-readable message and `answer` may be empty.
 */
export interface KnowledgeBaseSearchResult {
  answer: string;
  citations: KnowledgeBaseCitation[];
  sourceChunkIds: string[];
  modelUsed: string;
  cached: boolean;
  /** Set when the search failed; consumers should check this field before using `answer`. */
  error?: string;
}

/** Summary metadata for a single KB document. */
export interface KnowledgeBaseDocSummary {
  id: string;
  name: string;
  fileType: string | null;
  uploadedAt: Date;
  chunkCount: number;
  sizeBytes: number | null;
  status: string;
}

/** Aggregate statistics for all documents in an org's KB. */
export interface KnowledgeBaseStats {
  totalDocs: number;
  totalChunks: number;
}

/** Result returned after successfully ingesting a document into the KB. */
export interface KnowledgeBaseIngestResult {
  docId: string;
  chunkCount: number;
}

/**
 * Port for interacting with the organization-scoped Knowledge Base.
 * All methods accept an `orgId` to scope operations to a single organization.
 */
export interface KnowledgeBasePort {
  /**
   * Search the KB with a natural-language query and return an AI-generated answer with citations.
   * On error the returned result has `error` set instead of throwing.
   */
  search(orgId: string, query: string, options?: { maxSources?: number; threshold?: number }): Promise<KnowledgeBaseSearchResult>;

  /** List all documents ingested into the org's KB, ordered by creation date. */
  listDocuments(orgId: string): Promise<KnowledgeBaseDocSummary[]>;

  /** Return aggregate doc/chunk counts for the org's KB. */
  getStats(orgId: string): Promise<KnowledgeBaseStats>;

  /**
   * Ingest a document into the KB. The file is chunked, embedded, and indexed.
   * @throws if the file type is unsupported or ingestion fails.
   */
  ingestDocument(orgId: string, fileName: string, fileBuffer: Buffer, fileType: string, uploadedBy?: string): Promise<KnowledgeBaseIngestResult>;
}

export interface AgentRepositoryPort {
  conversations: AgentConversationPort;
  messages: AgentMessagePort;
  toolCalls: AgentToolCallPort;
  drafts: AgentDraftPort;
  approvals: AgentApprovalPort;
  config: AgentConfigPort;
  suggestions: AgentSuggestionPort;
  schedules: AgentSchedulePort;
}
