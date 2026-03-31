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
  MessageSquare, Wrench, TrendingUp,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AgentConfig {
  defaultModel: string;
  maxIterationsPerRun: number;
  maxTokensPerConversation: number;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  customSystemPrompt?: string;
  enabledTools?: string[];
}

interface UsageStats {
  conversationCount: number;
  messageCount: number;
  totalTokens: number;
  toolCallCount: number;
  avgTokensPerConversation: number;
  topTools: { toolName: string; count: number }[];
  dailyUsage: { date: string; tokens: number; messages: number }[];
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
  enabled: boolean;
  lastRunAt?: string;
  createdAt: string;
}

function ConfigTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<AgentConfig>({
    queryKey: ["/api/agent/config"],
  });

  const [formData, setFormData] = useState<Partial<AgentConfig>>({});

  const merged = { ...config, ...formData };

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/agent/config", merged),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/config"] });
      setFormData({});
      toast({ title: "Configuration saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

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

      <div className="flex justify-end">
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

function SchedulesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: "", prompt: "", cronExpression: "0 8 * * 1" });

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/agent/schedules"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agent/schedules", { ...newSchedule, enabled: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/schedules"] });
      setShowForm(false);
      setNewSchedule({ name: "", prompt: "", cronExpression: "0 8 * * 1" });
      toast({ title: "Schedule created" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest("PUT", `/api/agent/schedules/${id}`, { enabled }),
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
    };
    return presets[expr] || expr;
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
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input
                value={newSchedule.name}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Weekly fleet health check"
                data-testid="input-schedule-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                value={newSchedule.prompt}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder="e.g., Generate a full fleet health report and highlight critical issues"
                rows={3}
                data-testid="input-schedule-prompt"
              />
            </div>
            <div className="space-y-2">
              <Label>Schedule</Label>
              <Select
                value={newSchedule.cronExpression}
                onValueChange={(v) => setNewSchedule(prev => ({ ...prev, cronExpression: v }))}
              >
                <SelectTrigger data-testid="select-schedule-cron">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                  <SelectItem value="0 8 * * *">Daily (8am)</SelectItem>
                  <SelectItem value="0 8 * * 1">Weekly (Monday 8am)</SelectItem>
                  <SelectItem value="0 0 1 * *">Monthly (1st of month)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newSchedule.name || !newSchedule.prompt}
              data-testid="button-create-schedule"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Create Schedule
            </Button>
          </CardContent>
        </Card>
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
            <Card key={s.id} data-testid={`schedule-${s.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{s.name}</p>
                      <Badge variant={s.enabled ? "default" : "secondary"}>
                        {s.enabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-sm">{s.prompt}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{cronLabel(s.cronExpression)}</span>
                      {s.lastRunAt && <span>Last run: {new Date(s.lastRunAt).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => runMutation.mutate(s.id)}
                      disabled={runMutation.isPending}
                      data-testid={`button-run-${s.id}`}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleMutation.mutate({ id: s.id, enabled: !s.enabled })}
                      data-testid={`button-toggle-${s.id}`}
                    >
                      {s.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 text-green-500" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(s.id)}
                      data-testid={`button-delete-${s.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-copilot-admin">
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
      </Tabs>
    </div>
  );
}
