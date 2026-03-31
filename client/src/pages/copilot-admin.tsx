import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Bot, Settings, BarChart3, Lightbulb, Clock,
  Save, RefreshCw, Loader2, Trash2, Play, Pause,
  AlertTriangle, CheckCircle, XCircle, Zap,
  MessageSquare, Wrench, TrendingUp, RotateCcw,
  Shield, Database, Pencil, Download,
} from "lucide-react";
import { apiRequest, queryClient, resolveUrl, createHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AgentConfig {
  defaultModel: string;
  maxIterationsPerRun: number;
  maxTokensPerConversation: number;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  customSystemPrompt?: string;
  enabledTools?: string[] | null;
}

interface UsageStats {
  conversationCount: number;
  messageCount: number;
  totalTokens: number;
  toolCallCount: number;
  avgTokensPerConversation: number;
  topTools: { toolName: string; count: number }[];
  dailyUsage: { date: string; tokens: number; messages: number }[];
  approvalStats: { total: number; approved: number; rejected: number; pending: number; approvalRate: number };
  estimatedCost: number;
}

interface Suggestion {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface Schedule {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  outputDestination: string;
  allowWriteTools: boolean;
  maxTokenBudget: number | null;
  consecutiveFailures: number;
  allowedTools: string[] | null;
  enabled: boolean;
  lastRunAt?: string;
  createdAt: string;
}

interface ScheduleRun {
  id: string;
  scheduleId: string;
  status: string;
  output: any;
  tokenUsage: number | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface ToolInfo {
  name: string;
  description: string;
  requiresApproval: boolean;
}

interface AdminConversation {
  id: string;
  userId: string | null;
  title: string | null;
  status: string;
  messageCount: number;
  totalTokensUsed: number;
  lastMessageAt: string | null;
  createdAt: string;
}

function ConfigTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<AgentConfig>({
    queryKey: ["/api/agent/config"],
  });

  const { data: availableTools = [] } = useQuery<ToolInfo[]>({
    queryKey: ["/api/agent/tools"],
  });

  const [formData, setFormData] = useState<Partial<AgentConfig>>({});

  const merged = { ...config, ...formData };
  const rawEnabledTools = merged.enabledTools;
  const currentEnabledTools = Array.isArray(rawEnabledTools) ? rawEnabledTools : null;

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/agent/config", merged),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/agent/config"] });
      setFormData({});
      toast({ title: "Configuration saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/agent/config"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/agent/config"] });
      setFormData({});
      toast({ title: "Configuration reset to defaults" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to reset", description: err.message, variant: "destructive" });
    },
  });

  const toggleTool = (toolName: string, enabled: boolean) => {
    const allNames = availableTools.map(t => t.name);
    if (enabled) {
      if (currentEnabledTools === null) {
        setFormData(prev => ({ ...prev, enabledTools: null }));
      } else {
        const newList = [...currentEnabledTools, toolName];
        setFormData(prev => ({ ...prev, enabledTools: newList.length === allNames.length ? null : newList }));
      }
    } else {
      const base = currentEnabledTools === null ? allNames : currentEnabledTools;
      const newList = base.filter(n => n !== toolName);
      setFormData(prev => ({ ...prev, enabledTools: newList }));
    }
  };

  const isToolEnabled = (toolName: string) => {
    if (currentEnabledTools === null) return true;
    return currentEnabledTools.includes(toolName);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Model Settings
          </CardTitle>
          <CardDescription>Configure the AI model and behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Default Model</Label>
              <Select
                value={merged.defaultModel || "gpt-4o-mini"}
                onValueChange={(v) => setFormData(prev => ({ ...prev, defaultModel: v }))}
              >
                <SelectTrigger data-testid="select-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (Capable)</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Advanced)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxIterations">Max Tool Iterations</Label>
              <Input
                id="maxIterations"
                type="number"
                min={1}
                max={50}
                value={merged.maxIterationsPerRun || 10}
                onChange={(e) => setFormData(prev => ({ ...prev, maxIterationsPerRun: parseInt(e.target.value) || 10 }))}
                data-testid="input-max-iterations"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Token Budgets
          </CardTitle>
          <CardDescription>Set limits on AI usage to control costs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Per Conversation</Label>
              <Input
                type="number"
                value={merged.maxTokensPerConversation || 50000}
                onChange={(e) => setFormData(prev => ({ ...prev, maxTokensPerConversation: parseInt(e.target.value) || 50000 }))}
                data-testid="input-tokens-conversation"
              />
            </div>
            <div className="space-y-2">
              <Label>Daily Limit</Label>
              <Input
                type="number"
                value={merged.dailyTokenLimit || 500000}
                onChange={(e) => setFormData(prev => ({ ...prev, dailyTokenLimit: parseInt(e.target.value) || 500000 }))}
                data-testid="input-tokens-daily"
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Limit</Label>
              <Input
                type="number"
                value={merged.monthlyTokenLimit || 5000000}
                onChange={(e) => setFormData(prev => ({ ...prev, monthlyTokenLimit: parseInt(e.target.value) || 5000000 }))}
                data-testid="input-tokens-monthly"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {availableTools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Tool Management
            </CardTitle>
            <CardDescription>Enable or disable individual copilot tools. All tools are enabled by default.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {availableTools.map((tool) => (
                <div key={tool.name} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`tool-toggle-${tool.name}`}>
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tool.name}</span>
                      {tool.requiresApproval && (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Approval Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                  </div>
                  <Switch
                    checked={isToolEnabled(tool.name)}
                    onCheckedChange={(checked) => toggleTool(tool.name, checked)}
                    data-testid={`switch-tool-${tool.name}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Custom System Prompt
          </CardTitle>
          <CardDescription>Add organization-specific instructions for the copilot</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={merged.customSystemPrompt || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, customSystemPrompt: e.target.value }))}
            placeholder="e.g., Always prioritize safety-critical equipment. Our fleet uses MAN B&W engines..."
            rows={4}
            data-testid="input-system-prompt"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          data-testid="button-reset-config"
        >
          {resetMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
          Reset to Defaults
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || Object.keys(formData).length === 0}
          data-testid="button-save-config"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

function UsageTab() {
  const [days, setDays] = useState(30);
  const { data: stats, isLoading } = useQuery<UsageStats>({
    queryKey: ["/api/agent/usage", { days }],
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Usage Overview</h3>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[140px]" data-testid="select-usage-days">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-conversation-count">{stats.conversationCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BarChart3 className="h-4 w-4" />
              Messages
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-message-count">{stats.messageCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" />
              Total Tokens
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-total-tokens">{(stats.totalTokens / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wrench className="h-4 w-4" />
              Tool Calls
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-tool-count">{stats.toolCallCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Draft Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-xl font-bold text-green-600" data-testid="text-approved-count">{stats.approvalStats?.approved || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-xl font-bold text-red-600" data-testid="text-rejected-count">{stats.approvalStats?.rejected || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-yellow-600" data-testid="text-pending-count">{stats.approvalStats?.pending || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <p className="text-xl font-bold" data-testid="text-approval-rate">{stats.approvalStats?.approvalRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cost & Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Cost</p>
                <p className="text-xl font-bold" data-testid="text-estimated-cost">${(stats.estimatedCost || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Tokens/Conv</p>
                <p className="text-xl font-bold" data-testid="text-avg-tokens">{stats.avgTokensPerConversation ? (stats.avgTokensPerConversation / 1000).toFixed(1) + "k" : "0"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.topTools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Most Used Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topTools.map((tool) => (
                <div key={tool.toolName} className="flex items-center justify-between" data-testid={`tool-stat-${tool.toolName}`}>
                  <span className="text-sm font-medium">{tool.toolName}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (tool.count / (stats.topTools[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8 text-right">{tool.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.dailyUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {stats.dailyUsage.slice(0, 14).map((day) => (
                <div key={day.date} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{new Date(day.date).toLocaleDateString()}</span>
                  <div className="flex gap-4">
                    <span>{day.messages} msgs</span>
                    <span className="text-muted-foreground">{(day.tokens / 1000).toFixed(1)}k tokens</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SuggestionsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: suggestions = [], isLoading } = useQuery<Suggestion[]>({
    queryKey: ["/api/agent/suggestions"],
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agent/suggestions/generate"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/suggestions"] });
      toast({ title: `Generated ${data.generated || 0} new suggestions` });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/agent/suggestions/${id}`, { status: "dismissed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/suggestions"] });
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const priorityColor = (p: string) => {
    if (p === "critical") return "destructive";
    if (p === "high") return "default";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Proactive Suggestions</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-suggestions"
        >
          {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Generate
        </Button>
      </div>

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No suggestions yet. Click Generate to analyze fleet data.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <Card key={s.id} data-testid={`suggestion-${s.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={priorityColor(s.priority)}>{s.priority}</Badge>
                      <Badge variant="outline">{s.type}</Badge>
                      {s.status === "dismissed" && <Badge variant="secondary">dismissed</Badge>}
                    </div>
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{s.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(s.createdAt).toLocaleString()}</p>
                  </div>
                  {s.status !== "dismissed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => dismissMutation.mutate(s.id)}
                      data-testid={`button-dismiss-${s.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleRunHistory({ scheduleId }: { scheduleId: string }) {
  const { data: runs = [], isLoading } = useQuery<ScheduleRun[]>({
    queryKey: ["/api/agent/schedules", scheduleId, "runs"],
    queryFn: () => fetch(`/api/agent/schedules/${scheduleId}/runs`).then(r => r.json()),
  });

  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  if (isLoading) return <div className="py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (runs.length === 0) return <p className="text-xs text-muted-foreground py-2">No runs yet</p>;

  return (
    <div className="space-y-1 mt-2 border-t pt-2">
      <p className="text-xs font-medium mb-1">Run History</p>
      {runs.slice(0, 10).map(run => (
        <div key={run.id} className="text-xs" data-testid={`run-${run.id}`}>
          <button
            className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded px-1 py-0.5"
            onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
            data-testid={`button-expand-run-${run.id}`}
          >
            <Badge variant={run.status === "completed" ? "default" : run.status === "running" ? "secondary" : "destructive"} className="text-[10px] px-1">
              {run.status}
            </Badge>
            <span className="text-muted-foreground">
              {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
            </span>
            {run.tokenUsage && <span className="text-muted-foreground">({run.tokenUsage} tokens)</span>}
          </button>
          {expandedRun === run.id && (
            <div className="ml-4 mt-1 p-2 bg-muted/30 rounded text-xs space-y-1" data-testid={`run-output-${run.id}`}>
              {run.error && <p className="text-destructive">Error: {run.error}</p>}
              {run.output?.response && (
                <div>
                  <p className="font-medium mb-0.5">Output:</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{typeof run.output.response === "string" ? run.output.response.slice(0, 1000) : JSON.stringify(run.output, null, 2).slice(0, 1000)}</p>
                </div>
              )}
              {run.output?.toolCallCount !== undefined && <p>Tools used: {run.output.toolCallCount}</p>}
              {run.completedAt && <p>Completed: {new Date(run.completedAt).toLocaleString()}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScheduleForm({ initial, onSave, onCancel, isPending, saveLabel }: {
  initial: { name: string; prompt: string; cronExpression: string; outputDestination: string; allowWriteTools: boolean; maxTokenBudget: number; allowedTools: string[] | null };
  onSave: (data: typeof initial) => void;
  onCancel: () => void;
  isPending: boolean;
  saveLabel: string;
}) {
  const [form, setForm] = useState(initial);
  const { data: availableTools = [] } = useQuery<ToolInfo[]>({ queryKey: ["/api/agent/tools"] });

  const isToolSelected = (name: string) => form.allowedTools === null || form.allowedTools.includes(name);
  const toggleScheduleTool = (name: string, on: boolean) => {
    const allNames = availableTools.map(t => t.name);
    if (on) {
      if (form.allowedTools === null) return;
      const newList = [...form.allowedTools, name];
      setForm(prev => ({ ...prev, allowedTools: newList.length === allNames.length ? null : newList }));
    } else {
      const base = form.allowedTools === null ? allNames : form.allowedTools;
      setForm(prev => ({ ...prev, allowedTools: base.filter(n => n !== name) }));
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <Label>Schedule Name</Label>
          <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., Weekly fleet health check" data-testid="input-schedule-name" />
        </div>
        <div className="space-y-2">
          <Label>Prompt</Label>
          <Textarea value={form.prompt} onChange={(e) => setForm(prev => ({ ...prev, prompt: e.target.value }))} placeholder="e.g., Generate a full fleet health report" rows={3} data-testid="input-schedule-prompt" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={form.cronExpression} onValueChange={(v) => setForm(prev => ({ ...prev, cronExpression: v }))}>
              <SelectTrigger data-testid="select-schedule-cron"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                <SelectItem value="0 8 * * *">Daily (8am)</SelectItem>
                <SelectItem value="0 8 * * 1">Weekly (Monday 8am)</SelectItem>
                <SelectItem value="0 8 1 * *">Monthly (1st 8am)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Output Destination</Label>
            <Select value={form.outputDestination} onValueChange={(v) => setForm(prev => ({ ...prev, outputDestination: v }))}>
              <SelectTrigger data-testid="select-schedule-output"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="report">Stored Report</SelectItem>
                <SelectItem value="both">All (Notification + Email + Report)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Token Budget</Label>
            <Input type="number" value={form.maxTokenBudget} onChange={(e) => setForm(prev => ({ ...prev, maxTokenBudget: parseInt(e.target.value) || 4000 }))} min={500} max={100000} data-testid="input-schedule-tokens" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={form.allowWriteTools} onCheckedChange={(v) => setForm(prev => ({ ...prev, allowWriteTools: v }))} data-testid="switch-allow-write-tools" />
            <Label className="text-sm">Allow write tools (e.g., draft work orders)</Label>
          </div>
        </div>
        {form.allowWriteTools && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Write tools allow the agent to create drafts autonomously. All drafts still require human approval.
          </div>
        )}
        {availableTools.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm">Allowed Tools</Label>
            <p className="text-xs text-muted-foreground">Select which tools this schedule can use. All tools are allowed by default.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border rounded">
              {availableTools.map(tool => (
                <div key={tool.name} className="flex items-center gap-1.5">
                  <Switch checked={isToolSelected(tool.name)} onCheckedChange={(v) => toggleScheduleTool(tool.name, v)} className="scale-75" data-testid={`switch-tool-${tool.name}`} />
                  <span className="text-xs truncate" title={tool.description}>{tool.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={() => onSave(form)} disabled={isPending || !form.name || !form.prompt} data-testid="button-save-schedule">
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            {saveLabel}
          </Button>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-schedule">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SchedulesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/agent/schedules"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/agent/schedules", { ...data, enabled: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] });
      setShowForm(false);
      toast({ title: "Schedule created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/agent/schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] });
      setEditingId(null);
      toast({ title: "Schedule updated" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest("PUT", `/api/agent/schedules/${id}`, { enabled, consecutiveFailures: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agent/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] });
      toast({ title: "Schedule deleted" });
    },
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/agent/schedules/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] });
      toast({ title: "Schedule run triggered" });
    },
    onError: (err: any) => {
      toast({ title: "Run failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const cronLabel = (expr: string) => {
    const presets: Record<string, string> = {
      "0 8 * * 1": "Weekly (Mon 8am)",
      "0 8 * * *": "Daily (8am)",
      "0 */6 * * *": "Every 6 hours",
      "0 0 1 * *": "Monthly (1st)",
      "0 8 1 * *": "Monthly (1st 8am)",
    };
    return presets[expr] || expr;
  };

  const destLabel = (dest: string) => {
    const labels: Record<string, string> = { notification: "Notification", email: "Email", report: "Stored Report", both: "All Destinations" };
    return labels[dest] || dest;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Scheduled Runs</h3>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)} data-testid="button-new-schedule">
          {showForm ? <XCircle className="h-4 w-4 mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
          {showForm ? "Cancel" : "New Schedule"}
        </Button>
      </div>

      {showForm && (
        <ScheduleForm
          initial={{ name: "", prompt: "", cronExpression: "0 8 * * 1", outputDestination: "notification", allowWriteTools: false, maxTokenBudget: 4000, allowedTools: null }}
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
          isPending={createMutation.isPending}
          saveLabel="Create Schedule"
        />
      )}

      {schedules.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No scheduled runs configured yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s.id} data-testid={`schedule-${s.id}`}>
              {editingId === s.id ? (
                <ScheduleForm
                  initial={{
                    name: s.name,
                    prompt: s.prompt,
                    cronExpression: s.cronExpression,
                    outputDestination: s.outputDestination || "notification",
                    allowWriteTools: s.allowWriteTools,
                    maxTokenBudget: s.maxTokenBudget || 4000,
                    allowedTools: Array.isArray(s.allowedTools) ? s.allowedTools : null,
                  }}
                  onSave={(data) => updateMutation.mutate({ id: s.id, data })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                  saveLabel="Save Changes"
                />
              ) : (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{s.name}</p>
                          <Badge variant={s.enabled ? "default" : "secondary"}>
                            {s.enabled ? "Active" : "Paused"}
                          </Badge>
                          {s.consecutiveFailures > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              {s.consecutiveFailures >= 3 ? "Auto-disabled" : `${s.consecutiveFailures} failure${s.consecutiveFailures > 1 ? "s" : ""}`}
                            </Badge>
                          )}
                          {s.allowWriteTools && (
                            <Badge variant="outline" className="text-[10px]">Write</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-sm">{s.prompt}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{cronLabel(s.cronExpression)}</span>
                          <span>{destLabel(s.outputDestination)}</span>
                          {s.maxTokenBudget && <span>{s.maxTokenBudget.toLocaleString()} token limit</span>}
                          {s.lastRunAt && <span>Last: {new Date(s.lastRunAt).toLocaleString()}</span>}
                          {Array.isArray(s.allowedTools) && <span>{s.allowedTools.length} tools selected</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingId(s.id)} data-testid={`button-edit-${s.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setExpandedSchedule(expandedSchedule === s.id ? null : s.id)} data-testid={`button-history-${s.id}`}>
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => runMutation.mutate(s.id)} disabled={runMutation.isPending} data-testid={`button-run-${s.id}`}>
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate({ id: s.id, enabled: !s.enabled })} data-testid={`button-toggle-${s.id}`}>
                          {s.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 text-green-500" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-${s.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {expandedSchedule === s.id && <ScheduleRunHistory scheduleId={s.id} />}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: conversations = [], isLoading } = useQuery<AdminConversation[]>({
    queryKey: ["/api/agent/admin/conversations"],
  });

  const purgeMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/agent/admin/conversations"),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/agent/admin/conversations"] });
      qc.invalidateQueries({ queryKey: ["/api/agent/usage"] });
      toast({ title: `Purged ${data.purged || 0} conversations` });
    },
    onError: (err: any) => {
      toast({ title: "Purge failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const totalTokens = conversations.reduce((sum, c) => sum + (c.totalTokensUsed || 0), 0);
  const totalMessages = conversations.reduce((sum, c) => sum + (c.messageCount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Data Management</h3>
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
                  const errText = await res.text();
                  throw new Error(errText || res.statusText);
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
                toast({ title: "Export failed", description: err.message, variant: "destructive" });
              }
            }}
            disabled={conversations.length === 0}
            data-testid="button-export-jsonl"
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSONL
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (window.confirm("This will permanently delete all conversations, messages, tool calls, and drafts. Are you sure?")) {
                purgeMutation.mutate();
              }
            }}
            disabled={purgeMutation.isPending || conversations.length === 0}
            data-testid="button-purge-conversations"
          >
            {purgeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Purge All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MessageSquare className="h-4 w-4" />
              Total Conversations
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-total-conversations">{conversations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BarChart3 className="h-4 w-4" />
              Total Messages
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-data-messages">{totalMessages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" />
              Total Tokens
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-data-tokens">{(totalTokens / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
      </div>

      {conversations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {conversations.slice(0, 20).map((conv) => (
                <div key={conv.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0" data-testid={`conv-row-${conv.id}`}>
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium truncate">{conv.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">
                      {conv.messageCount} msgs | {((conv.totalTokensUsed || 0) / 1000).toFixed(1)}k tokens
                      {conv.lastMessageAt && ` | ${new Date(conv.lastMessageAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge variant={conv.status === "active" ? "default" : "secondary"}>{conv.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CopilotAdminPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Copilot Administration</h1>
          <p className="text-muted-foreground text-sm">Configure, monitor, and manage the AI Copilot agent</p>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-copilot-admin">
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings className="h-4 w-4 mr-2" />
            Config
          </TabsTrigger>
          <TabsTrigger value="usage" data-testid="tab-usage">
            <BarChart3 className="h-4 w-4 mr-2" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">
            <Lightbulb className="h-4 w-4 mr-2" />
            Suggestions
          </TabsTrigger>
          <TabsTrigger value="schedules" data-testid="tab-schedules">
            <Clock className="h-4 w-4 mr-2" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data">
            <Database className="h-4 w-4 mr-2" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          <ConfigTab />
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          <UsageTab />
        </TabsContent>

        <TabsContent value="suggestions" className="mt-6">
          <SuggestionsTab />
        </TabsContent>

        <TabsContent value="schedules" className="mt-6">
          <SchedulesTab />
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <DataTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
