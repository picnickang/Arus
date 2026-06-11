import type { ElementType } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  ChevronRight,
  ClipboardCheck,
  DatabaseZap,
  PackageX,
  Wrench,
} from "lucide-react";
import type {
  LogisticsDataSourceStatus,
  LogisticsKpi,
  LogisticsQueueItem,
} from "@/features/logistics/logistics-overview-model";

export function ActionButton({
  href,
  label,
  icon: Icon,
  primary,
}: {
  href: string;
  label: string;
  icon: ElementType;
  primary?: boolean;
}) {
  return (
    <Button asChild variant={primary ? "default" : "outline"} size="sm" className="justify-start">
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function toneClass(tone: LogisticsKpi["tone"]): string {
  switch (tone) {
    case "red":
      return "bg-rose-500/15 text-rose-600";
    case "amber":
      return "bg-amber-500/15 text-amber-700";
    case "green":
      return "bg-emerald-500/15 text-emerald-700";
    case "purple":
      return "bg-violet-500/15 text-violet-700";
    case "blue":
    default:
      return "bg-blue-500/15 text-blue-600";
  }
}

export function KpiCard({
  kpi,
  "data-testid": dataTestId,
}: {
  kpi: LogisticsKpi;
  "data-testid": string;
}) {
  const Icon =
    kpi.id === "critical-stockouts"
      ? PackageX
      : kpi.id === "pending-requests"
        ? ClipboardCheck
        : kpi.id === "open-service-orders"
          ? Wrench
          : Building2;

  return (
    <Card data-testid={dataTestId}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-md p-2 ${toneClass(kpi.tone)}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            {kpi.label}
          </div>
          <div className="text-3xl font-bold mt-1">{kpi.value}</div>
          <div className="text-xs text-muted-foreground truncate">{kpi.helper}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PanelHeader({
  title,
  description,
  actionHref,
  actionLabel,
  actionTestId,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  actionTestId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {actionHref && actionLabel && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          data-testid={actionTestId}
        >
          <Link href={actionHref}>
            {actionLabel} <ChevronRight className="h-3 w-3" />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function QueueRow({ row }: { row: LogisticsQueueItem }) {
  return (
    <Link href={row.href} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
      <Badge
        variant="outline"
        className={`${toneClass(row.tone)} border-transparent w-20 justify-center`}
      >
        {row.status}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{row.title}</div>
        <div className="text-xs text-muted-foreground truncate">{row.context}</div>
      </div>
      <span className="text-xs font-semibold text-primary shrink-0">
        {row.action} <ChevronRight className="inline h-3 w-3" />
      </span>
    </Link>
  );
}

export function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  message,
  testId = "logistics-empty-state",
  compact,
}: {
  message: string;
  testId?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`${compact ? "p-4" : "p-6"} text-sm text-muted-foreground`}
      data-testid={testId}
    >
      {message}
    </div>
  );
}

/**
 * One-line source-status strip. Replaces the old Data Health card — the
 * overview's job is the queue; source state only needs a glance.
 */
export function DataHealthStrip({ sources }: { sources: LogisticsDataSourceStatus[] }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground"
      data-testid="logistics-data-health"
    >
      <span className="font-medium">Sources:</span>
      {sources.map((source) => (
        <span key={source.id} className="flex items-center gap-1.5" title={source.detail}>
          <DatabaseZap
            className={`h-3.5 w-3.5 ${
              source.state === "degraded" ? "text-amber-600" : "text-emerald-600"
            }`}
          />
          {source.label}
          {source.state !== "healthy" && (
            <span className={source.state === "degraded" ? "text-amber-600" : ""}>
              — {source.state}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function JumpCard({
  href,
  icon: Icon,
  label,
  description,
  testId,
}: {
  href: string;
  icon: ElementType;
  label: string;
  description?: string;
  testId: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:bg-accent/40 transition-colors cursor-pointer" data-testid={testId}>
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="h-5 w-5 text-primary shrink-0" />
          <div>
            <div className="text-sm font-medium">{label}</div>
            {description && <div className="text-xs text-muted-foreground">{description}</div>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
