import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Zap,
  DollarSign,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Wrench,
  AlertTriangle,
  User,
} from "lucide-react";

interface ToolCallEntry {
  toolName: string;
  inputSummary?: string | null;
  durationMs?: number | null;
  status: string;
  error?: string | null;
}

interface TriggerContext {
  scheduleName?: string | null;
  scheduleId?: string | null;
  conversationId?: string | null;
}

export interface AgentActivityListItem {
  id: string;
  triggerType: "scheduled" | "user";
  scheduleName?: string | null;
  scheduleId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
  status: "completed" | "failed" | "running";
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  tokenUsage?: number | null;
  toolCallCount: number;
  toolCalls: ToolCallEntry[];
  response?: string | null;
  error?: string | null;
  triggerContext?: TriggerContext | null;
}

export interface AgentActivitySummary {
  runsToday: number;
  successRate7d: number;
  avgTokensPerRun: number;
  estimatedCost30d: number;
  failureCount7d: number;
  totalRuns7d: number;
  totalRuns30d: number;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) {
    return "—";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) {
    return "Just now";
  }
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}m ago`;
  }
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}h ago`;
  }
  return new Date(dateStr).toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge
        className="text-[9px] bg-green-500/10 text-green-600 border-green-500/20"
        data-testid={`badge-status-${status}`}
      >
        <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Completed
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="text-[9px]" data-testid={`badge-status-${status}`}>
        <XCircle className="h-2.5 w-2.5 mr-0.5" /> Failed
      </Badge>
    );
  }
  return (
    <Badge
      className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/20"
      data-testid={`badge-status-${status}`}
    >
      <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> Running
    </Badge>
  );
}

function TriggerIcon({ type }: { type: string }) {
  if (type === "scheduled") {
    return <Clock className="h-3.5 w-3.5 text-blue-500" />;
  }
  return <User className="h-3.5 w-3.5 text-green-500" />;
}

export function SummaryMetrics({ summary }: { summary: AgentActivitySummary | undefined }) {
  if (!summary) {
    return null;
  }

  const metrics = [
    { label: "Runs Today", value: summary.runsToday, icon: Activity, color: "text-blue-600" },
    {
      label: "Success Rate (7d)",
      value: `${summary.successRate7d}%`,
      icon: TrendingUp,
      color:
        summary.successRate7d >= 90
          ? "text-green-600"
          : summary.successRate7d >= 70
            ? "text-amber-600"
            : "text-red-600",
    },
    {
      label: "Avg Tokens/Run",
      value: summary.avgTokensPerRun > 0 ? `${(summary.avgTokensPerRun / 1000).toFixed(1)}k` : "—",
      icon: Zap,
      color: "text-purple-600",
    },
    {
      label: "Est. Cost (30d)",
      value: `$${summary.estimatedCost30d.toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-600",
    },
    {
      label: "Failures (7d)",
      value: summary.failureCount7d,
      icon: AlertTriangle,
      color: summary.failureCount7d > 0 ? "text-red-600" : "text-green-600",
    },
  ];

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6"
      data-testid="activity-summary-metrics"
    >
      {metrics.map(({ label, value, icon: Icon, color }) => (
        <Card key={label}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider">
              <Icon className={`h-3.5 w-3.5 ${color}`} /> {label}
            </div>
            <p
              className={`text-xl font-bold mt-1 ${color}`}
              data-testid={`metric-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
            >
              {value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ActivityRow({ item }: { item: AgentActivityListItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg transition-colors ${item.status === "failed" ? "border-red-500/30 bg-red-500/5" : "hover:bg-accent/30"}`}
      data-testid={`activity-row-${item.id}`}
    >
      <button
        className="w-full text-left p-3 flex items-center gap-3"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-${item.id}`}
      >
        <TriggerIcon type={item.triggerType} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">
              {item.triggerType === "scheduled"
                ? item.scheduleName || "Scheduled Run"
                : "User Conversation"}
            </span>
            <StatusBadge status={item.status} />
            <Badge variant="outline" className="text-[9px]">
              {item.triggerType}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span>{formatRelativeTime(item.startedAt)}</span>
            {item.durationMs != null && <span>{formatDuration(item.durationMs)}</span>}
            {item.toolCallCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Wrench className="h-3 w-3" /> {item.toolCallCount} tools
              </span>
            )}
            {item.tokenUsage != null && item.tokenUsage > 0 && (
              <span className="flex items-center gap-0.5">
                <Zap className="h-3 w-3" /> {(item.tokenUsage / 1000).toFixed(1)}k tokens
              </span>
            )}
          </div>
          {item.response && (
            <p
              className="text-xs text-muted-foreground/70 mt-1 truncate max-w-[600px]"
              data-testid={`snippet-${item.id}`}
            >
              {item.response.length > 120 ? `${item.response.slice(0, 117)}...` : item.response}
            </p>
          )}
        </div>

        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 border-t pt-3 space-y-3"
          data-testid={`activity-detail-${item.id}`}
        >
          {item.error && (
            <div
              className="p-2 rounded bg-red-500/10 border border-red-500/20 text-sm text-red-600"
              data-testid={`error-${item.id}`}
            >
              <span className="font-medium">Error: </span>
              {item.error}
            </div>
          )}

          {item.response && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Response
              </div>
              <p
                className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"
                data-testid={`response-${item.id}`}
              >
                {item.response}
              </p>
            </div>
          )}

          {item.toolCalls.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                Tool Call Timeline
              </div>
              <div className="space-y-1.5 ml-2 border-l-2 border-border pl-3">
                {item.toolCalls.map((tc, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs"
                    data-testid={`tool-call-${item.id}-${i}`}
                  >
                    {tc.status === "completed" || tc.status === "success" ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    ) : tc.status === "failed" || tc.status === "error" ? (
                      <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium">{tc.toolName}</span>
                      {tc.durationMs != null && (
                        <span className="text-muted-foreground ml-1">({tc.durationMs}ms)</span>
                      )}
                      {tc.inputSummary && (
                        <p
                          className="text-muted-foreground/70 truncate mt-0.5 font-mono text-[10px]"
                          data-testid={`tool-input-${item.id}-${i}`}
                        >
                          {tc.inputSummary}
                        </p>
                      )}
                      {tc.error && <p className="text-red-500 mt-0.5">{tc.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.triggerContext && (
            <div data-testid={`trigger-context-${item.id}`}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Trigger Context
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {item.triggerContext.scheduleName && (
                  <span>
                    <Clock className="h-3 w-3 inline mr-0.5" />
                    Schedule:{" "}
                    <span className="font-medium text-foreground">
                      {item.triggerContext.scheduleName}
                    </span>
                  </span>
                )}
                {item.triggerContext.scheduleId && (
                  <span className="text-[10px] font-mono">
                    ID: {item.triggerContext.scheduleId.slice(0, 8)}…
                  </span>
                )}
                {item.triggerContext.conversationId && (
                  <span className="text-[10px] font-mono">
                    Conv: {item.triggerContext.conversationId.slice(0, 8)}…
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
            <span>
              <Calendar className="h-3 w-3 inline mr-1" />
              {new Date(item.startedAt).toLocaleString()}
            </span>
            {item.conversationId && !item.triggerContext?.conversationId && (
              <span className="text-[10px] font-mono">{item.conversationId.slice(0, 8)}…</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
