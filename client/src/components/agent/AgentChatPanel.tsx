import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import {
  Bot, Send, Plus, Loader2,
  Wrench, CheckCircle, XCircle, AlertTriangle,
  Clock, ArrowLeft, Paperclip, X, FileText, Image as ImageIcon,
  ChevronRight, ChevronDown, Mic, MicOff, Upload,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FileRef {
  fileId: string;
  filename: string;
  mimetype: string;
  size: number;
  previewUrl?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCallTrace[];
  createdAt: string;
  inlineDraft?: DraftRecord;
  attachments?: FileRef[];
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
  type: "text" | "tool_call" | "tool_result" | "done" | "error" | "draft";
  content?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  conversationId?: string;
  error?: string;
  draft?: DraftRecord;
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
  "image/png", "image/jpeg",
  "application/pdf", "text/csv",
];

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function ToolCallTimeline({ traces }: { traces: ToolCallTrace[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!traces || traces.length === 0) {return null;}

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

function InlineDraftApproval({
  draft,
  onApprove,
  onReject,
  isPending,
}: {
  draft: DraftRecord;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}) {
  const draftData = draft.data || {};
  const estimatedHours = draftData.estimatedHours as number | undefined;
  const estimatedCostPerHour = draftData.estimatedCostPerHour as number | undefined;
  const estimatedLaborCost = draftData.estimatedLaborCost as number | undefined;
  const estimatedPartsCost = draftData.estimatedPartsCost as number | undefined;
  const costJustification = draftData.costJustification as string | undefined;
  const hasCostInfo = estimatedHours != null || estimatedCostPerHour != null || estimatedLaborCost != null || estimatedPartsCost != null || costJustification;

  return (
    <div className="mt-2 border border-amber-500/30 bg-amber-500/5 rounded-md p-2.5" data-testid={`card-draft-${draft.id}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" data-testid={`text-draft-title-${draft.id}`}>{draft.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5" data-testid={`text-draft-type-${draft.id}`}>
            {draft.draftType === "work_order" ? "Work Order" : draft.draftType} — requires approval
          </p>
          {hasCostInfo && (
            <div className="mt-1.5 p-1.5 bg-muted/50 rounded text-[11px] space-y-0.5" data-testid={`cost-info-${draft.id}`}>
              {(estimatedHours != null || estimatedLaborCost != null || estimatedPartsCost != null) && (
                <div className="space-y-0.5 text-muted-foreground">
                  {(estimatedHours != null || estimatedLaborCost != null) && (
                    <div className="flex items-center gap-2">
                      <span>💰</span>
                      <span>
                        Labor: {estimatedHours != null && `${estimatedHours}h`}
                        {estimatedCostPerHour != null && ` × $${estimatedCostPerHour}/hr`}
                        {estimatedLaborCost != null && ` = $${estimatedLaborCost.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                  {estimatedPartsCost != null && (
                    <div className="flex items-center gap-2">
                      <span>🔧</span>
                      <span>Parts: ~${estimatedPartsCost.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              {costJustification && (
                <p className="text-muted-foreground italic" data-testid={`cost-justification-${draft.id}`}>
                  {costJustification}
                </p>
              )}
            </div>
          )}
          {draft.status === "pending" ? (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="default"
                className="h-6 text-[11px] px-2"
                onClick={() => onApprove(draft.id)}
                disabled={isPending}
                data-testid={`button-approve-draft-${draft.id}`}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2"
                onClick={() => onReject(draft.id)}
                disabled={isPending}
                data-testid={`button-reject-draft-${draft.id}`}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          ) : (
            <span className={cn(
              "inline-block mt-1.5 text-[11px] px-1.5 py-0.5 rounded",
              draft.status === "approved" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
            )} data-testid={`badge-draft-status-${draft.id}`}>
              {draft.status === "approved" ? "Approved" : "Rejected"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

class ClientError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ClientError";
  }
}

async function fetchStreamWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries: number,
  onRetry: (attempt: number) => void,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers, credentials: "include" });
      if (response.ok) {return response;}
      const status = response.status;
      const errBody = await response.text().catch(() => "");
      if (status >= 400 && status < 500) {
        throw new ClientError(errBody || `HTTP ${status}`, status);
      }
      lastError = new Error(errBody || `HTTP ${status}`);
    } catch (err) {
      if (err instanceof ClientError) {throw err;}
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < maxRetries) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      onRetry(attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError || new Error("Stream connection failed");
}

async function readStreamWithRetry(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
  onDisconnect: (attempt: number) => void,
  maxRetries: number,
): Promise<void> {
  const decoder = new TextDecoder();
  let disconnects = 0;

  while (true) {
    try {
      const { done, value } = await reader.read();
      if (done) {break;}
      disconnects = 0;
      onChunk(decoder.decode(value, { stream: true }));
    } catch (err) {
      disconnects++;
      if (disconnects > maxRetries) {
        throw err instanceof Error ? err : new Error("Stream read failed");
      }
      onDisconnect(disconnects);
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, disconnects - 1)));
    }
  }
}

export function AgentChatPanel({ open, onClose, initialMessage }: { open: boolean; onClose: () => void; initialMessage?: string | null }) {
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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
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

  const currentConvDrafts = drafts.filter(
    (d) => d.conversationId === conversationId
  );
  const pendingDraftCount = drafts.filter((d) => d.status === "pending").length;

  const messagesWithDrafts: ChatMessage[] = (() => {
    const usedDraftIds = new Set<string>();
    const sortedDrafts = [...currentConvDrafts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return serverMessages.map((msg) => {
      if (msg.role !== "assistant") {return msg;}
      const msgTime = new Date(msg.createdAt).getTime();
      const matchingDraft = sortedDrafts.find(
        (d) => !usedDraftIds.has(d.id)
          && new Date(d.createdAt).getTime() >= msgTime - 5000
          && new Date(d.createdAt).getTime() <= msgTime + 60000
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
        if (chatFormRef.current) {chatFormRef.current.requestSubmit();}
      }, 100);
    }
    if (!open) {
      initialMessageRef.current = null;
    }
  }, [open, initialMessage, isStreaming]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    if (fileInputRef.current) {fileInputRef.current.value = "";}
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => {
      const removed = prev[index];
      if (removed) {
        const key = `${removed.name}-${removed.size}`;
        setFilePreviews(p => { const n = new Map(p); n.delete(key); return n; });
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const generatePreview = useCallback((file: File) => {
    if (file.type.startsWith("image/")) {
      const key = `${file.name}-${file.size}`;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setFilePreviews(prev => new Map(prev).set(key, e.target!.result as string));
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter(f => ALLOWED_FILE_TYPES.includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) {
      toast({ title: "Some files skipped", description: "Only PNG/JPG images, PDFs, and CSV files under 10MB are supported.", variant: "destructive" });
    }
    valid.forEach(generatePreview);
    setAttachedFiles(prev => [...prev, ...valid].slice(0, 5));
  }, [toast, generatePreview]);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {addFiles(droppedFiles);}
  }, [addFiles]);

  const toggleVoiceInput = useCallback(() => {
    type SpeechRecognitionConstructor = new () => SpeechRecognition;
    const W = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionAPI = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast({ title: "Not supported", description: "Voice input is not supported in this browser.", variant: "destructive" });
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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
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
    if ((!message.trim() && attachedFiles.length === 0) || isStreaming) {return;}
    const userMsg = message.trim();
    const filesToSend = [...attachedFiles];
    setMessage("");
    setAttachedFiles([]);
    setFilePreviews(new Map());
    setIsStreaming(true);
    setPendingToolCalls([]);
    setStreamText("");
    setRetryStatus(null);

    const localAttachments: FileRef[] = filesToSend.map(f => {
      const previewKey = `${f.name}-${f.size}`;
      return {
        fileId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        filename: f.name,
        mimetype: f.type,
        size: f.size,
        previewUrl: filePreviews.get(previewKey),
      };
    });

    setStreamingMessages(prev => [...prev, {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: userMsg || (filesToSend.length > 0 ? "Attached file(s) for analysis" : ""),
      attachments: localAttachments.length > 0 ? localAttachments : undefined,
      createdAt: new Date().toISOString(),
    }]);

    let resolvedConvId = conversationId;

    try {
      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("message", userMsg || "Please analyze the attached file(s).");
        if (conversationId) {formData.append("conversationId", conversationId);}
        filesToSend.forEach(f => formData.append("files", f));

        setUploadProgress(0);
        const result = await new Promise<{ conversationId?: string; response?: string; toolCalls?: ToolCallTrace[]; files?: FileRef[] }>((resolve, reject) => {
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
              try { resolve(JSON.parse(xhr.responseText)); }
              catch { reject(new Error("Invalid response")); }
            } else {
              reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
            }
          };
          xhr.onerror = () => { setUploadProgress(null); reject(new Error("Upload failed")); };
          xhr.send(formData);
        });

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
        if (conversationId) {params.set("conversationId", conversationId);}

        const headers: Record<string, string> = {
          "x-org-id": getCurrentOrgId() || "default-org-id",
        };

        const response = await fetchStreamWithRetry(
          `/api/agent/chat-stream?${params}`,
          headers,
          MAX_RETRIES,
          (attempt) => setRetryStatus(`Reconnecting (attempt ${attempt}/${MAX_RETRIES})...`),
        );
        setRetryStatus(null);

        const reader = response.body?.getReader();
        if (!reader) {throw new Error("No response body");}

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
              if (!dataMatch) {continue;}

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
                if (parseErr instanceof SyntaxError) {continue;}
                throw parseErr;
              }
            }
          },
          (attempt) => setRetryStatus(`Stream interrupted, reconnecting (${attempt}/${MAX_RETRIES})...`),
          MAX_RETRIES,
        );

        setStreamingMessages(prev => [...prev, {
          id: `temp-assistant-${Date.now()}`,
          role: "assistant",
          content: accumulated || "(No response)",
          toolCalls: accToolCalls.length > 0 ? accToolCalls : undefined,
          inlineDraft,
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
      setRetryStatus(null);
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

  const allMessages = [...messagesWithDrafts, ...streamingMessages].filter(
    m => m.role !== "tool" && !(m.role === "assistant" && m.toolCalls && !m.content)
  );

  const handleApprove = useCallback((draftId: string) => approveMutation.mutate(draftId), [approveMutation]);
  const handleReject = useCallback((draftId: string) => rejectMutation.mutate(draftId), [rejectMutation]);
  const approvalPending = approveMutation.isPending || rejectMutation.isPending;

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
                {pendingDraftCount > 0 && (
                  <span className="h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium" data-testid="badge-pending-drafts">
                    {pendingDraftCount}
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
            <div
              className={cn("flex-1 overflow-y-auto relative", isDragOver && "ring-2 ring-primary ring-inset")}
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
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {msg.attachments.map((att) => (
                            <div key={att.fileId} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs bg-background/50" data-testid={`attachment-card-${att.fileId}`}>
                              {att.previewUrl ? (
                                <img src={att.previewUrl} alt={att.filename} className="w-8 h-8 rounded object-cover" />
                              ) : att.mimetype.startsWith("image/") ? (
                                <ImageIcon className="h-4 w-4 shrink-0 opacity-70" />
                              ) : (
                                <FileText className="h-4 w-4 shrink-0 opacity-70" />
                              )}
                              <span className="max-w-[80px] truncate">{att.filename}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <ToolCallTimeline traces={msg.toolCalls} />
                      )}
                      {msg.role === "assistant" && msg.content ? (
                        <SafeMarkdown content={msg.content} className="text-sm [&_p]:text-foreground [&_p]:leading-relaxed" />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {msg.inlineDraft && (
                        <InlineDraftApproval
                          draft={msg.inlineDraft}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          isPending={approvalPending}
                        />
                      )}
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
                      {retryStatus && (
                        <div className="flex items-center gap-2 mb-1.5" data-testid="status-retry">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                          <span className="text-xs text-amber-600">{retryStatus}</span>
                        </div>
                      )}
                      {streamText ? (
                        <SafeMarkdown content={streamText} className="text-sm [&_p]:text-foreground [&_p]:leading-relaxed" />
                      ) : !retryStatus ? (
                        <div className="flex items-center gap-2" data-testid="status-streaming">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 border-t p-3">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachedFiles.map((f, i) => {
                    const previewKey = `${f.name}-${f.size}`;
                    const previewUrl = filePreviews.get(previewKey);
                    return (
                      <div key={i} className="relative group" data-testid={`badge-attached-file-${i}`}>
                        {previewUrl ? (
                          <div className="w-16 h-16 rounded border overflow-hidden bg-muted">
                            <img src={previewUrl} alt={f.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-muted rounded px-2 py-1.5 text-xs">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="max-w-[100px] truncate">{f.name}</span>
                          </div>
                        )}
                        <button
                          onClick={() => removeFile(i)}
                          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove ${f.name}`}
                          data-testid={`button-remove-file-${i}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {uploadProgress !== null && (
                <div className="mb-2" data-testid="upload-progress">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Uploading... {uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <form
                ref={chatFormRef}
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex gap-2"
                data-testid="form-agent-chat"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.pdf,.csv"
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
                  type="button"
                  variant={isListening ? "destructive" : "ghost"}
                  size="icon"
                  onClick={toggleVoiceInput}
                  disabled={isStreaming}
                  className="flex-shrink-0"
                  aria-label={isListening ? "Stop listening" : "Voice input"}
                  data-testid="button-voice-input"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
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
