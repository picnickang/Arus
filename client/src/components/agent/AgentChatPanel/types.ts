export interface FileRef {
  fileId: string;
  filename: string;
  mimetype: string;
  size: number;
  previewUrl?: string;
}

export interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "running" | "success" | "error";
  durationMs?: number;
  error?: string;
  _index?: number;
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
  toolCalls?: ToolCallTrace[];
  createdAt: string;
  inlineDraft?: DraftRecord;
  attachments?: FileRef[];
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
