import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bot, Plus, ArrowLeft, Clock, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { ALLOWED_FILE_TYPES, MAX_ATTACHMENTS, MAX_FILE_SIZE_BYTES, MAX_RETRIES } from "./constants";
import { fetchStreamWithRetry, readStreamWithRetry } from "./streamClient";
import { ConversationHistory } from "./ConversationHistory";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";
import { MessageInputBar } from "./MessageInputBar";
import type {
  ChatMessage,
  Conversation,
  DraftRecord,
  FileRef,
  StreamChunk,
  ToolCallTrace,
} from "./types";

interface MinimalSpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export function AgentChatPanel({
  open,
  onClose,
  initialMessage,
}: {
  open: boolean;
  onClose: () => void;
  initialMessage?: string | null;
}) {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<ChatMessage[]>([]);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallTrace[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [streamText, setStreamText] = useState("");
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [filePreviews, setFilePreviews] = useState<Map<string, string>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFormRef = useRef<HTMLFormElement>(null);
  const convIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
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

  const serverMessages = chatData?.messages || [];

  const { data: drafts = [] } = useQuery<DraftRecord[]>({
    queryKey: ["/api/agent/drafts"],
    enabled: open,
  });

  const currentConvDrafts = drafts.filter((d) => d.conversationId === conversationId);
  const pendingDraftCount = drafts.filter((d) => d.status === "pending").length;

  const messagesWithDrafts: ChatMessage[] = (() => {
    const usedDraftIds = new Set<string>();
    const sortedDrafts = [...currentConvDrafts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return serverMessages.map((msg) => {
      if (msg.role !== "assistant") {
        return msg;
      }
      const msgTime = new Date(msg.createdAt).getTime();
      const matchingDraft = sortedDrafts.find(
        (d) =>
          !usedDraftIds.has(d.id) &&
          new Date(d.createdAt).getTime() >= msgTime - 5000 &&
          new Date(d.createdAt).getTime() <= msgTime + 60000
      );
      if (matchingDraft) {
        usedDraftIds.add(matchingDraft.id);
        return { ...msg, inlineDraft: matchingDraft };
      }
      return msg;
    });
  })();

  const approveMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/drafts"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/agent/conversations", convIdRef.current, "messages"],
      });
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
  }, [serverMessages, streamingMessages, pendingToolCalls, streamText]);

  useEffect(() => {
    if (serverMessages.length > 0 && streamingMessages.length > 0 && !isStreaming) {
      setStreamingMessages([]);
    }
  }, [serverMessages, streamingMessages.length, isStreaming]);

  const initialMessageRef = useRef<string | null>(null);
  useEffect(() => {
    if (open && initialMessage && initialMessage !== initialMessageRef.current && !isStreaming) {
      initialMessageRef.current = initialMessage;
      setConversationId(null);
      setStreamingMessages([]);
      setMessage(initialMessage);
      setTimeout(() => {
        if (chatFormRef.current) {
          chatFormRef.current.requestSubmit();
        }
      }, 100);
    }
    if (!open) {
      initialMessageRef.current = null;
    }
  }, [open, initialMessage, isStreaming]);

  const generatePreview = useCallback((file: File) => {
    if (file.type.startsWith("image/")) {
      const key = `${file.name}-${file.size}`;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setFilePreviews((prev) => new Map(prev).set(key, result));
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter(
        (f) => ALLOWED_FILE_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE_BYTES
      );
      if (valid.length < files.length) {
        toast({
          title: "Some files skipped",
          description: "Only PNG/JPG images, PDFs, and CSV files under 10MB are supported.",
          variant: "destructive",
        });
      }
      valid.forEach(generatePreview);
      setAttachedFiles((prev) => [...prev, ...valid].slice(0, MAX_ATTACHMENTS));
    },
    [toast, generatePreview]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => {
      const removed = prev[index];
      if (removed) {
        const key = `${removed.name}-${removed.size}`;
        setFilePreviews((p) => {
          const n = new Map(p);
          n.delete(key);
          return n;
        });
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    },
    [addFiles]
  );

  const toggleVoiceInput = useCallback(() => {
    type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;
    const W = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionAPI = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast({
        title: "Not supported",
        description: "Voice input is not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: MinimalSpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, toast]);

  const sendMessage = useCallback(async () => {
    if ((!message.trim() && attachedFiles.length === 0) || isStreaming) {
      return;
    }
    const userMsg = message.trim();
    const filesToSend = [...attachedFiles];
    setMessage("");
    setAttachedFiles([]);
    setFilePreviews(new Map());
    setIsStreaming(true);
    setPendingToolCalls([]);
    setStreamText("");
    setRetryStatus(null);

    const localAttachments: FileRef[] = filesToSend.map((f) => {
      const previewKey = `${f.name}-${f.size}`;
      return {
        fileId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        filename: f.name,
        mimetype: f.type,
        size: f.size,
        previewUrl: filePreviews.get(previewKey),
      };
    });

    setStreamingMessages((prev) => [
      ...prev,
      {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: userMsg || (filesToSend.length > 0 ? "Attached file(s) for analysis" : ""),
        attachments: localAttachments.length > 0 ? localAttachments : undefined,
        createdAt: new Date().toISOString(),
      },
    ]);

    let resolvedConvId = conversationId;

    try {
      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("message", userMsg || "Please analyze the attached file(s).");
        if (conversationId) {
          formData.append("conversationId", conversationId);
        }
        filesToSend.forEach((f) => formData.append("files", f));

        setUploadProgress(0);
        const result = await new Promise<{
          conversationId?: string;
          response?: string;
          toolCalls?: ToolCallTrace[];
          files?: FileRef[];
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/agent/chat-multimodal");
          xhr.setRequestHeader("x-org-id", getCurrentOrgId() || "default-org-id");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => {
            setUploadProgress(null);
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new Error("Invalid response"));
              }
            } else {
              reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
            }
          };
          xhr.onerror = () => {
            setUploadProgress(null);
            reject(new Error("Upload failed"));
          };
          xhr.send(formData);
        });

        if (result.conversationId) {
          resolvedConvId = result.conversationId;
          setConversationId(result.conversationId);
        }
        setStreamingMessages((prev) => [
          ...prev,
          {
            id: `temp-assistant-${Date.now()}`,
            role: "assistant",
            content: result.response || "",
            toolCalls: result.toolCalls,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        const params = new URLSearchParams({ message: userMsg });
        if (conversationId) {
          params.set("conversationId", conversationId);
        }

        const headers: Record<string, string> = {
          "x-org-id": getCurrentOrgId() || "default-org-id",
        };

        const response = await fetchStreamWithRetry(
          `/api/agent/chat-stream?${params}`,
          headers,
          MAX_RETRIES,
          (attempt) => setRetryStatus(`Reconnecting (attempt ${attempt}/${MAX_RETRIES})...`)
        );
        setRetryStatus(null);

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        let buffer = "";
        let accumulated = "";
        let accToolCalls: ToolCallTrace[] = [];
        let toolCallCounter = 0;
        let inlineDraft: DraftRecord | undefined;

        await readStreamWithRetry(
          reader,
          (rawText) => {
            buffer += rawText;
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const dataMatch = line.match(/^data: (.+)$/m);
              if (!dataMatch) {
                continue;
              }

              try {
                const chunk: StreamChunk = JSON.parse(dataMatch[1] ?? "{}");

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
                      i === runningIdx
                        ? { ...tc, result: chunk.result, status: "success" as const }
                        : tc
                    );
                  }
                  setPendingToolCalls([...accToolCalls]);
                } else if (chunk.type === "text") {
                  accumulated += chunk.content || "";
                  setStreamText(accumulated);
                } else if (chunk.type === "draft" && chunk.draft) {
                  inlineDraft = chunk.draft;
                } else if (chunk.type === "done") {
                  if (chunk.conversationId) {
                    resolvedConvId = chunk.conversationId;
                    setConversationId(chunk.conversationId);
                  }
                } else if (chunk.type === "error") {
                  throw new Error(chunk.error || "Stream error");
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) {
                  continue;
                }
                throw parseErr;
              }
            }
          },
          (attempt) =>
            setRetryStatus(`Stream interrupted, reconnecting (${attempt}/${MAX_RETRIES})...`),
          MAX_RETRIES
        );

        setStreamingMessages((prev) => [
          ...prev,
          {
            id: `temp-assistant-${Date.now()}`,
            role: "assistant",
            content: accumulated || "(No response)",
            toolCalls: accToolCalls.length > 0 ? accToolCalls : undefined,
            inlineDraft,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to get response";
      toast({ title: "Error", description: errMsg, variant: "destructive" });
      setStreamingMessages((prev) => [
        ...prev,
        {
          id: `temp-error-${Date.now()}`,
          role: "assistant",
          content: `Sorry, something went wrong: ${errMsg}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setPendingToolCalls([]);
      setStreamText("");
      setRetryStatus(null);
      if (resolvedConvId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/agent/conversations", resolvedConvId, "messages"],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agent/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/conversations"] });
    }
  }, [message, conversationId, isStreaming, attachedFiles, filePreviews, queryClient, toast]);

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

  const allMessages = [...messagesWithDrafts, ...streamingMessages].filter(
    (m) => m.role !== "tool" && !(m.role === "assistant" && m.toolCalls && !m.content)
  );

  const handleApprove = useCallback(
    (draftId: string) => approveMutation.mutate(draftId),
    [approveMutation]
  );
  const handleReject = useCallback(
    (draftId: string) => rejectMutation.mutate(draftId),
    [rejectMutation]
  );
  const approvalPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] p-0 flex flex-col"
        data-testid="card-agent-chat-panel"
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            {showHistory ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHistory(false)}
                  aria-label="Back to chat"
                  data-testid="button-back-to-chat"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle className="text-base">Conversations</SheetTitle>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <SheetTitle className="text-base">ARUS Copilot</SheetTitle>
                {pendingDraftCount > 0 && (
                  <span
                    className="h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium"
                    data-testid="badge-pending-drafts"
                  >
                    {pendingDraftCount}
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-1">
              {!showHistory && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowHistory(true)}
                    aria-label="Show conversation history"
                    data-testid="button-show-history"
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startNewConversation}
                    aria-label="Start new conversation"
                    data-testid="button-new-conversation"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        {showHistory ? (
          <ConversationHistory
            conversations={conversations}
            selectedId={conversationId}
            onSelect={selectConversation}
          />
        ) : (
          <>
            <div
              className={cn(
                "flex-1 overflow-y-auto relative",
                isDragOver && "ring-2 ring-primary ring-inset"
              )}
              ref={scrollRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragOver && (
                <div className="absolute inset-0 bg-primary/5 z-10 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm font-medium">Drop files here</span>
                  </div>
                </div>
              )}
              <div className="p-4 space-y-4">
                {allMessages.length === 0 && !isStreaming && (
                  <EmptyState onSelectPrompt={(q) => setMessage(q)} />
                )}

                {allMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    approvalPending={approvalPending}
                  />
                ))}

                {isStreaming && (
                  <StreamingIndicator
                    pendingToolCalls={pendingToolCalls}
                    retryStatus={retryStatus}
                    streamText={streamText}
                  />
                )}
              </div>
            </div>

            <MessageInputBar
              message={message}
              setMessage={setMessage}
              attachedFiles={attachedFiles}
              filePreviews={filePreviews}
              uploadProgress={uploadProgress}
              isStreaming={isStreaming}
              isListening={isListening}
              onRemoveFile={removeFile}
              onPickFiles={handleFileSelect}
              onToggleVoice={toggleVoiceInput}
              onSubmit={sendMessage}
              inputRef={inputRef}
              fileInputRef={fileInputRef}
              formRef={chatFormRef}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
