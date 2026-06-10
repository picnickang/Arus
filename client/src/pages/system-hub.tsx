/**
 * UI Align Phase 6 — System Administration Overview (panel 8).
 *
 * Service health row + Recent Audit Logs + System Metrics. Deep-link
 * routes (/system-administration, /configuration, /admin/tenants,
 * /diagnostics, etc.) continue to work — this hub only adds the
 * overview layer.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Database,
  Cloud,
  CloudRain,
  Cpu,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Settings,
  Shield,
  Building,
  Bell,
  Bot,
  ShieldQuestion,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type HealthResponse,
  statusTone,
  flattenServiceCards,
  isOperational,
  formatUptime,
  formatTimestamp,
} from "./system-hub-format";

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
        <Link href="/system-administration">
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
              <Link href="/system-administration">
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

      <div className="space-y-4" data-testid="system-jump-grid">
        <h2 className="text-sm font-semibold text-muted-foreground">Jump to</h2>
        <SystemGroup id="users-access" label="Users & Access" defaultOpen>
          <JumpCard
            href="/system-administration"
            icon={Shield}
            label="Admin"
            testId="jump-admin"
          />
          <JumpCard
            href="/organization-management"
            icon={Building}
            label="Organizations"
            testId="jump-organizations"
          />
        </SystemGroup>
        <SystemGroup id="configuration" label="Configuration">
          <JumpCard
            href="/configuration"
            icon={Settings}
            label="Configuration"
            testId="jump-configuration"
          />
          <JumpCard
            href="/notifications"
            icon={Bell}
            label="Notifications"
            testId="jump-notifications"
          />
        </SystemGroup>
        <SystemGroup id="integrations" label="Integrations">
          <JumpCard href="/sensors" icon={Activity} label="Sensors" testId="jump-sensors" />
          <JumpCard
            href="/stormgeo-settings"
            icon={CloudRain}
            label="StormGeo"
            testId="jump-stormgeo"
          />
          <JumpCard
            href="/admin/equipment-dependencies"
            icon={Cloud}
            label="Dependencies"
            testId="jump-dependencies"
          />
        </SystemGroup>
        <SystemGroup id="advanced" label="Advanced">
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
          {/* Dev/staging-only diagnostic — the backend endpoint is 404 in
              production, so don't surface a dead link there. */}
          {!import.meta.env.PROD && (
            <JumpCard
              href="/admin/access-diagnostic"
              icon={ShieldQuestion}
              label="Access Diagnostic"
              testId="jump-access-diagnostic"
            />
          )}
        </SystemGroup>
      </div>
    </div>
  );
}

/**
 * Render-layer grouping only — navigation config stays flat. On desktop
 * every group is an always-expanded titled section; on mobile each group
 * collapses (local state only: hub routes must never carry query params).
 */
function SystemGroup({
  id,
  label,
  defaultOpen = false,
  children,
}: {
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);
  if (!isMobile) {
    return (
      <div data-testid={`system-group-${id}`}>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">{label}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
      </div>
    );
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={`system-group-${id}`}>
      <CollapsibleTrigger
        className="flex w-full items-center gap-2 py-1.5"
        data-testid={`system-group-toggle-${id}`}
      >
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 gap-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
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
