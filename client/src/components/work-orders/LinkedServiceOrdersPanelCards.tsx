import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  type LinkedServiceOrder,
} from "@/features/work-orders/hooks/useWoSoBridge";
import { SRPriorityBadge } from "@/features/serviceRequests/components/SRPriorityBadge";
import { SRStatusBadge } from "@/features/serviceRequests/components/SRStatusBadge";
import type { ServiceRequest } from "@/features/serviceRequests/types";
import { cn } from "@/lib/utils";

function soStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "in_progress":
      return "secondary";
    case "cancelled":
      return "destructive";
    case "draft":
    case "sent":
    case "confirmed":
      return "outline";
    default:
      return "outline";
  }
}

function soStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    sent: "Sent to Provider",
    confirmed: "Confirmed",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

const TIMELINE_STEPS = [
  { key: "created", label: "Created" },
  { key: "sent", label: "Sent" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
] as const;

function getTimelineIndex(status: string): number {
  const map: Record<string, number> = {
    draft: 0,
    sent: 1,
    confirmed: 2,
    in_progress: 3,
    completed: 4,
  };
  return map[status] ?? -1;
}

function getTimestampForStep(so: LinkedServiceOrder, stepKey: string): string | null {
  switch (stepKey) {
    case "created":
      return so.createdAt;
    case "sent":
      return so.sentAt;
    case "confirmed":
      return so.confirmedAt;
    case "completed":
      return so.completedAt;
    default:
      return null;
  }
}

function MiniTimeline({ so }: { so: LinkedServiceOrder }) {
  const currentIdx = getTimelineIndex(so.status);
  const isCancelled = so.status === "cancelled";

  if (isCancelled) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-destructive"
        data-testid={`timeline-cancelled-${so.id}`}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>Cancelled{so.cancellationReason ? `: ${so.cancellationReason}` : ""}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 mt-2" data-testid={`timeline-${so.id}`}>
      <div className="flex items-center gap-0.5">
        {TIMELINE_STEPS.map((step, i) => {
          const isDone = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const ts = getTimestampForStep(so, step.key);
          return (
            <div key={step.key} className="flex items-center gap-0.5">
              <div
                className={cn(
                  "h-2 w-2 rounded-full border transition-colors",
                  isDone
                    ? isCurrent
                      ? "bg-primary border-primary"
                      : "bg-primary/60 border-primary/60"
                    : "bg-muted border-muted-foreground/30"
                )}
                title={ts ? `${step.label}: ${new Date(ts).toLocaleDateString()}` : step.label}
              />
              {i < TIMELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-3 transition-colors",
                    i < currentIdx ? "bg-primary/60" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-1.5">
          {TIMELINE_STEPS[currentIdx]?.label || so.status}
        </span>
      </div>
      {(so.sentAt || so.confirmedAt || so.completedAt) && (
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {so.sentAt && (
            <span>
              Sent:{" "}
              {new Date(so.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {so.confirmedAt && (
            <span>
              Confirmed:{" "}
              {new Date(so.confirmedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {so.completedAt && (
            <span>
              Completed:{" "}
              {new Date(so.completedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function OnTrackIndicator({ so }: { so: LinkedServiceOrder }) {
  if (so.status === "completed" || so.status === "cancelled" || so.status === "draft") {
    return null;
  }
  const scheduledEnd = so.scheduledEndDate ? new Date(so.scheduledEndDate) : null;
  if (!scheduledEnd) {
    return null;
  }

  const now = new Date();
  const daysLeft = Math.ceil((scheduledEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = now > scheduledEnd;

  if (isOverdue) {
    return (
      <div
        className="flex items-center gap-1 text-[10px] text-destructive font-medium"
        data-testid={`indicator-overdue-${so.id}`}
      >
        <AlertTriangle className="h-3 w-3" /> {Math.abs(daysLeft)}d overdue
      </div>
    );
  }
  if (daysLeft <= 3) {
    return (
      <div
        className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium"
        data-testid={`indicator-due-soon-${so.id}`}
      >
        <Clock className="h-3 w-3" /> {daysLeft}d left
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400"
      data-testid={`indicator-on-track-${so.id}`}
    >
      <CheckCircle2 className="h-3 w-3" /> On track
    </div>
  );
}

function CostVariance({ so }: { so: LinkedServiceOrder }) {
  const quoted = so.quotedAmount;
  const actual = so.actualAmount;
  const currency = so.currency || "USD";
  if (quoted == null && actual == null) {
    return null;
  }

  const fmt = (v: number) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
    } catch {
      return `$${v.toLocaleString()}`;
    }
  };

  if (actual != null && quoted != null && quoted > 0) {
    const variance = actual - quoted;
    const pct = ((variance / quoted) * 100).toFixed(1);
    const isOver = variance > 0;
    return (
      <div className="space-y-0.5" data-testid={`cost-variance-${so.id}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Quoted: {fmt(quoted)}</span>
          <span>Actual: {fmt(actual)}</span>
        </div>
        {variance !== 0 && (
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium",
              isOver ? "text-destructive" : "text-green-600 dark:text-green-400"
            )}
          >
            {isOver ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isOver ? "+" : ""}
            {fmt(variance)} ({isOver ? "+" : ""}
            {pct}%)
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {quoted != null && <span>Quoted: {fmt(quoted)}</span>}
      {actual != null && <span>Actual: {fmt(actual)}</span>}
    </div>
  );
}

function DateRange({
  label,
  start,
  end,
}: {
  label: string;
  start: string | null;
  end: string | null;
}) {
  if (!start && !end) {
    return null;
  }
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="h-3 w-3 flex-shrink-0" />
      <span className="font-medium">{label}:</span>
      {start && <span>{fmtDate(start)}</span>}
      {start && end && <span>-</span>}
      {end && <span>{fmtDate(end)}</span>}
    </div>
  );
}

export function ServiceRequestCard({ sr }: { sr: ServiceRequest }) {
  return (
    <div
      className="p-3 rounded-lg border border-dashed hover:bg-accent/30 transition-colors space-y-1.5"
      data-testid={`linked-sr-${sr.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{sr.requestNumber}</span>
          <SRStatusBadge status={sr.status} />
          <SRPriorityBadge priority={sr.urgency} />
        </div>
        {sr.serviceOrderId && (
          <Link
            href={`/service-orders?id=${sr.serviceOrderId}`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
            data-testid={`link-sr-so-${sr.id}`}
          >
            <ArrowRight className="h-3 w-3" /> View SO
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-1">{sr.title}</p>
      {sr.rejectionReason && (
        <p className="text-xs text-destructive line-clamp-1">Rejected: {sr.rejectionReason}</p>
      )}
      <div className="text-[10px] text-muted-foreground">
        Requested by {sr.requestedBy} on {new Date(sr.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

export function ServiceOrderCard({ so }: { so: LinkedServiceOrder }) {
  return (
    <div
      className="p-3 rounded-lg border hover:bg-accent/30 transition-colors space-y-2"
      data-testid={`linked-so-${so.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{so.soNumber}</span>
          <Badge variant={soStatusVariant(so.status)} className="text-[10px]">
            {soStatusLabel(so.status)}
          </Badge>
          <OnTrackIndicator so={so} />
        </div>
        <Link
          href={`/service-orders?id=${so.id}`}
          className="text-xs text-primary hover:underline flex items-center gap-1"
          data-testid={`link-so-${so.id}`}
        >
          Open <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {so.createdAt && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Created {new Date(so.createdAt).toLocaleDateString()}
        </div>
      )}

      {so.serviceProviderName && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Building2 className="h-3 w-3" />
          {so.supplierProfileId ? (
            <Link
              href={`/logistics?tab=inventory&purchasing=1&supplier=${so.supplierProfileId}`}
              className="text-primary hover:underline"
              data-testid={`link-supplier-${so.id}`}
            >
              {so.serviceProviderName}
            </Link>
          ) : (
            so.serviceProviderName
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <DateRange label="Scheduled" start={so.scheduledStartDate} end={so.scheduledEndDate} />
        {(so.actualStartDate || so.actualEndDate) && (
          <DateRange label="Actual" start={so.actualStartDate} end={so.actualEndDate} />
        )}
      </div>

      <CostVariance so={so} />

      {so.scope && <p className="text-xs text-muted-foreground line-clamp-2">{so.scope}</p>}

      {so.serviceDetails && (
        <div className="text-xs text-muted-foreground" data-testid={`so-service-details-${so.id}`}>
          <span className="font-medium">Details:</span> {so.serviceDetails}
        </div>
      )}

      {so.specialRequirements && (
        <div
          className="text-xs text-amber-600 dark:text-amber-400"
          data-testid={`so-special-req-${so.id}`}
        >
          <span className="font-medium">Special Requirements:</span> {so.specialRequirements}
        </div>
      )}

      {so.revisionNotes && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400 border-l-2 border-amber-400 pl-2">
          <span className="font-medium">Revision:</span> {so.revisionNotes}
        </div>
      )}

      {(so.estimatedDurationHours != null || so.actualDurationHours != null) && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          {so.estimatedDurationHours != null && (
            <span>Est. Duration: {so.estimatedDurationHours}h</span>
          )}
          {so.actualDurationHours != null && <span>Actual: {so.actualDurationHours}h</span>}
          {so.estimatedDurationHours != null && so.actualDurationHours != null && (
            <span
              className={
                so.actualDurationHours > so.estimatedDurationHours
                  ? "text-destructive"
                  : "text-green-600 dark:text-green-400"
              }
            >
              ({so.actualDurationHours > so.estimatedDurationHours ? "+" : ""}
              {(so.actualDurationHours - so.estimatedDurationHours).toFixed(1)}h)
            </span>
          )}
        </div>
      )}

      <MiniTimeline so={so} />
    </div>
  );
}
