import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Settings,
  BarChart3,
  Clock,
  Loader2,
  Trash2,
  Play,
  Pause,
  Zap,
  MessageSquare,
  Wrench,
  Activity,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ConfigDialog } from "./copilot-admin-config-dialog";
import { CopilotDataManagement } from "./copilot-admin-data-management";
import type {
  AgentConfig,
  CopilotEffectivenessSummary,
  Schedule,
  ToolInfo,
  CopilotUsageStats,
} from "./copilot-admin-types";

function StatusSidebar({
  config,
  usage,
  schedules,
}: {
  config: AgentConfig | undefined;
  usage: CopilotUsageStats | undefined;
  schedules: Schedule[];
}) {
  const tier = config?.permissionTier || "strict";
  const tierColors: Record<string, string> = {
    strict: "text-green-600 bg-green-500/10",
    balanced: "text-blue-600 bg-blue-500/10",
    autonomous: "text-amber-600 bg-amber-500/10",
  };
  const activeSchedules = schedules.filter((s) => s.enabled).length;

  return (
    <div className="space-y-4" data-testid="status-sidebar">
      <div className="p-3 rounded-lg border bg-card">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Model</div>
        <div className="text-sm font-semibold mt-0.5">{config?.defaultModel || "gpt-4o-mini"}</div>
      </div>

      <div className="p-3 rounded-lg border bg-card">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Permission</div>
        <Badge className={`mt-1 text-xs ${tierColors[tier] || ""}`}>{tier}</Badge>
      </div>

      <div className="p-3 rounded-lg border bg-card">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Tokens Today
        </div>
        <div className="text-lg font-bold mt-0.5">
          {usage ? `${(usage.totalTokens / 1000).toFixed(1)}k` : "—"}
        </div>
        <div className="text-[10px] text-muted-foreground">
          of {config ? `${(config.dailyTokenLimit / 1000).toFixed(0)}k` : "—"} daily
        </div>
      </div>

      <div className="p-3 rounded-lg border bg-card">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Schedules</div>
        <div className="text-lg font-bold mt-0.5">{activeSchedules} active</div>
        <div className="text-[10px] text-muted-foreground">of {schedules.length} total</div>
      </div>

      <div className="p-3 rounded-lg border bg-card">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Est. Cost (30d)
        </div>
        <div className="text-lg font-bold mt-0.5">
          ${usage ? usage.estimatedCost.toFixed(2) : "—"}
        </div>
      </div>
    </div>
  );
}

function EffectivenessCard({
  effectiveness,
}: {
  effectiveness: CopilotEffectivenessSummary | undefined;
}) {
  if (!effectiveness || effectiveness.totalResolved === 0) {
    return (
      <div className="p-3 rounded-lg border bg-card" data-testid="effectiveness-empty">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Suggestion Effectiveness
        </div>
        <div className="text-xs text-muted-foreground mt-1">No outcome data yet</div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border bg-card space-y-2" data-testid="effectiveness-card">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
        Suggestion Effectiveness
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-lg font-bold text-green-600" data-testid="text-acceptance-rate">
            {effectiveness.acceptanceRate}%
          </div>
          <div className="text-[10px] text-muted-foreground">Accepted</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-500" data-testid="text-dismissal-rate">
            {effectiveness.dismissalRate}%
          </div>
          <div className="text-[10px] text-muted-foreground">Dismissed</div>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground">
        {effectiveness.totalResolved} resolved (30d)
      </div>
      {effectiveness.topDismissalReasons.length > 0 && (
        <div className="space-y-1 pt-1 border-t">
          <div className="text-[10px] text-muted-foreground">Top dismissal reasons</div>
          {effectiveness.topDismissalReasons.map((r) => (
            <div key={r.reason} className="flex items-center justify-between text-[10px]">
              <span className="truncate">{r.reason}</span>
              <span className="text-muted-foreground ml-1">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsageOverview({ usage }: { usage: CopilotUsageStats | undefined }) {
  if (!usage) {
    return null;
  }

  return (
    <div data-testid="usage-overview">
      <h2 className="text-sm font-semibold mb-3">Usage (Last 30 Days)</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Conversations", value: usage.conversationCount, icon: MessageSquare },
          { label: "Messages", value: usage.messageCount, icon: BarChart3 },
          { label: "Tokens", value: `${(usage.totalTokens / 1000).toFixed(1)}k`, icon: Zap },
          { label: "Tool Calls", value: usage.toolCallCount, icon: Wrench },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
              <p className="text-xl font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {usage.topTools.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Top Tools</div>
              <div className="space-y-1.5">
                {usage.topTools.slice(0, 5).map((tool) => (
                  <div key={tool.toolName} className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{tool.toolName}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.min(100, (tool.count / (usage.topTools[0]?.count || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground w-6 text-right">{tool.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Approval Rate</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Approved</span>
                <p className="text-lg font-bold text-green-600">
                  {usage.approvalStats?.approved || 0}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Rejected</span>
                <p className="text-lg font-bold text-red-600">
                  {usage.approvalStats?.rejected || 0}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Pending</span>
                <p className="text-lg font-bold text-yellow-600">
                  {usage.approvalStats?.pending || 0}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Rate</span>
                <p className="text-lg font-bold">{usage.approvalStats?.approvalRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SchedulesList({
  schedules,
  onToggle,
  onRun,
  onDelete,
}: {
  schedules: Schedule[];
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cronLabel = (expr: string) => {
    const presets: Record<string, string> = {
      "0 8 * * 1": "Weekly (Mon 8am)",
      "0 8 * * *": "Daily (8am)",
      "0 */6 * * *": "Every 6 hours",
      "0 8 1 * *": "Monthly (1st 8am)",
    };
    return presets[expr] || expr;
  };

  return (
    <div data-testid="schedules-list">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Scheduled Runs</h2>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          disabled
          data-testid="button-new-schedule"
        >
          <Clock className="h-3.5 w-3.5 mr-1" /> New Schedule
        </Button>
      </div>
      {schedules.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs border rounded-lg">
          No scheduled runs configured.
        </div>
      ) : (
        <div className="space-y-1.5">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors"
              data-testid={`schedule-${s.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge variant={s.enabled ? "default" : "secondary"} className="text-[9px]">
                    {s.enabled ? "Active" : "Paused"}
                  </Badge>
                  {s.consecutiveFailures >= 3 && (
                    <Badge variant="destructive" className="text-[9px]">
                      Auto-disabled
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cronLabel(s.cronExpression)}
                  {s.lastRunAt && ` · Last: ${new Date(s.lastRunAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRun(s.id)}
                  data-testid={`button-run-${s.id}`}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onToggle(s.id, !s.enabled)}
                  data-testid={`button-toggle-${s.id}`}
                >
                  {s.enabled ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-green-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onDelete(s.id)}
                  data-testid={`button-delete-${s.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CopilotAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery<AgentConfig>({
    queryKey: ["/api/agent/config"],
  });
  const { data: usage } = useQuery<CopilotUsageStats>({
    queryKey: ["/api/agent/usage", { days: 30 }],
  });
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/agent/schedules"],
  });
  const { data: availableTools = [] } = useQuery<ToolInfo[]>({
    queryKey: ["/api/agent/tools"],
  });
  const { data: effectiveness } = useQuery<CopilotEffectivenessSummary>({
    queryKey: ["/api/agent/suggestions/effectiveness", { days: 30 }],
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest("PUT", `/api/agent/schedules/${id}`, { enabled, consecutiveFailures: 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] }),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/agent/schedules/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] });
      toast({ title: "Schedule run triggered" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agent/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] });
      toast({ title: "Schedule deleted" });
    },
  });

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="copilot-admin-page">
      <ConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        config={config}
        availableTools={availableTools}
      />

      <div className="px-6 py-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">
              AI Copilot Admin
            </h1>
            <p className="text-sm text-muted-foreground">Monitor and configure the ARUS Copilot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/agent/activity">
            <Button variant="outline" data-testid="link-agent-activity">
              <Activity className="h-4 w-4 mr-2" /> Activity Log
            </Button>
          </Link>
          <Button onClick={() => setConfigOpen(true)} data-testid="button-open-config">
            <Settings className="h-4 w-4 mr-2" /> Edit Configuration
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6 p-6">
        <div className="hidden lg:block space-y-4">
          <StatusSidebar config={config} usage={usage} schedules={schedules} />
          <EffectivenessCard effectiveness={effectiveness} />
        </div>

        <div className="space-y-8">
          <UsageOverview usage={usage} />

          <SchedulesList
            schedules={schedules}
            onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
            onRun={(id) => runMutation.mutate(id)}
            onDelete={(id) => {
              if (window.confirm("Delete this schedule?")) {
                deleteMutation.mutate(id);
              }
            }}
          />

          <CopilotDataManagement />
        </div>
      </div>
    </div>
  );
}
