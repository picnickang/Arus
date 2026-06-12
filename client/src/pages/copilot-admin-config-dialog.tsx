import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Loader2,
  MessageSquare,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Wrench,
  Zap,
} from "lucide-react";
import type { AgentConfig, ToolInfo } from "./copilot-admin-types";

interface ConfigDialogProps {
  open: boolean;
  onClose: () => void;
  config: AgentConfig | undefined;
  availableTools: ToolInfo[];
}

export function ConfigDialog({ open, onClose, config, availableTools }: ConfigDialogProps) {
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
    onError: (err: unknown) => {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Copilot Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <ModelSection merged={merged} setFormData={setFormData} />
          <BudgetSection merged={merged} setFormData={setFormData} />
          <PermissionSection merged={merged} setFormData={setFormData} />
          <RuntimeSection merged={merged} setFormData={setFormData} />
          <PromptSection merged={merged} setFormData={setFormData} />
          <ToolsSection
            merged={merged}
            setFormData={setFormData}
            availableTools={availableTools}
          />
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

type FormUpdater = Dispatch<SetStateAction<Partial<AgentConfig>>>;

function ModelSection({
  merged,
  setFormData,
}: {
  merged: Partial<AgentConfig>;
  setFormData: FormUpdater;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Bot className="h-4 w-4" /> Model
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Default Model</Label>
          <Select
            value={merged.defaultModel || "gpt-4o-mini"}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, defaultModel: value }))}
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
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                maxIterationsPerRun: parseInt(event.target.value) || 10,
              }))
            }
            data-testid="input-max-iterations"
          />
        </div>
      </div>
    </div>
  );
}

function BudgetSection({
  merged,
  setFormData,
}: {
  merged: Partial<AgentConfig>;
  setFormData: FormUpdater;
}) {
  const setNumber =
    (key: keyof AgentConfig, fallback: number) => (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [key]: parseInt(event.target.value) || fallback,
      }));
    };

  return (
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
            onChange={setNumber("maxTokensPerConversation", 50000)}
            data-testid="input-tokens-conv"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Daily Limit</Label>
          <Input
            type="number"
            value={merged.dailyTokenLimit || 500000}
            onChange={setNumber("dailyTokenLimit", 500000)}
            data-testid="input-tokens-daily"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Monthly Limit</Label>
          <Input
            type="number"
            value={merged.monthlyTokenLimit || 5000000}
            onChange={setNumber("monthlyTokenLimit", 5000000)}
            data-testid="input-tokens-monthly"
          />
        </div>
      </div>
    </div>
  );
}

function PermissionSection({
  merged,
  setFormData,
}: {
  merged: Partial<AgentConfig>;
  setFormData: FormUpdater;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Shield className="h-4 w-4" /> Permission Tier
      </h3>
      <Select
        value={merged.permissionTier || "strict"}
        onValueChange={(value) => setFormData((prev) => ({ ...prev, permissionTier: value }))}
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
  );
}

function RuntimeSection({
  merged,
  setFormData,
}: {
  merged: Partial<AgentConfig>;
  setFormData: FormUpdater;
}) {
  return (
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
          onCheckedChange={(value) => setFormData((prev) => ({ ...prev, contextCompaction: value }))}
          data-testid="switch-compaction"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Auto-Trigger on Predictions</h3>
          <p className="text-xs text-muted-foreground">
            Investigate high-risk failures automatically
          </p>
        </div>
        <Switch
          checked={merged.autoTriggerEnabled === true}
          onCheckedChange={(value) =>
            setFormData((prev) => ({ ...prev, autoTriggerEnabled: value }))
          }
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
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                autoTriggerThreshold: parseFloat(event.target.value),
              }))
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
  );
}

function PromptSection({
  merged,
  setFormData,
}: {
  merged: Partial<AgentConfig>;
  setFormData: FormUpdater;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4" /> Custom System Prompt
      </h3>
      <Textarea
        value={merged.customSystemPrompt || ""}
        onChange={(event) =>
          setFormData((prev) => ({ ...prev, customSystemPrompt: event.target.value }))
        }
        placeholder="Organization-specific instructions..."
        rows={3}
        data-testid="input-system-prompt"
      />
    </div>
  );
}

function ToolsSection({
  merged,
  setFormData,
  availableTools,
}: {
  merged: Partial<AgentConfig>;
  setFormData: FormUpdater;
  availableTools: ToolInfo[];
}) {
  if (availableTools.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Wrench className="h-4 w-4" /> Tool Management
      </h3>
      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
        {availableTools.map((tool) => {
          const enabledTools = merged.enabledTools ?? availableTools.map((available) => available.name);
          const isEnabled = enabledTools.includes(tool.name);
          return (
            <div key={tool.name} className="flex items-center gap-1.5 text-xs">
              <Switch
                className="scale-75"
                checked={isEnabled}
                onCheckedChange={(checked) => {
                  const current = merged.enabledTools ?? availableTools.map((available) => available.name);
                  const updated = checked
                    ? [...current, tool.name]
                    : current.filter((name: string) => name !== tool.name);
                  setFormData((prev) => ({ ...prev, enabledTools: updated }));
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
  );
}
