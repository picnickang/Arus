import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  BarChart3,
  Calendar,
  Eye,
  FileText,
  Filter,
  Lightbulb,
  RefreshCw,
  Terminal,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type UnifiedFindingItem,
  OUTCOME_CATEGORIES,
  STATUS_STYLES,
} from "./findings-cards";

export interface FindingsSummary {
  pendingApprovals: number;
  pendingSuggestions: number;
  recentFailures: number;
  totalFindings: number;
  agentFindings: number;
}

export function FindingsPageHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="px-6 py-4 border-b">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">
              Agent Findings
            </h1>
            <p className="text-sm text-muted-foreground">
              Unified view of all AI agent activity — suggestions, drafts, scheduled runs, and
              agent findings
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>
    </div>
  );
}

export function RunOutputDialog({
  item,
  open,
  onClose,
}: {
  item: UnifiedFindingItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!item) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[70vh] overflow-y-auto"
        data-testid="dialog-run-output"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Run Output — {item.scheduleName || item.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Badge
              variant="outline"
              className={cn("ml-2 text-xs", STATUS_STYLES[item.status] || "")}
            >
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

export function OutcomeDialog({
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
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
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
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why did you make this decision?"
              rows={2}
              className="text-xs"
              data-testid="input-outcome-reason"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onSkip();
              setOutcome(action === "act" ? "useful" : "not_relevant");
              setReason("");
            }}
            data-testid="button-skip-outcome"
          >
            Skip
          </Button>
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

export function SummaryStrip({
  summary,
  isLoading,
}: {
  summary?: FindingsSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        data-testid="summary-strip-loading"
      >
        {[1, 2, 3, 4].map((i) => (
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
            <p
              className={cn("text-2xl font-bold", color)}
              data-testid={`summary-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FilterBar({
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
  onSourceChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onReset: () => void;
}) {
  const hasFilters =
    source !== "all" || severity !== "all" || status !== "all" || dateFrom !== "" || dateTo !== "";

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
          <SelectItem value="agent_finding">Agent Findings</SelectItem>
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
          onChange={(event) => onDateFromChange(event.target.value)}
          className="w-[130px] h-8 text-xs"
          placeholder="From"
          data-testid="filter-date-from"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className="w-[130px] h-8 text-xs"
          placeholder="To"
          data-testid="filter-date-to"
        />
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={onReset}
          data-testid="button-reset-filters"
        >
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}
