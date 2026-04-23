import { useState } from "react";
import { Wrench, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { formatToolName } from "./constants";
import type { ToolCallTrace } from "./types";

export function ToolCallTimeline({ traces }: { traces: ToolCallTrace[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!traces || traces.length === 0) {
    return null;
  }

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`${expanded ? "Collapse" : "Expand"} tool call details`}
        data-testid="button-toggle-tool-calls"
      >
        <Wrench className="h-3 w-3" />
        <span>
          {traces.length} tool{traces.length !== 1 ? "s" : ""} used
        </span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="mt-1 ml-2 border-l-2 border-border pl-3 space-y-1">
          {traces.map((t, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs"
              data-testid={`text-tool-trace-${i}`}
            >
              {t.status === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-0.5 shrink-0" />
              ) : t.status === "success" ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-medium">{formatToolName(t.toolName)}</span>
                {t.durationMs != null && (
                  <span className="text-muted-foreground ml-1">({t.durationMs}ms)</span>
                )}
                {t.error && <p className="text-red-500 mt-0.5">{t.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
