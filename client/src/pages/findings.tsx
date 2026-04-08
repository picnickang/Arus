import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Bot, AlertTriangle, Clock, Shield, Package, Wrench, Users,
  Lightbulb, CheckCircle, XCircle, Eye, ChevronRight,
  FileText, Play, Filter, Inbox, BarChart3, RefreshCw,
  Loader2, X, ExternalLink, Calendar, Terminal, PauseCircle,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AgentChatPanel } from "@/components/agent/AgentChatPanel";

type FindingSource = "suggestion" | "draft" | "schedule_run";
type FindingSeverity = "info" | "warning" | "critical";
type FindingStatus = "pending" | "acted" | "dismissed" | "deferred" | "approved" | "rejected" | "completed" | "failed" | "running";

interface UnifiedFindingItem {
  id: string;
  source: FindingSource;
  sourceId: string;
  title: string;
  summary: string;
  severity: FindingSeverity;
  status: FindingStatus;
  entityType?: string | null;
  entityId?: string | null;
  triggerType?: string | null;
  draftType?: string | null;
  scheduleName?: string | null;
  scheduleId?: string | null;
  requiresAction: boolean;
  createdAt: string;
  updatedAt?: string | null;
  context?: Record<string, unknown> | null;
  outcome?: string | null;
  outcomeReason?: string | null;
  outcomeAt?: string | null;
  outcomeBy?: string | null;
}

const OUTCOME_CATEGORIES = [
  { value: "useful", label: "Useful" },
  { value: "already_handled", label: "Already Handled" },
  { value: "not_relevant", label: "Not Relevant" },
  { value: "too_late", label: "Too Late" },
  { value: "false_alarm", label: "False Alarm" },
] as const;

interface FindingsSummary {
  pendingApprovals: number;
  pendingSuggestions: number;
  recentFailures: number;
  totalFindings: number;
}

interface FindingsResponse {
  items: UnifiedFindingItem[];
  total: number;
}

const SOURCE_LABELS: Record<FindingSource, string> = {
  suggestion: "Suggestion",
  draft: "Draft",
  schedule_run: "Scheduled Run",
};

const SOURCE_ICONS: Record<FindingSource, typeof Lightbulb> = {
  suggestion: Lightbulb,
  draft: FileText,
  schedule_run: Play,
};

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  acted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  dismissed: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  deferred: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const TRIGGER_ICONS: Record<string, typeof AlertTriangle> = {
  high_risk_prediction: AlertTriangle,
  overdue_maintenance: Wrench,
  low_stock: Package,
  critical_alert: Shield,
  expiring_certification: Users,
  ai_summary: Bot,
};

const ENTITY_ROUTES: Record<string, string> = {
  equipment: "/maintenance?tab=equipment-intelligence",
  work_order: "/maintenance?tab=work-orders",
  vessel: "/fleet?tab=vessels",
  part: "/inventory?tab=parts",
  inventory: "/logistics?tab=inventory",
  maintenance_schedule: "/maintenance?tab=schedules",
  schedule: "/operations?tab=findings",
};

const ENTITY_LABELS: Record<string, string> = {
  equipment: "Equipment",
  work_order: "Work Order",
  vessel: "Vessel",
  part: "Part",
  inventory: "Inventory",
  maintenance_schedule: "Maintenance Schedule",
  schedule: "Schedule",
};

function EntityLink({ entityType, entityId }: { entityType?: string | null; entityId?: string | null }) {
  if (!entityType || !entityId) return null;
  const route = ENTITY_ROUTES[entityType];
  const label = ENTITY_LABELS[entityType] || entityType.replace(/_/g, " ");
  const shortId = entityId.length > 8 ? `${entityId.slice(0, 8)}…` : entityId;

  if (!route) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
        data-testid={`entity-link-${entityType}-${entityId}`}
      >
        <ExternalLink className="h-2.5 w-2.5" />
        {label}: {shortId}
      </span>
    );
  }
  return (
    <Link href={route}>
      <span
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
        data-testid={`entity-link-${entityType}-${entityId}`}
      >
        <ExternalLink className="h-2.5 w-2.5" />
        {label}: {shortId}
      </span>
    </Link>
  );
}

function RunOutputDialog({ item, open, onClose }: { item: UnifiedFindingItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto" data-testid="dialog-run-output">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Run Output — {item.scheduleName || item.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Badge variant="outline" className={cn("ml-2 text-xs", STATUS_STYLES[item.status] || "")}>
              {item.status}
            </Badge>
          </div>
          {item.scheduleName && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Schedule</span>
              <span className="ml-2 text-sm">{item.scheduleName}</span>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-muted-foreground">Created</span>
            <span className="ml-2 text-sm">{new Date(item.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block mb-1">Summary</span>
            <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap font-mono">
              {item.summary || "No output available"}
            </div>
          </div>
          {item.context && Object.keys(item.context).length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-1">Context</span>
              <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto font-mono">
                {JSON.stringify(item.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeDialog({
  open,
  onClose,
  action,
  onSubmit,
  onSkip,
}: {
  open: boolean;
  onClose: () => void;
  action: "act" | "dismiss" | "defer";
  onSubmit: (outcome: string, reason: string) => void;
  onSkip: () => void;
}) {
  const [outcome, setOutcome] = useState(action === "act" ? "useful" : "not_relevant");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setOutcome(action === "act" ? "useful" : "not_relevant");
      setReason("");
    }
  }, [open, action]);

  const actionLabels = { act: "Act On", dismiss: "Dismiss", defer: "Defer" };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-outcome">
        <DialogHeader>
          <DialogTitle className="text-base">{actionLabels[action]} — Outcome Feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Category (optional)</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why did you make this decision?"
              rows={2}
              className="text-xs"
              data-testid="input-outcome-reason"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => { onSkip(); setOutcome(action === "act" ? "useful" : "not_relevant"); setReason(""); }} data-testid="button-skip-outcome">Skip</Button>
          <Button
            size="sm"
            onClick={() => {
              onSubmit(outcome, reason);
              setOutcome(action === "act" ? "useful" : "not_relevant");
              setReason("");
            }}
            data-testid="button-submit-outcome"
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function SummaryStrip({ summary, isLoading }: { summary?: FindingsSummary; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="summary-strip-loading">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Pending Approvals",
      value: summary?.pendingApprovals ?? 0,
      icon: FileText,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "Unread Suggestions",
      value: summary?.pendingSuggestions ?? 0,
      icon: Lightbulb,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Recent Failures",
      value: summary?.recentFailures ?? 0,
      icon: XCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/20",
    },
    {
      label: "Total Active",
      value: summary?.totalFindings ?? 0,
      icon: BarChart3,
      color: "text-primary",
      bg: "bg-primary/5",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="summary-strip">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label} className={cn("border", bg)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("h-4 w-4", color)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={cn("text-2xl font-bold", color)} data-testid={`summary-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              {value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FilterBar({
  source,
  severity,
  status,
  dateFrom,
  dateTo,
  onSourceChange,
  onSeverityChange,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onReset,
}: {
  source: string;
  severity: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  onSourceChange: (v: string) => void;
  onSeverityChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onReset: () => void;
}) {
  const hasFilters = source !== "all" || severity !== "all" || status !== "all" || dateFrom !== "" || dateTo !== "";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="filter-bar">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Select value={source} onValueChange={onSourceChange}>
        <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="filter-source">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="suggestion">Suggestions</SelectItem>
          <SelectItem value="draft">Drafts</SelectItem>
          <SelectItem value="schedule_run">Scheduled Runs</SelectItem>
        </SelectContent>
      </Select>
      <Select value={severity} onValueChange={onSeverityChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="filter-severity">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severity</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="info">Info</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="acted">Acted</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="dismissed">Dismissed</SelectItem>
          <SelectItem value="deferred">Deferred</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="running">Running</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-[130px] h-8 text-xs"
          placeholder="From"
          data-testid="filter-date-from"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-[130px] h-8 text-xs"
          placeholder="To"
          data-testid="filter-date-to"
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={onReset} data-testid="button-reset-filters">
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}

function FindingCard({
  item,
  onApprove,
  onReject,
  onDismiss,
  onAct,
  onDefer,
  onViewOutput,
  onOpenAssistant,
}: {
  item: UnifiedFindingItem;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAct?: (id: string) => void;
  onDefer?: (id: string) => void;
  onViewOutput?: (item: UnifiedFindingItem) => void;
  onOpenAssistant: (item: UnifiedFindingItem) => void;
}) {
  const SourceIcon = SOURCE_ICONS[item.source];
  const TriggerIcon = item.triggerType ? TRIGGER_ICONS[item.triggerType] || Lightbulb : SourceIcon;

  return (
    <div
      className={cn(
        "p-4 border rounded-lg transition-colors hover:bg-muted/30",
        item.requiresAction && "border-l-4 border-l-amber-500",
      )}
      data-testid={`finding-card-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 p-1.5 rounded-md shrink-0",
          item.severity === "critical" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
          item.severity === "warning" ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" :
          "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        )}>
          <TriggerIcon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-medium leading-tight" data-testid={`finding-title-${item.id}`}>
                {item.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid={`finding-summary-${item.id}`}>
                {item.summary}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", SEVERITY_STYLES[item.severity])}>
              {item.severity}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STATUS_STYLES[item.status] || "")}>
              {item.status}
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {SOURCE_LABELS[item.source]}
            </Badge>
            {item.triggerType && item.source === "suggestion" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {item.triggerType.replace(/_/g, " ")}
              </Badge>
            )}
            <EntityLink entityType={item.entityType} entityId={item.entityId} />
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(item.createdAt)}
            </span>
          </div>

          {item.outcome && (
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground" data-testid={`outcome-info-${item.id}`}>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {item.outcome.replace(/_/g, " ")}
              </Badge>
              {item.outcomeReason && (
                <span className="truncate italic">"{item.outcomeReason}"</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-3">
            {item.source === "draft" && item.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onApprove?.(item.sourceId)}
                  data-testid={`button-approve-${item.id}`}
                >
                  <CheckCircle className="h-3 w-3" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1"
                  onClick={() => onReject?.(item.sourceId)}
                  data-testid={`button-reject-${item.id}`}
                >
                  <XCircle className="h-3 w-3" /> Reject
                </Button>
              </>
            )}
            {item.source === "suggestion" && item.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onAct?.(item.sourceId)}
                  data-testid={`button-act-${item.id}`}
                >
                  <CheckCircle className="h-3 w-3" /> Act On
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onDefer?.(item.sourceId)}
                  data-testid={`button-defer-${item.id}`}
                >
                  <PauseCircle className="h-3 w-3" /> Defer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onDismiss?.(item.sourceId)}
                  data-testid={`button-dismiss-${item.id}`}
                >
                  <X className="h-3 w-3" /> Dismiss
                </Button>
              </>
            )}
            {item.source === "schedule_run" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => onViewOutput?.(item)}
                data-testid={`button-view-output-${item.id}`}
              >
                <Terminal className="h-3 w-3" /> View Output
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 ml-auto"
              onClick={() => onOpenAssistant(item)}
              data-testid={`button-assistant-${item.id}`}
            >
              <Bot className="h-3 w-3" /> Ask Copilot
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FindingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [runOutputItem, setRunOutputItem] = useState<UnifiedFindingItem | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [outcomeAction, setOutcomeAction] = useState<"act" | "dismiss" | "defer">("act");
  const [outcomeSuggestionId, setOutcomeSuggestionId] = useState<string | null>(null);

  const queryFilterParams: Record<string, string | number | null> = {
    limit,
    offset,
    source: sourceFilter !== "all" ? sourceFilter : null,
    severity: severityFilter !== "all" ? severityFilter : null,
    status: statusFilter !== "all" ? statusFilter : null,
    dateFrom: dateFromFilter ? new Date(dateFromFilter).toISOString() : null,
    dateTo: dateToFilter ? new Date(dateToFilter + "T23:59:59").toISOString() : null,
  };

  const { data: findings, isLoading: findingsLoading } = useQuery<FindingsResponse>({
    queryKey: ["/api/agent/findings", queryFilterParams],
    refetchInterval: 30000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<FindingsSummary>({
    queryKey: ["/api/agent/findings/summary"],
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Draft approved" });
    },
    onError: (err: unknown) => toast({ title: "Failed to approve", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("POST", `/api/agent/drafts/${draftId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Draft rejected" });
    },
    onError: (err: unknown) => toast({ title: "Failed to reject", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, outcome, outcomeReason }: { id: string; outcome?: string; outcomeReason?: string }) =>
      apiRequest("POST", `/api/agent/suggestions/${id}/dismiss`, { outcome, outcomeReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Suggestion dismissed" });
    },
    onError: (err: unknown) => toast({ title: "Failed to dismiss", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
  });

  const actMutation = useMutation({
    mutationFn: ({ id, outcome, outcomeReason }: { id: string; outcome?: string; outcomeReason?: string }) =>
      apiRequest("POST", `/api/agent/suggestions/${id}/act`, { outcome, outcomeReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Marked as acted on" });
    },
    onError: (err: unknown) => toast({ title: "Failed to act", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
  });

  const deferMutation = useMutation({
    mutationFn: ({ id, outcome, outcomeReason }: { id: string; outcome?: string; outcomeReason?: string }) =>
      apiRequest("POST", `/api/agent/suggestions/${id}/defer`, { outcome, outcomeReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
      toast({ title: "Suggestion deferred" });
    },
    onError: (err: unknown) => toast({ title: "Failed to defer", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
  });

  const openOutcomeDialog = useCallback((action: "act" | "dismiss" | "defer", sugId: string) => {
    setOutcomeAction(action);
    setOutcomeSuggestionId(sugId);
    setOutcomeDialogOpen(true);
  }, []);

  const handleOutcomeSubmit = useCallback((outcome: string, reason: string) => {
    if (!outcomeSuggestionId) return;
    if (outcomeAction === "act") {
      actMutation.mutate({ id: outcomeSuggestionId, outcome, outcomeReason: reason || undefined });
    } else if (outcomeAction === "dismiss") {
      dismissMutation.mutate({ id: outcomeSuggestionId, outcome, outcomeReason: reason || undefined });
    } else {
      deferMutation.mutate({ id: outcomeSuggestionId, outcome, outcomeReason: reason || undefined });
    }
    setOutcomeDialogOpen(false);
    setOutcomeSuggestionId(null);
  }, [outcomeSuggestionId, outcomeAction, actMutation, dismissMutation, deferMutation]);

  const handleOutcomeSkip = useCallback(() => {
    if (!outcomeSuggestionId) return;
    if (outcomeAction === "act") {
      actMutation.mutate({ id: outcomeSuggestionId });
    } else if (outcomeAction === "dismiss") {
      dismissMutation.mutate({ id: outcomeSuggestionId });
    } else {
      deferMutation.mutate({ id: outcomeSuggestionId });
    }
    setOutcomeDialogOpen(false);
    setOutcomeSuggestionId(null);
  }, [outcomeSuggestionId, outcomeAction, actMutation, dismissMutation, deferMutation]);

  const openAssistant = useCallback((item: UnifiedFindingItem) => {
    const prompt = `I'd like help with this finding: "${item.title}". ${item.summary}. What should I do?`;
    setChatMessage(prompt);
    setChatOpen(true);
  }, []);

  const resetFilters = useCallback(() => {
    setSourceFilter("all");
    setSeverityFilter("all");
    setStatusFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setOffset(0);
  }, []);

  const items = findings?.items ?? [];
  const total = findings?.total ?? 0;
  const actionItems = items.filter(i => i.requiresAction);
  const feedItems = items.filter(i => !i.requiresAction);

  return (
    <div className="min-h-screen" data-testid="findings-page">
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold" data-testid="text-page-title">Agent Findings</h1>
              <p className="text-sm text-muted-foreground">
                Unified view of all AI agent activity — suggestions, drafts, and scheduled runs
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/agent/findings"] });
              queryClient.invalidateQueries({ queryKey: ["/api/agent/findings/summary"] });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="px-6 py-4">
        <SummaryStrip summary={summary} isLoading={summaryLoading} />

        <FilterBar
          source={sourceFilter}
          severity={severityFilter}
          status={statusFilter}
          dateFrom={dateFromFilter}
          dateTo={dateToFilter}
          onSourceChange={(v) => { setSourceFilter(v); setOffset(0); }}
          onSeverityChange={(v) => { setSeverityFilter(v); setOffset(0); }}
          onStatusChange={(v) => { setStatusFilter(v); setOffset(0); }}
          onDateFromChange={(v) => { setDateFromFilter(v); setOffset(0); }}
          onDateToChange={(v) => { setDateToFilter(v); setOffset(0); }}
          onReset={resetFilters}
        />

        {findingsLoading ? (
          <div className="space-y-3" data-testid="findings-loading">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 border rounded-lg" data-testid="findings-empty">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground">No findings yet</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Agent suggestions, draft actions, and scheduled run results will appear here.
            </p>
          </div>
        ) : (
          <>
            {actionItems.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold">Needs Your Attention ({actionItems.length})</h2>
                </div>
                <div className="space-y-2" data-testid="action-items">
                  {actionItems.map(item => (
                    <FindingCard
                      key={item.id}
                      item={item}
                      onApprove={id => approveMutation.mutate(id)}
                      onReject={id => rejectMutation.mutate(id)}
                      onDismiss={id => openOutcomeDialog("dismiss", id)}
                      onAct={id => openOutcomeDialog("act", id)}
                      onDefer={id => openOutcomeDialog("defer", id)}
                      onViewOutput={setRunOutputItem}
                      onOpenAssistant={openAssistant}
                    />
                  ))}
                </div>
              </div>
            )}

            {feedItems.length > 0 && (
              <div>
                {actionItems.length > 0 && (
                  <h2 className="text-sm font-semibold mb-3">All Findings</h2>
                )}
                <div className="space-y-2" data-testid="feed-items">
                  {feedItems.map(item => (
                    <FindingCard
                      key={item.id}
                      item={item}
                      onViewOutput={setRunOutputItem}
                      onOpenAssistant={openAssistant}
                    />
                  ))}
                </div>
              </div>
            )}

            {total > limit && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-xs text-muted-foreground">
                  Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + limit >= total}
                    onClick={() => setOffset(offset + limit)}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AgentChatPanel
        open={chatOpen}
        onClose={() => { setChatOpen(false); setChatMessage(null); }}
        initialMessage={chatMessage}
      />

      <RunOutputDialog
        item={runOutputItem}
        open={!!runOutputItem}
        onClose={() => setRunOutputItem(null)}
      />

      <OutcomeDialog
        open={outcomeDialogOpen}
        onClose={() => { setOutcomeDialogOpen(false); setOutcomeSuggestionId(null); }}
        action={outcomeAction}
        onSubmit={handleOutcomeSubmit}
        onSkip={handleOutcomeSkip}
      />
    </div>
  );
}
