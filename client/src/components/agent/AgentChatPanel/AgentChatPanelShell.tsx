import type { Dispatch, DragEventHandler, RefObject, SetStateAction } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bot, Plus, ArrowLeft, Clock, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationHistory } from "./ConversationHistory";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";
import { MessageInputBar } from "./MessageInputBar";
import { StreamingIndicator } from "./StreamingIndicator";
import type { ChatMessage, Conversation, ToolCallTrace } from "./types";

export function AgentChatPanelShell({
  allMessages,
  approvalPending,
  attachedFiles,
  chatFormRef,
  conversationId,
  conversations,
  fileInputRef,
  filePreviews,
  handleApprove,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleFileSelect,
  handleReject,
  inputRef,
  isDragOver,
  isListening,
  isStreaming,
  message,
  onClose,
  open,
  pendingDraftCount,
  pendingToolCalls,
  removeFile,
  retryStatus,
  scrollRef,
  selectConversation,
  sendMessage,
  setMessage,
  setShowHistory,
  showHistory,
  startNewConversation,
  streamText,
  toggleVoiceInput,
  uploadProgress,
}: {
  allMessages: ChatMessage[];
  approvalPending: boolean;
  attachedFiles: File[];
  chatFormRef: RefObject<HTMLFormElement>;
  conversationId: string | null;
  conversations: Conversation[];
  fileInputRef: RefObject<HTMLInputElement>;
  filePreviews: Map<string, string>;
  handleApprove: (draftId: string) => void;
  handleDragLeave: DragEventHandler<HTMLDivElement>;
  handleDragOver: DragEventHandler<HTMLDivElement>;
  handleDrop: DragEventHandler<HTMLDivElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleReject: (draftId: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  isDragOver: boolean;
  isListening: boolean;
  isStreaming: boolean;
  message: string;
  onClose: () => void;
  open: boolean;
  pendingDraftCount: number;
  pendingToolCalls: ToolCallTrace[];
  removeFile: (index: number) => void;
  retryStatus: string | null;
  scrollRef: RefObject<HTMLDivElement>;
  selectConversation: (id: string) => void;
  sendMessage: () => void;
  setMessage: Dispatch<SetStateAction<string>>;
  setShowHistory: Dispatch<SetStateAction<boolean>>;
  showHistory: boolean;
  startNewConversation: () => void;
  streamText: string;
  toggleVoiceInput: () => void;
  uploadProgress: number | null;
}) {
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
