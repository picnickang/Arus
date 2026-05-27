/**
 * UI Align Phase 6 — System Administration Overview (panel 8).
 *
 * Service health row + Recent Audit Logs + System Metrics. Deep-link
 * routes (/system-administration, /configuration, /admin/tenants,
 * /diagnostics, etc.) continue to work — this hub only adds the
 * overview layer.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Database,
  Cloud,
  Cpu,
  AlertTriangle,
  ChevronRight,
  Settings,
  Shield,
  Building,
  Bell,
  Bot,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors `HealthCheckResult` from
 * `server/routes/diagnostics/types.ts`. `checks.{database,telemetry,
 * memory}` carry pass/warn/fail; `checks.services` is an array of
 * `{name, status}` where `status` is running/stopped/error. The
 * endpoint returns HTTP 503 with a populated body when degraded /
 * unhealthy, so we read the body regardless of status (see
 * `healthQueryFn` below) — losing health visibility precisely when
 * services are degraded would be the opposite of what this card is
 * for.
 */
interface CheckResult {
  status?: "pass" | "warn" | "fail" | string;
  message?: string;
  responseTimeMs?: number;
}

interface ServiceStatusEntry {
  name: string;
  status?: "running" | "stopped" | "error" | string;
}

interface HealthResponse {
  status?: "healthy" | "degraded" | "unhealthy" | string;
  uptime?: number;
  checks?: {
    database?: CheckResult;
    telemetry?: CheckResult;
    memory?: CheckResult;
    services?: ServiceStatusEntry[];
  };
}

async function healthQueryFn(): Promise<HealthResponse> {
  const res = await fetch("/api/diagnostics/health", { credentials: "include" });
  // 200 healthy, 503 degraded/unhealthy — both have a JSON body we want.
  try {
    return (await res.json()) as HealthResponse;
  } catch {
    return { status: "unhealthy" };
  }
}

interface AuditEvent {
  id?: string;
  userId?: string | null;
  userName?: string | null;
  action?: string | null;
  resourceType?: string | null;
  timestamp?: string | null;
  createdAt?: string | null;
}

interface AuditResponse {
  events?: AuditEvent[];
}

const SERVICE_LABELS: Record<string, string> = {
  database: "Database",
  telemetry: "Telemetry",
  memory: "Memory",
};

const HEALTHY_STATUSES = new Set([
  "healthy",
  "ok",
  "up",
  "operational",
  "pass",
  "running",
]);
const WARN_STATUSES = new Set(["degraded", "warning", "warn"]);
const FAIL_STATUSES = new Set([
  "unhealthy",
  "down",
  "error",
  "fail",
  "stopped",
]);

function statusTone(status: string | undefined): {
  dot: string;
  text: string;
  label: string;
} {
  const s = (status ?? "").toLowerCase();
  if (HEALTHY_STATUSES.has(s)) {
    return { dot: "bg-emerald-500", text: "text-emerald-600", label: "Operational" };
  }
  if (WARN_STATUSES.has(s)) {
    return { dot: "bg-amber-500", text: "text-amber-600", label: "Degraded" };
  }
  if (FAIL_STATUSES.has(s)) {
    return { dot: "bg-rose-500", text: "text-rose-600", label: "Down" };
  }
  return { dot: "bg-slate-400", text: "text-slate-500", label: status ?? "Unknown" };
}

interface ServiceCardData {
  key: string;
  label: string;
  status?: string;
}

function flattenServiceCards(health: HealthResponse | undefined): ServiceCardData[] {
  const checks = health?.checks;
  if (!checks) {
    return [];
  }
  const cards: ServiceCardData[] = [];
  for (const key of ["database", "telemetry", "memory"] as const) {
    const check = checks[key];
    if (check) {
      cards.push({
        key,
        label: SERVICE_LABELS[key] ?? key,
        status: check.status,
      });
    }
  }
  for (const svc of checks.services ?? []) {
    cards.push({ key: svc.name, label: svc.name, status: svc.status });
  }
  return cards;
}

function isOperational(status: string | undefined): boolean {
  return HEALTHY_STATUSES.has((status ?? "").toLowerCase());
}

function formatUptime(seconds: number | undefined): string {
  if (!seconds || Number.isNaN(seconds)) {
    return "—";
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SystemHub() {
  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
  } = useQuery<HealthResponse>({
    queryKey: ["/api/diagnostics/health"],
    queryFn: healthQueryFn,
    staleTime: 30_000,
    retry: false,
  });

  const { data: auditData, error: auditError } = useQuery<AuditResponse>({
    queryKey: ["/api/admin/audit"],
    staleTime: 60_000,
  });

  const serviceCards = flattenServiceCards(health);
  const events = auditData?.events ?? [];
  const operationalCount = serviceCards.filter((c) => isOperational(c.status)).length;

  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="system-hub-overview">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">System Administration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Service health, audit logs, and system metrics.
          </p>
        </div>
        <Link href="/system?tab=admin">
          <Button data-testid="button-open-administration" variant="outline" className="gap-2">
            Open administration <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {(healthError || auditError) && (
        <div
          className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm"
          data-testid="system-hub-error"
        >
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <span>Some system data could not be loaded. Values shown may be incomplete.</span>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Service health</h2>
        {healthLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : serviceCards.length === 0 ? (
          <Card data-testid="empty-service-health">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No service health data available.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="service-health-grid">
            {serviceCards.map((card) => {
              const tone = statusTone(card.status);
              return (
                <Card key={card.key} data-testid={`service-${card.key}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${tone.dot} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{card.label}</div>
                      <div className={`text-xs font-semibold ${tone.text}`}>{tone.label}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-semibold">Recent audit logs</h2>
              <Link href="/system-administration?tab=audit">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  data-testid="button-view-all-audit"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            {events.length === 0 ? (
              <div
                className="p-6 text-sm text-muted-foreground"
                data-testid="empty-audit-logs"
              >
                No recent audit events.
              </div>
            ) : (
              <ul className="divide-y" data-testid="list-audit-logs">
                {events.slice(0, 8).map((evt, i) => (
                  <li
                    key={evt.id ?? `${evt.action ?? "evt"}-${i}`}
                    className="flex items-center gap-3 px-4 py-2"
                    data-testid={`row-audit-${i}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {evt.action ?? "Unknown action"}
                        {evt.resourceType ? (
                          <span className="text-muted-foreground font-normal"> · {evt.resourceType}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {evt.userName ?? evt.userId ?? "System"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {formatTimestamp(evt.timestamp ?? evt.createdAt ?? null)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">System metrics</h2>
            <dl className="space-y-2 text-sm" data-testid="system-metrics">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className={`font-semibold ${statusTone(health?.status).text}`}>
                  {statusTone(health?.status).label}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Uptime</dt>
                <dd className="font-semibold">{formatUptime(health?.uptime)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Services online</dt>
                <dd className="font-semibold">
                  {operationalCount} / {serviceCards.length}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Jump to</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="system-jump-grid">
          <JumpCard
            href="/system?tab=admin"
            icon={Shield}
            label="Admin"
            testId="jump-admin"
          />
          <JumpCard
            href="/system?tab=configuration"
            icon={Settings}
            label="Configuration"
            testId="jump-configuration"
          />
          <JumpCard
            href="/system?tab=notifications"
            icon={Bell}
            label="Notifications"
            testId="jump-notifications"
          />
          <JumpCard
            href="/organization-management"
            icon={Building}
            label="Organizations"
            testId="jump-organizations"
          />
          <JumpCard href="/sensors" icon={Activity} label="Sensors" testId="jump-sensors" />
          <JumpCard
            href="/copilot-admin"
            icon={Bot}
            label="AI Copilot"
            testId="jump-copilot"
          />
          <JumpCard
            href="/admin/3d-models"
            icon={Cpu}
            label="3D Models"
            testId="jump-3d-models"
          />
          <JumpCard
            href="/admin/telemetry-warehouse"
            icon={Database}
            label="Warehouse"
            testId="jump-warehouse"
          />
          <JumpCard
            href="/admin/equipment-dependencies"
            icon={Cloud}
            label="Dependencies"
            testId="jump-dependencies"
          />
        </div>
      </div>
    </div>
  );
}

function JumpCard({
  href,
  icon: Icon,
  label,
  testId,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  testId: string;
}) {
  return (
    <Link href={href}>
      <Card
        className="hover:bg-accent/40 transition-colors cursor-pointer"
        data-testid={testId}
      >
        <CardContent className="flex items-center gap-2 p-3">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium truncate">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
