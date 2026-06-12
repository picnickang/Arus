import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  AlertTriangle,
  Shield,
  Package,
  Wrench,
  Users,
  Lightbulb,
  CheckCircle,
  XCircle,
  Eye,
  ChevronRight,
  FileText,
  Play,
  Clock,
  ExternalLink,
  Terminal,
  PauseCircle,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  ENTITY_LABELS,
  ENTITY_ROUTES,
  SEVERITY_STYLES,
  SOURCE_LABELS,
  STATUS_STYLES,
  type FindingSource,
  type UnifiedFindingItem,
} from "./findings-card-types";

const SOURCE_ICONS: Record<FindingSource, typeof Lightbulb> = {
  suggestion: Lightbulb,
  draft: FileText,
  schedule_run: Play,
  agent_finding: Eye,
};

const TRIGGER_ICONS: Record<string, typeof AlertTriangle> = {
  high_risk_prediction: AlertTriangle,
  overdue_maintenance: Wrench,
  low_stock: Package,
  critical_alert: Shield,
  expiring_certification: Users,
  ai_summary: Bot,
  anomaly: AlertTriangle,
  recommendation: Lightbulb,
  risk: Shield,
  compliance_gap: FileText,
};

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(dateStr).toLocaleDateString();
}

function EntityLink({
  entityType,
  entityId,
}: {
  entityType?: string | null | undefined;
  entityId?: string | null | undefined;
}) {
  if (!entityType || !entityId) {
    return null;
  }
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

export function FindingCard({
  item,
  onApprove,
  onReject,
  onDismiss,
  onAct,
  onDefer,
  onViewOutput,
  onOpenAssistant,
  onAcknowledge,
  onArchive,
}: {
  item: UnifiedFindingItem;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAct?: (id: string) => void;
  onDefer?: (id: string) => void;
  onViewOutput?: (item: UnifiedFindingItem) => void;
  onOpenAssistant: (item: UnifiedFindingItem) => void;
  onAcknowledge?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const SourceIcon = SOURCE_ICONS[item.source];
  const TriggerIcon = item.triggerType ? TRIGGER_ICONS[item.triggerType] || Lightbulb : SourceIcon;

  return (
    <div
      className={cn(
        "p-4 border rounded-lg transition-colors hover:bg-muted/30",
        item.requiresAction && "border-l-4 border-l-amber-500"
      )}
      data-testid={`finding-card-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 p-1.5 rounded-md shrink-0",
            item.severity === "critical"
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : item.severity === "warning"
                ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          )}
        >
          <TriggerIcon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="text-sm font-medium leading-tight"
                data-testid={`finding-title-${item.id}`}
              >
                {item.title}
              </h3>
              <p
                className="text-xs text-muted-foreground mt-1 line-clamp-2"
                data-testid={`finding-summary-${item.id}`}
              >
                {item.summary}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", SEVERITY_STYLES[item.severity])}
            >
              {item.severity}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", STATUS_STYLES[item.status] || "")}
            >
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
            {item.source === "suggestion" &&
              Boolean(item.context?.["costImpact"]) &&
              (() => {
                const ci =
                  (
                    item.context as {
                      costImpact?: { revenueImpact?: number; estimatedRepairCost?: number };
                    }
                  ).costImpact ?? {};
                const atRisk = ci.revenueImpact ?? 0;
                if (atRisk <= 0) {
                  return null;
                }
                const fmt =
                  atRisk >= 1000 ? `~$${(atRisk / 1000).toFixed(0)}K` : `~$${atRisk.toFixed(0)}`;
                return (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                    data-testid={`badge-cost-impact-${item.id}`}
                  >
                    {fmt} at risk
                  </Badge>
                );
              })()}
            <EntityLink entityType={item.entityType} entityId={item.entityId} />
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(item.createdAt)}
            </span>
          </div>

          {item.outcome && (
            <div
              className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground"
              data-testid={`outcome-info-${item.id}`}
            >
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
            {item.source === "agent_finding" && item.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onAcknowledge?.(item.sourceId)}
                  data-testid={`button-acknowledge-${item.id}`}
                >
                  <CheckCircle className="h-3 w-3" /> Acknowledge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onArchive?.(item.sourceId)}
                  data-testid={`button-archive-${item.id}`}
                >
                  <X className="h-3 w-3" /> Archive
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
