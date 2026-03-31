import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, Send, Plus, Loader2,
  Wrench, CheckCircle, XCircle, AlertTriangle,
  Clock, ArrowLeft, Paperclip, X, FileText, Image as ImageIcon,
  ChevronRight, ChevronDown,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCallTrace[];
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  status: string;
}

interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "running" | "success" | "error";
  durationMs?: number;
  error?: string;
  _index?: number;
}

interface StreamChunk {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  conversationId?: string;
  error?: string;
}

interface DraftRecord {
  id: string;
  draftType: string;
  title: string;
  data: Record<string, unknown>;
  status: string;
  conversationId: string;
  createdAt: string;
}

const ALLOWED_FILE_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function ToolCallTimeline({ traces }: { traces: ToolCallTrace[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!traces || traces.length === 0) return null;

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`${expanded ? "Collapse" : "Expand"} tool call details`}
        data-testid="button-toggle-tool-calls"
      >
        <Wrench className="h-3 w-3" />
        <span>{traces.length} tool{traces.length !== 1 ? "s" : ""} used</span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="mt-1 ml-2 border-l-2 border-border pl-3 space-y-1">
          {traces.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-xs" data-testid={`text-tool-trace-${i}`}>
              {t.status === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-0.5 shrink-0" />
              ) : t.status === "success" ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-medium">{formatToolName(t.toolName)}</span>
                {t.durationMs != null && <span className="text-muted-foreground ml-1">({t.durationMs}ms)</span>}
                {t.error && <p className="text-red-500 mt-0.5">{t.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<ChatMessage[]>([]);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallTrace[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  convIdRef.current = conversationId;

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/agent/conversations"],
    enabled: open && showHistory,
  });

  const { data: chatData } = useQuery<{
    messages: ChatMessage[];
    toolCalls: ToolCallTrace[];
  }>({
    queryKey: ["/api/agent/conversations", conversationId, "messages"],
    enabled: !!conversationId && open,
  });

  const messages = chatData?.messages || [];

  const { data: drafts = [] } = useQuery<DraftRecord[]>({
    queryKey: ["/api/agent/drafts"],
    enabled: open,
  });

  const pendingDrafts = drafts.filter((d) => d.status === "pending");

  const approveMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/conversations", convIdRef.current, "messages"] });
      toast({ title: "Approved", description: "Draft has been approved and created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve draft", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/drafts"] });
      toast({ title: "Rejected", description: "Draft has been rejected." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject draft", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessages, pendingToolCalls, streamText]);

  useEffect(() => {
    if (messages.length > 0 && streamingMessages.length > 0 && !isStreaming) {
      setStreamingMessages([]);
    }
  }, [messages, streamingMessages.length, isStreaming]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => ALLOWED_FILE_TYPES.includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) {
      toast({ title: "Some files skipped", description: "Only images, PDFs, text, CSV, and XLSX under 10MB are supported.", variant: "destructive" });
    }
    setAttachedFiles(prev => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = useCallback(async () => {
    if ((!message.trim() && attachedFiles.length === 0) || isStreaming) return;
    const userMsg = message.trim();
    const filesToSend = [...attachedFiles];
    setMessage("");
    setAttachedFiles([]);
    setIsStreaming(true);
    setPendingToolCalls([]);
    setStreamText("");

    const fileLabels = filesToSend.map(f => f.type.startsWith("image/") ? `[Image: ${f.name}]` : `[File: ${f.name}]`);
    const displayContent = userMsg + (fileLabels.length > 0 ? "\n" + fileLabels.join(" ") : "");

    setStreamingMessages(prev => [...prev, {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: displayContent,
      createdAt: new Date().toISOString(),
    }]);

    let resolvedConvId = conversationId;

    try {
      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("message", userMsg || "Please analyze the attached file(s).");
        if (conversationId) formData.append("conversationId", conversationId);
        filesToSend.forEach(f => formData.append("files", f));

        const response = await fetch("/api/agent/chat-multimodal", {
          method: "POST",
          headers: { "x-org-id": getCurrentOrgId() || "default-org-id" },
          body: formData,
        });
        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          throw new Error(errBody || `HTTP ${response.status}`);
        }
        const result = await response.json() as { conversationId?: string; response?: string; toolCalls?: ToolCallTrace[] };
        if (result.conversationId) {
          resolvedConvId = result.conversationId;
          setConversationId(result.conversationId);
        }
        setStreamingMessages(prev => [...prev, {
          id: `temp-assistant-${Date.now()}`,
          role: "assistant",
          content: result.response || "",
          toolCalls: result.toolCalls,
          createdAt: new Date().toISOString(),
        }]);
      } else {
        const params = new URLSearchParams({ message: userMsg });
        if (conversationId) params.set("conversationId", conversationId);

        const response = await fetch(`/api/agent/chat-stream?${params}`, {
          headers: { "x-org-id": getCurrentOrgId() || "default-org-id" },
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          throw new Error(errBody || `Stream failed (${response.status})`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let accToolCalls: ToolCallTrace[] = [];
        let toolCallCounter = 0;

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const dataMatch = line.match(/^data: (.+)$/m);
            if (!dataMatch) continue;

            try {
              const chunk: StreamChunk = JSON.parse(dataMatch[1]);

              if (chunk.type === "tool_call") {
                const trace: ToolCallTrace = {
                  toolName: chunk.toolName || "unknown",
                  input: chunk.input || {},
                  status: "running",
                  _index: toolCallCounter++,
                };
                accToolCalls = [...accToolCalls, trace];
                setPendingToolCalls([...accToolCalls]);
              } else if (chunk.type === "tool_result") {
                const runningIdx = accToolCalls.findIndex(
                  (tc) => tc.toolName === chunk.toolName && tc.status === "running"
                );
                if (runningIdx >= 0) {
                  accToolCalls = accToolCalls.map((tc, i) =>
                    i === runningIdx ? { ...tc, result: chunk.result, status: "success" as const } : tc
                  );
                }
                setPendingToolCalls([...accToolCalls]);
              } else if (chunk.type === "text") {
                accumulated += chunk.content || "";
                setStreamText(accumulated);
              } else if (chunk.type === "done") {
                if (chunk.conversationId) {
                  resolvedConvId = chunk.conversationId;
                  setConversationId(chunk.conversationId);
                }
              } else if (chunk.type === "error") {
                throw new Error(chunk.error || "Stream error");
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

        setStreamingMessages(prev => [...prev, {
          id: `temp-assistant-${Date.now()}`,
          role: "assistant",
          content: accumulated || "(No response)",
          toolCalls: accToolCalls.length > 0 ? accToolCalls : undefined,
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to get response";
      toast({ title: "Error", description: errMsg, variant: "destructive" });
      setStreamingMessages(prev => [...prev, {
        id: `temp-error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, something went wrong: ${errMsg}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsStreaming(false);
      setPendingToolCalls([]);
      setStreamText("");
      if (resolvedConvId) {
        queryClient.invalidateQueries({ queryKey: ["/api/agent/conversations", resolvedConvId, "messages"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agent/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/conversations"] });
    }
  }, [message, conversationId, isStreaming, attachedFiles, queryClient, toast]);

  const startNewConversation = () => {
    setConversationId(null);
    setStreamingMessages([]);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const selectConversation = (id: string) => {
    setConversationId(id);
    setShowHistory(false);
    setStreamingMessages([]);
  };

  const allMessages = [...messages, ...streamingMessages].filter(
    m => m.role !== "tool" && !(m.role === "assistant" && m.toolCalls && !m.content)
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[440px] p-0 flex flex-col" data-testid="card-agent-chat-panel">
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            {showHistory ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} aria-label="Back to chat" data-testid="button-back-to-chat">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle className="text-base">Conversations</SheetTitle>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <SheetTitle className="text-base">ARUS Copilot</SheetTitle>
                {pendingDrafts.length > 0 && (
                  <span className="h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium" data-testid="badge-pending-drafts">
                    {pendingDrafts.length}
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-1">
              {!showHistory && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => setShowHistory(true)} aria-label="Show conversation history" data-testid="button-show-history">
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={startNewConversation} aria-label="Start new conversation" data-testid="button-new-conversation">
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        {showHistory ? (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-conversations">No conversations yet</p>
              )}
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className={cn(
                    "w-full text-left p-3 rounded-md hover:bg-muted transition-colors",
                    conversationId === conv.id && "bg-accent"
                  )}
                  onClick={() => selectConversation(conv.id)}
                  data-testid={`button-conversation-${conv.id}`}
                >
                  <p className="text-sm font-medium truncate">{conv.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {conv.messageCount} messages · {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto" ref={scrollRef}>
              <div className="p-4 space-y-4">
                {allMessages.length === 0 && !isStreaming && (
                  <div className="text-center py-12 space-y-3" data-testid="card-empty-state">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground/40" />
                    <div>
                      <p className="font-medium text-sm" data-testid="text-welcome">ARUS Copilot</p>
                      <p className="text-xs text-muted-foreground mt-1" data-testid="text-welcome-description">
                        Ask about equipment, maintenance, alerts, or request work orders
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {[
                        "Show riskiest equipment",
                        "Open alerts summary",
                        "Maintenance schedule overview",
                      ].map(q => (
                        <Button
                          key={q}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => { setMessage(q); }}
                          data-testid={`button-suggestion-${q.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {allMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                      data-testid={`text-message-${msg.id}`}
                    >
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <ToolCallTimeline traces={msg.toolCalls} />
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {isStreaming && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2 max-w-[85%]">
                      {pendingToolCalls.length > 0 && (
                        <div className="mb-1.5 space-y-1">
                          {pendingToolCalls.map((tc) => (
                            <div key={tc._index} className="flex items-center gap-2 text-xs text-muted-foreground">
                              {tc.status === "running" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              )}
                              <Wrench className="h-3 w-3" />
                              <span>{tc.status === "running" ? "Running" : "Completed"} {formatToolName(tc.toolName)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {streamText ? (
                        <p className="text-sm whitespace-pre-wrap" data-testid="text-streaming-response">{streamText}</p>
                      ) : (
                        <div className="flex items-center gap-2" data-testid="status-streaming">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {pendingDrafts.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-xs font-medium text-muted-foreground">Pending Approvals</p>
                    {pendingDrafts.map((draft) => (
                      <div key={draft.id} className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 space-y-2" data-testid={`card-draft-${draft.id}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-medium" data-testid={`text-draft-title-${draft.id}`}>{draft.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground" data-testid={`text-draft-type-${draft.id}`}>
                          {draft.draftType === "work_order" ? "Work Order Draft" : draft.draftType}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            onClick={() => approveMutation.mutate(draft.id)}
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-draft-${draft.id}`}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => rejectMutation.mutate(draft.id)}
                            disabled={rejectMutation.isPending}
                            data-testid={`button-reject-draft-${draft.id}`}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 border-t p-3">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs" data-testid={`badge-attached-file-${i}`}>
                      {f.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="max-w-[100px] truncate">{f.name}</span>
                      <button onClick={() => removeFile(i)} className="hover:text-destructive" aria-label={`Remove ${f.name}`} data-testid={`button-remove-file-${i}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label="Upload files"
                  data-testid="input-file-upload"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || attachedFiles.length >= 5}
                  className="flex-shrink-0"
                  aria-label="Attach file"
                  data-testid="button-attach-file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={attachedFiles.length > 0 ? "Describe what to do with the file(s)..." : "Ask about your fleet..."}
                  disabled={isStreaming}
                  className="flex-1"
                  data-testid="input-agent-message"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={(!message.trim() && attachedFiles.length === 0) || isStreaming}
                  aria-label="Send message"
                  data-testid="button-send-message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
