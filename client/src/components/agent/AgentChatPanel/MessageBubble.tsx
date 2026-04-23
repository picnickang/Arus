import { Bot, FileText, Image as ImageIcon } from "lucide-react";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { cn } from "@/lib/utils";
import { ToolCallTimeline } from "./ToolCallTimeline";
import { InlineDraftApproval } from "./InlineDraftApproval";
import type { ChatMessage } from "./types";

export function MessageBubble({
  msg,
  onApprove,
  onReject,
  approvalPending,
}: {
  msg: ChatMessage;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approvalPending: boolean;
}) {
  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      {msg.role === "assistant" && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 mr-2">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
        data-testid={`text-message-${msg.id}`}
      >
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {msg.attachments.map((att) => (
              <div
                key={att.fileId}
                className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs bg-background/50"
                data-testid={`attachment-card-${att.fileId}`}
              >
                {att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.filename}
                    className="w-8 h-8 rounded object-cover"
                  />
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
        {msg.toolCalls && msg.toolCalls.length > 0 && <ToolCallTimeline traces={msg.toolCalls} />}
        {msg.role === "assistant" && msg.content ? (
          <SafeMarkdown
            content={msg.content}
            className="text-sm [&_p]:text-foreground [&_p]:leading-relaxed"
          />
        ) : (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        )}
        {msg.inlineDraft && (
          <InlineDraftApproval
            draft={msg.inlineDraft}
            onApprove={onApprove}
            onReject={onReject}
            isPending={approvalPending}
          />
        )}
      </div>
    </div>
  );
}
