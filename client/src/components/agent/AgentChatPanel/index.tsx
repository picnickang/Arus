import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

import { MAX_RETRIES } from "./constants";
import { fetchStreamWithRetry, readStreamWithRetry } from "./streamClient";
import { AgentChatPanelShell } from "./AgentChatPanelShell";
import { useAgentChatAttachments } from "./useAgentChatAttachments";
import { useAgentChatVoice } from "./useAgentChatVoice";
import type {
  ChatMessage,
  Conversation,
  DraftRecord,
  FileRef,
  StreamChunk,
  ToolCallTrace,
} from "./types";

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
  const [streamText, setStreamText] = useState("");
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatFormRef = useRef<HTMLFormElement>(null);
  const convIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    attachedFiles,
    fileInputRef,
    filePreviews,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    isDragOver,
    removeFile,
    setAttachedFiles,
    setFilePreviews,
    setUploadProgress,
    uploadProgress,
  } = useAgentChatAttachments();
  const { isListening, toggleVoiceInput } = useAgentChatVoice({ setMessage });

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
    <AgentChatPanelShell
      allMessages={allMessages}
      approvalPending={approvalPending}
      attachedFiles={attachedFiles}
      chatFormRef={chatFormRef}
      conversationId={conversationId}
      conversations={conversations}
      fileInputRef={fileInputRef}
      filePreviews={filePreviews}
      handleApprove={handleApprove}
      handleDragLeave={handleDragLeave}
      handleDragOver={handleDragOver}
      handleDrop={handleDrop}
      handleFileSelect={handleFileSelect}
      handleReject={handleReject}
      inputRef={inputRef}
      isDragOver={isDragOver}
      isListening={isListening}
      isStreaming={isStreaming}
      message={message}
      onClose={onClose}
      open={open}
      pendingDraftCount={pendingDraftCount}
      pendingToolCalls={pendingToolCalls}
      removeFile={removeFile}
      retryStatus={retryStatus}
      scrollRef={scrollRef}
      selectConversation={selectConversation}
      sendMessage={sendMessage}
      setMessage={setMessage}
      setShowHistory={setShowHistory}
      showHistory={showHistory}
      startNewConversation={startNewConversation}
      streamText={streamText}
      toggleVoiceInput={toggleVoiceInput}
      uploadProgress={uploadProgress}
    />
  );
}
