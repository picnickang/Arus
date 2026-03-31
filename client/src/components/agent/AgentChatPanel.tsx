import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, Send, Plus, Loader2,
  Wrench, CheckCircle, XCircle, AlertTriangle,
  Clock, ArrowLeft,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: any;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  status: string;
}

interface StreamChunk {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
  input?: any;
  result?: any;
  conversationId?: string;
  error?: string;
}

export function AgentChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<ChatMessage[]>([]);
  const [pendingToolCalls, setPendingToolCalls] = useState<{ toolName: string; input: any }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/agent/conversations"],
    enabled: open && showHistory,
  });

  const { data: chatData } = useQuery<{
    messages: ChatMessage[];
    toolCalls: any[];
  }>({
    queryKey: ["/api/agent/conversations", conversationId, "messages"],
    enabled: !!conversationId && open,
  });

  const messages = chatData?.messages || [];

  const { data: drafts = [] } = useQuery<any[]>({
    queryKey: ["/api/agent/drafts"],
    enabled: open,
  });

  const pendingDrafts = drafts.filter((d: any) => d.status === "pending");

  const approveMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/conversations", conversationId, "messages"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/drafts"] });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessages, pendingToolCalls]);

  const sendMessage = useCallback(async () => {
    if (!message.trim() || isStreaming) return;
    const userMsg = message.trim();
    setMessage("");
    setIsStreaming(true);
    setPendingToolCalls([]);

    setStreamingMessages(prev => [...prev, {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: userMsg,
      createdAt: new Date().toISOString(),
    }]);

    try {
      const params = new URLSearchParams({ message: userMsg });
      if (conversationId) params.set("conversationId", conversationId);

      const response = await fetch(`/api/agent/chat-stream?${params}`, {
        headers: { "x-org-id": getCurrentOrgId() || "default-org-id" },
      });

      if (!response.ok) throw new Error("Stream failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              setPendingToolCalls(prev => [...prev, {
                toolName: chunk.toolName!,
                input: chunk.input,
              }]);
            } else if (chunk.type === "tool_result") {
              setPendingToolCalls(prev =>
                prev.filter(tc => tc.toolName !== chunk.toolName)
              );
            } else if (chunk.type === "text") {
              setStreamingMessages(prev => [...prev, {
                id: `temp-assistant-${Date.now()}`,
                role: "assistant",
                content: chunk.content || "",
                createdAt: new Date().toISOString(),
              }]);
            } else if (chunk.type === "done") {
              if (chunk.conversationId) {
                setConversationId(chunk.conversationId);
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setStreamingMessages(prev => [...prev, {
        id: `temp-error-${Date.now()}`,
        role: "assistant",
        content: `Error: ${err.message || "Failed to get response"}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsStreaming(false);
      setPendingToolCalls([]);
      setStreamingMessages([]);
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/agent/conversations", conversationId, "messages"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agent/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/conversations"] });
    }
  }, [message, conversationId, isStreaming, queryClient]);

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
      <SheetContent side="right" className="w-full sm:w-[440px] p-0 flex flex-col" data-testid="agent-chat-panel">
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            {showHistory ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} data-testid="button-back-chat">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle className="text-base">Conversations</SheetTitle>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <SheetTitle className="text-base">ARUS Copilot</SheetTitle>
              </div>
            )}
            <div className="flex gap-1">
              {!showHistory && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => setShowHistory(true)} data-testid="button-history">
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={startNewConversation} data-testid="button-new-chat">
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
                <p className="text-sm text-muted-foreground text-center py-8">No conversations yet</p>
              )}
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors"
                  onClick={() => selectConversation(conv.id)}
                  data-testid={`conv-item-${conv.id}`}
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
                  <div className="text-center py-12 space-y-3">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground/40" />
                    <div>
                      <p className="font-medium text-sm">ARUS Copilot</p>
                      <p className="text-xs text-muted-foreground mt-1">
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
                          data-testid={`suggestion-${q.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {allMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`msg-${msg.role}-${msg.id}`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {pendingToolCalls.map((tc, i) => (
                  <div key={`pending-tc-${i}`} className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <Wrench className="h-3 w-3" />
                    <span>Running {tc.toolName}...</span>
                  </div>
                ))}

                {isStreaming && pendingToolCalls.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}

                {pendingDrafts.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-xs font-medium text-muted-foreground">Pending Approvals</p>
                    {pendingDrafts.map((draft: any) => (
                      <div key={draft.id} className="border rounded-lg p-3 space-y-2" data-testid={`draft-${draft.id}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-medium">{draft.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {draft.draftType === "work_order" ? "Work Order Draft" : draft.draftType}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            onClick={() => approveMutation.mutate(draft.id)}
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-${draft.id}`}
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
                            data-testid={`button-reject-${draft.id}`}
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
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex gap-2"
              >
                <Input
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about your fleet..."
                  disabled={isStreaming}
                  className="flex-1"
                  data-testid="input-agent-message"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!message.trim() || isStreaming}
                  data-testid="button-send-agent"
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
