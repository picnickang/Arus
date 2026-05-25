export interface FileRef {
  fileId: string;
  filename: string;
  mimetype: string;
  size: number;
  previewUrl?: string | undefined;
}

export interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  result?: Record<string, unknown> | undefined;
  status: "running" | "success" | "error";
  durationMs?: number | undefined;
  error?: string | undefined;
  _index?: number | undefined;
}

export interface DraftRecord {
  id: string;
  draftType: string;
  title: string;
  data: Record<string, unknown>;
  status: string;
  conversationId: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCallTrace[] | undefined;
  createdAt: string;
  inlineDraft?: DraftRecord | undefined;
  attachments?: FileRef[] | undefined;
}

export interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  status: string;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "tool_result" | "done" | "error" | "draft";
  content?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  conversationId?: string;
  error?: string;
  draft?: DraftRecord;
}
