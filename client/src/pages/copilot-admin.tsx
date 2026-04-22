import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bot,
  Settings,
  BarChart3,
  Clock,
  Save,
  Loader2,
  Trash2,
  Play,
  Pause,
  Zap,
  MessageSquare,
  Wrench,
  Shield,
  Database,
  Download,
  RotateCcw,
  ChevronDown,
  Activity,
} from "lucide-react";
import { apiRequest, resolveUrl, createHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface AgentConfig {
  defaultModel: string;
  maxIterationsPerRun: number;
  maxTokensPerConversation: number;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  customSystemPrompt?: string;
  enabledTools?: string[] | null;
  contextCompaction?: boolean;
  compactionThreshold?: number;
  toolOutputCharLimit?: number;
  deferredToolLoading?: boolean;
  permissionTier?: string;
  autoTriggerEnabled?: boolean;
  autoTriggerThreshold?: number;
}

interface UsageStats {
  conversationCount: number;
  messageCount: number;
  totalTokens: number;
  toolCallCount: number;
  avgTokensPerConversation: number;
  topTools: { toolName: string; count: number }[];
  approvalStats: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
  };
  estimatedCost: number;
}

interface Schedule {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  outputDestination: string;
  allowWriteTools: boolean;
  enabled: boolean;
  consecutiveFailures: number;
  lastRunAt?: string;
}

interface ToolInfo {
  name: string;
  description: string;
  requiresApproval: boolean;
}

interface EffectivenessSummary {
  totalResolved: number;
  actedCount: number;
  dismissedCount: number;
  deferredCount: number;
  acceptanceRate: number;
  dismissalRate: number;
  topDismissalReasons: { reason: string; count: number }[];
  outcomeCounts: Record<string, number>;
}

function StatusSidebar({
  config,
  usage,
  schedules,
}: {
  config: AgentConfig | undefined;
  usage: UsageStats | undefined;
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

function EffectivenessCard({ effectiveness }: { effectiveness: EffectivenessSummary | undefined }) {
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

function UsageOverview({ usage }: { usage: UsageStats | undefined }) {
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
                  {s.lastRun && ` · Last: ${new Date(s.lastRunAt).toLocaleDateString()}`}
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

function ConfigDialog({
  open,
  onClose,
  config,
  availableTools,
}: {
  open: boolean;
  onClose: () => void;
  config: AgentConfig | undefined;
  availableTools: ToolInfo[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<AgentConfig>>({});
  const merged = { ...config, ...formData };

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/agent/config", merged),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/config"] });
      setFormData({});
      toast({ title: "Configuration saved" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/agent/config"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/config"] });
      setFormData({});
      toast({ title: "Configuration reset to defaults" });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Copilot Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4" /> Model
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Default Model</Label>
                <Select
                  value={merged.defaultModel || "gpt-4o-mini"}
                  onValueChange={(v) => setFormData((p) => ({ ...p, defaultModel: v }))}
                >
                  <SelectTrigger data-testid="select-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Tool Iterations</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={merged.maxIterationsPerRun || 10}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      maxIterationsPerRun: parseInt(e.target.value) || 10,
                    }))
                  }
                  data-testid="input-max-iterations"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" /> Token Budgets
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Per Conversation</Label>
                <Input
                  type="number"
                  value={merged.maxTokensPerConversation || 50000}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      maxTokensPerConversation: parseInt(e.target.value) || 50000,
                    }))
                  }
                  data-testid="input-tokens-conv"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Daily Limit</Label>
                <Input
                  type="number"
                  value={merged.dailyTokenLimit || 500000}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      dailyTokenLimit: parseInt(e.target.value) || 500000,
                    }))
                  }
                  data-testid="input-tokens-daily"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monthly Limit</Label>
                <Input
                  type="number"
                  value={merged.monthlyTokenLimit || 5000000}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      monthlyTokenLimit: parseInt(e.target.value) || 5000000,
                    }))
                  }
                  data-testid="input-tokens-monthly"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" /> Permission Tier
            </h3>
            <Select
              value={merged.permissionTier || "strict"}
              onValueChange={(v) => setFormData((p) => ({ ...p, permissionTier: v }))}
            >
              <SelectTrigger data-testid="select-permission-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">Strict — All writes require approval</SelectItem>
                <SelectItem value="balanced">Balanced — Low-risk auto-approved</SelectItem>
                <SelectItem value="autonomous">Autonomous — Admin auto-approved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Context Compaction</h3>
                <p className="text-xs text-muted-foreground">
                  Summarize older messages to reduce token usage
                </p>
              </div>
              <Switch
                checked={merged.contextCompaction !== false}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, contextCompaction: v }))}
                data-testid="switch-compaction"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Auto-Trigger on Predictions</h3>
                <p className="text-xs text-muted-foreground">
                  Investigate high-risk failures automatically
                </p>
              </div>
              <Switch
                checked={merged.autoTriggerEnabled === true}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, autoTriggerEnabled: v }))}
                data-testid="switch-auto-trigger"
              />
            </div>
            {merged.autoTriggerEnabled && (
              <div className="flex items-center gap-3">
                <Label className="text-xs shrink-0">Threshold:</Label>
                <input
                  type="range"
                  min={0.8}
                  max={1.0}
                  step={0.01}
                  value={merged.autoTriggerThreshold ?? 0.85}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, autoTriggerThreshold: parseFloat(e.target.value) }))
                  }
                  className="flex-1 accent-primary"
                  data-testid="input-threshold"
                />
                <span className="text-sm font-mono w-10 text-right">
                  {((merged.autoTriggerThreshold ?? 0.85) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Custom System Prompt
            </h3>
            <Textarea
              value={merged.customSystemPrompt || ""}
              onChange={(e) => setFormData((p) => ({ ...p, customSystemPrompt: e.target.value }))}
              placeholder="Organization-specific instructions..."
              rows={3}
              data-testid="input-system-prompt"
            />
          </div>

          {availableTools.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Tool Management
              </h3>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                {availableTools.map((tool) => {
                  const enabledTools = merged.enabledTools ?? availableTools.map((t) => t.name);
                  const isEnabled = enabledTools.includes(tool.name);
                  return (
                    <div key={tool.name} className="flex items-center gap-1.5 text-xs">
                      <Switch
                        className="scale-75"
                        checked={isEnabled}
                        onCheckedChange={(checked) => {
                          const current = merged.enabledTools ?? availableTools.map((t) => t.name);
                          const updated = checked
                            ? [...current, tool.name]
                            : current.filter((n: string) => n !== tool.name);
                          setFormData((p) => ({ ...p, enabledTools: updated }));
                        }}
                        data-testid={`switch-tool-${tool.name}`}
                      />
                      <span className="truncate" title={tool.description}>
                        {tool.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            data-testid="button-reset-config"
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Reset Defaults
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || Object.keys(formData).length === 0}
            data-testid="button-save-config"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CopilotAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery<AgentConfig>({
    queryKey: ["/api/agent/config"],
  });
  const { data: usage } = useQuery<UsageStats>({
    queryKey: ["/api/agent/usage", { days: 30 }],
  });
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/agent/schedules"],
  });
  const { data: availableTools = [] } = useQuery<ToolInfo[]>({
    queryKey: ["/api/agent/tools"],
  });
  const { data: effectiveness } = useQuery<EffectivenessSummary>({
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

          <details className="border rounded-lg" data-testid="data-management">
            <summary className="p-3 text-sm font-semibold cursor-pointer hover:bg-accent/30 flex items-center gap-2">
              <Database className="h-4 w-4" /> Data Management
              <ChevronDown className="h-3 w-3 ml-auto" />
            </summary>
            <div className="p-4 border-t space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch(resolveUrl("/api/agent/admin/export-jsonl"), {
                        headers: createHeaders(),
                        credentials: "include",
                      });
                      if (!res.ok) {
                        throw new Error(await res.text());
                      }
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `agent-conversations-${new Date().toISOString().slice(0, 10)}.jsonl`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Export downloaded" });
                    } catch (err: any) {
                      toast({
                        title: "Export failed",
                        description: err.message,
                        variant: "destructive",
                      });
                    }
                  }}
                  data-testid="button-export-jsonl"
                >
                  <Download className="h-4 w-4 mr-1" /> Export JSONL
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Permanently delete ALL conversations, messages, tool calls, and drafts?"
                      )
                    ) {
                      apiRequest("DELETE", "/api/agent/admin/conversations").then((data: any) => {
                        queryClient.invalidateQueries({
                          queryKey: ["/api/agent/admin/conversations"],
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/agent/usage"] });
                        toast({ title: `Purged ${data.purged || 0} conversations` });
                      });
                    }
                  }}
                  data-testid="button-purge"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Purge All
                </Button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
