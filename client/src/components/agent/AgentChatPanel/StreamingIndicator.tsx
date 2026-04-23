import { Bot, Loader2, Wrench, CheckCircle } from "lucide-react";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { formatToolName } from "./constants";
import type { ToolCallTrace } from "./types";

export function StreamingIndicator({
  pendingToolCalls,
  retryStatus,
  streamText,
}: {
  pendingToolCalls: ToolCallTrace[];
  retryStatus: string | null;
  streamText: string;
}) {
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 mr-2">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="bg-muted rounded-lg px-3 py-2 max-w-[85%]">
        {pendingToolCalls.length > 0 && (
          <div className="mb-1.5 space-y-1">
            {pendingToolCalls.map((tc) => (
              <div
                key={tc._index}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                {tc.status === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
                <Wrench className="h-3 w-3" />
                <span>
                  {tc.status === "running" ? "Running" : "Completed"}{" "}
                  {formatToolName(tc.toolName)}
                </span>
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
          <SafeMarkdown
            content={streamText}
            className="text-sm [&_p]:text-foreground [&_p]:leading-relaxed"
          />
        ) : !retryStatus ? (
          <div className="flex items-center gap-2" data-testid="status-streaming">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-sm text-muted-foreground">Thinking...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
