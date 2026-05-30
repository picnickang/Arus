import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Lightbulb,
  X,
  Bot,
  AlertTriangle,
  Clock,
  Shield,
  Package,
  Wrench,
  Users,
  ChevronRight,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";
import { AgentChatPanel } from "./AgentChatPanel";

const OUTCOME_CATEGORIES = [
  { value: "useful", label: "Useful" },
  { value: "already_handled", label: "Already Handled" },
  { value: "not_relevant", label: "Not Relevant" },
  { value: "too_late", label: "Too Late" },
  { value: "false_alarm", label: "False Alarm" },
];

interface Suggestion {
  id: string;
  triggerType: string;
  title: string;
  summary: string;
  entityType?: string | null | undefined;
  entityId?: string | null | undefined;
  severity: string;
  status: string;
  actedOn?: boolean;
  createdAt: string;
}

const TRIGGER_ICONS: Record<string, typeof AlertTriangle> = {
  high_risk_prediction: AlertTriangle,
  overdue_maintenance: Wrench,
  low_stock: Package,
  critical_alert: Shield,
  expiring_certification: Users,
  ai_summary: Bot,
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

function formatTriggerType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

const MAINTENANCE_ROLES = [
  "admin",
  "chief_engineer",
  "second_engineer",
  "captain",
  "chief_officer",
];

export function SuggestionBell() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [dismissTargetId, setDismissTargetId] = useState<string | null>(null);
  const [dismissOutcome, setDismissOutcome] = useState("not_relevant");
  const [dismissReason, setDismissReason] = useState("");
  const queryClient = useQueryClient();
  const { roles } = useUserPermissions();
  const canMutate = roles.some((r) => MAINTENANCE_ROLES.includes(r.name));

  const { data: suggestions = [] } = useQuery<Suggestion[]>({
    queryKey: ["/api/agent/suggestions"],
    refetchInterval: 60000,
  });

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const historySuggestions = suggestions.filter((s) => s.status !== "pending");

  const dismissMutation = useMutation({
    mutationFn: ({
      id,
      outcome,
      outcomeReason,
    }: {
      id: string;
      outcome?: string;
      outcomeReason?: string;
    }) => apiRequest("POST", `/api/agent/suggestions/${id}/dismiss`, { outcome, outcomeReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
    },
  });

  const openDismissDialog = useCallback((id: string) => {
    setDismissTargetId(id);
    setDismissOutcome("not_relevant");
    setDismissReason("");
    setPopoverOpen(false);
    setDismissDialogOpen(true);
  }, []);

  const handleDismissSubmit = useCallback(() => {
    if (!dismissTargetId) {
      return;
    }
    dismissMutation.mutate({
      id: dismissTargetId,
      ...(dismissOutcome !== undefined && { outcome: dismissOutcome }),
      ...(dismissReason && { outcomeReason: dismissReason }),
    });
    setDismissDialogOpen(false);
    setDismissTargetId(null);
  }, [dismissTargetId, dismissOutcome, dismissReason, dismissMutation]);

  const handleDismissSkip = useCallback(() => {
    if (!dismissTargetId) {
      return;
    }
    dismissMutation.mutate({ id: dismissTargetId });
    setDismissDialogOpen(false);
    setDismissTargetId(null);
  }, [dismissTargetId, dismissMutation]);

  const openInAssistant = useCallback((suggestion: Suggestion) => {
    const prompt = `I'd like help with this suggestion: "${suggestion.title}". ${suggestion.summary}. What actions should I take?`;
    setChatMessage(prompt);
    setChatOpen(true);
    setPopoverOpen(false);
  }, []);

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            data-testid="button-suggestion-bell"
          >
            <Lightbulb className="h-5 w-5" />
            {pendingSuggestions.length > 0 && (
              <span
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-medium"
                data-testid="badge-suggestion-count"
              >
                {pendingSuggestions.length > 9 ? "9+" : pendingSuggestions.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end" data-testid="popover-suggestions">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">AI Suggestions</span>
            </div>
            <Badge variant="secondary" className="text-xs" data-testid="badge-suggestion-total">
              {pendingSuggestions.length} new
            </Badge>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-2 h-8 rounded-none border-b">
              <TabsTrigger
                value="pending"
                className="text-xs"
                data-testid="tab-suggestions-pending"
              >
                Active ({pendingSuggestions.length})
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="text-xs"
                data-testid="tab-suggestions-history"
              >
                History ({historySuggestions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="m-0">
              <ScrollArea className="max-h-80">
                {pendingSuggestions.length === 0 ? (
                  <div
                    className="p-6 text-center text-muted-foreground text-sm"
                    data-testid="text-no-suggestions"
                  >
                    No active suggestions
                  </div>
                ) : (
                  <div className="divide-y">
                    {pendingSuggestions.map((suggestion) => (
                      <SuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        {...(canMutate && { onDismiss: () => openDismissDialog(suggestion.id) })}
                        onOpenInAssistant={() => openInAssistant(suggestion)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="m-0">
              <ScrollArea className="max-h-80">
                {historySuggestions.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No suggestion history
                  </div>
                ) : (
                  <div className="divide-y">
                    {historySuggestions.slice(0, 20).map((suggestion) => (
                      <HistoryCard key={suggestion.id} suggestion={suggestion} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
      <AgentChatPanel
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setChatMessage(null);
        }}
        initialMessage={chatMessage}
      />
      <Dialog open={dismissDialogOpen} onOpenChange={(v) => !v && setDismissDialogOpen(false)}>
        <DialogContent className="max-w-md" data-testid="dialog-bell-dismiss-outcome">
          <DialogHeader>
            <DialogTitle className="text-base">Dismiss — Outcome Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Category (optional)</Label>
              <Select value={dismissOutcome} onValueChange={setDismissOutcome}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-bell-dismiss-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOME_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Why are you dismissing this?"
                rows={2}
                className="text-xs"
                data-testid="input-bell-dismiss-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismissSkip}
              data-testid="button-bell-dismiss-skip"
            >
              Skip
            </Button>
            <Button
              size="sm"
              onClick={handleDismissSubmit}
              data-testid="button-bell-dismiss-submit"
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SuggestionCard({
  suggestion,
  onDismiss,
  onOpenInAssistant,
}: {
  suggestion: Suggestion;
  onDismiss?: () => void;
  onOpenInAssistant: () => void;
}) {
  const Icon = TRIGGER_ICONS[suggestion.triggerType] || Lightbulb;

  return (
    <div
      className="p-3 hover:bg-muted/50 transition-colors"
      data-testid={`card-suggestion-${suggestion.id}`}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-0.5 p-1 rounded",
            suggestion.severity === "critical"
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : suggestion.severity === "warning"
                ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span
              className="text-xs font-medium truncate"
              data-testid={`text-suggestion-title-${suggestion.id}`}
            >
              {suggestion.title}
            </span>
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={onDismiss}
                data-testid={`button-dismiss-${suggestion.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <p
            className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
            data-testid={`text-suggestion-summary-${suggestion.id}`}
          >
            {suggestion.summary}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1 py-0", SEVERITY_STYLES[suggestion.severity])}
              >
                {suggestion.severity}
              </Badge>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo(suggestion.createdAt)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2 gap-1"
              onClick={onOpenInAssistant}
              data-testid={`button-open-assistant-${suggestion.id}`}
            >
              <Bot className="h-3 w-3" />
              Open in Assistant
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ suggestion }: { suggestion: Suggestion }) {
  const Icon = TRIGGER_ICONS[suggestion.triggerType] || Lightbulb;

  return (
    <div className="p-3 opacity-75" data-testid={`card-history-${suggestion.id}`}>
      <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <span className="text-xs truncate block">{suggestion.title}</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {suggestion.status === "acted"
                ? "Acted on"
                : suggestion.status === "dismissed"
                  ? "Dismissed"
                  : suggestion.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {timeAgo(suggestion.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
