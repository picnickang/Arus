/**
 * UI Align Phase 6 — Crew Management Overview (panel 6).
 *
 * Top counter row (Total Crew / Onboard / On Leave / Certifications
 * Due) + Certifications Expiring Soon list + Crew on Leave list.
 * Deep-link routes (/crew-management, /schedule-planner,
 * /hours-of-rest) continue to work — this hub only adds the
 * overview layer.
 */
import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CalendarCheck,
  Clock,
  Shield,
  PlaneTakeoff,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors `SelectCrew` from `shared/schema/crew.ts` — only the
 * fields this hub reads. The list endpoint can vary slightly across
 * deployments (e.g. `vesselName` is sometimes joined-in client-side
 * by the inventory adapter), so optional fields are typed nullable.
 */
interface CrewMember {
  id: string;
  name?: string | null;
  rank?: string | null;
  active?: boolean | null;
  onDuty?: boolean | null;
  vesselId?: string | null;
  vesselName?: string | null;
}

/**
 * Mirrors the enriched row from
 * `server/domains/crew/interfaces/certification-routes.ts` —
 * `crewMemberName`, `crewMemberRank`, `daysUntilExpiry`,
 * `urgencyLevel`, `expiresAt` are added at the API edge.
 */
interface ExpiringCertification {
  id?: string;
  crewMemberName?: string | null;
  crewMemberRank?: string | null;
  certificateName?: string | null;
  certName?: string | null;
  daysUntilExpiry?: number | null;
  expiresAt?: string | null;
  urgencyLevel?: "critical" | "warning" | "notice" | string | null;
}

interface ExpiringCertResponse {
  certifications?: ExpiringCertification[];
  summary?: {
    total?: number;
    critical?: number;
    warning?: number;
    notice?: number;
  };
}

const URGENCY_TONE = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  notice: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
} as const;

function urgencyTone(level: string | null | undefined): string {
  if (level && level in URGENCY_TONE) {
    return URGENCY_TONE[level as keyof typeof URGENCY_TONE];
  }
  return URGENCY_TONE.notice;
}

function Counter({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: number | string;
  tone: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </div>
        <div className={`text-3xl font-bold mt-1 ${tone}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function crewName(c: CrewMember): string {
  return c.name?.trim() || "Unknown crew member";
}

/**
 * Onboard = crew member whose duty flag is currently true. On leave
 * = active roster member who is off-duty (i.e. on rotation /
 * shore-leave). Inactive (`active === false`) crew are excluded
 * from both totals so the counters reflect the live roster rather
 * than termination-archived rows.
 */
function isOnboard(c: CrewMember): boolean {
  return c.onDuty === true && c.active !== false;
}

function isOnLeave(c: CrewMember): boolean {
  return c.active !== false && c.onDuty !== true;
}

export default function CrewHub() {
  const {
    data: crew = [],
    isLoading: crewLoading,
    error: crewError,
  } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew"],
    staleTime: 60_000,
  });

  const { data: certData, error: certError } = useQuery<ExpiringCertResponse>({
    queryKey: ["/api/crew-certifications/expiring"],
    staleTime: 120_000,
  });

  const counts = useMemo(() => {
    let total = 0;
    let onboard = 0;
    let onLeave = 0;
    for (const c of crew) {
      if (c.active === false) {
        continue;
      }
      total += 1;
      if (isOnboard(c)) {
        onboard += 1;
      } else if (isOnLeave(c)) {
        onLeave += 1;
      }
    }
    return { total, onboard, onLeave };
  }, [crew]);

  const certifications = certData?.certifications ?? [];
  const certsDue = certData?.summary?.total ?? certifications.length;
  const onLeaveList = useMemo(
    () => crew.filter((c) => isOnLeave(c)).slice(0, 8),
    [crew],
  );

  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="crew-hub-overview">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Crew Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Roster, certifications, and STCW/MLC compliance at a glance.
          </p>
        </div>
        <Link href="/crew-management">
          <Button data-testid="button-open-roster" variant="outline" className="gap-2">
            Open roster <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {(crewError || certError) && (
        <div
          className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm"
          data-testid="crew-hub-error"
        >
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <span>Some crew data could not be loaded. Values shown may be incomplete.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="crew-counter-row">
        {crewLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <Counter
              label="Total Crew"
              value={counts.total}
              tone="text-foreground"
              testId="counter-total-crew"
            />
            <Counter
              label="Onboard"
              value={counts.onboard}
              tone="text-emerald-600"
              testId="counter-onboard"
            />
            <Counter
              label="On Leave"
              value={counts.onLeave}
              tone="text-amber-600"
              testId="counter-on-leave"
            />
            <Counter
              label="Certifications Due"
              value={certsDue}
              tone={certsDue > 0 ? "text-rose-600" : "text-emerald-600"}
              testId="counter-certs-due"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-rose-500" />
                Certifications expiring soon
              </h2>
              <Link href="/certificates">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  data-testid="button-view-all-certifications"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            {certifications.length === 0 ? (
              <div
                className="p-6 text-sm text-muted-foreground"
                data-testid="empty-expiring-certifications"
              >
                No certifications expiring in the next window.
              </div>
            ) : (
              <ul className="divide-y" data-testid="list-expiring-certifications">
                {certifications.slice(0, 8).map((cert, i) => {
                  const tone = urgencyTone(cert.urgencyLevel);
                  const days = cert.daysUntilExpiry;
                  const daysLabel =
                    typeof days === "number"
                      ? days < 0
                        ? `Expired ${Math.abs(days)}d ago`
                        : `${days}d left`
                      : "—";
                  return (
                    <li
                      key={cert.id ?? `${cert.crewMemberName ?? "row"}-${i}`}
                      className="flex items-center gap-3 px-4 py-2"
                      data-testid={`row-cert-${i}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {cert.crewMemberName ?? "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {cert.crewMemberRank ?? ""}
                          {cert.crewMemberRank && (cert.certificateName || cert.certName)
                            ? " · "
                            : ""}
                          {cert.certificateName ?? cert.certName ?? ""}
                        </div>
                      </div>
                      <Badge variant="outline" className={tone}>
                        {daysLabel}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <PlaneTakeoff className="h-4 w-4 text-amber-500" />
                Crew on leave
              </h2>
              <Link href="/crew-management">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  data-testid="button-view-all-on-leave"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            {onLeaveList.length === 0 ? (
              <div
                className="p-6 text-sm text-muted-foreground"
                data-testid="empty-crew-on-leave"
              >
                Everyone currently scheduled is onboard.
              </div>
            ) : (
              <ul className="divide-y" data-testid="list-crew-on-leave">
                {onLeaveList.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 px-4 py-2"
                    data-testid={`row-on-leave-${c.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{crewName(c)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.rank ?? ""}
                        {c.rank && c.vesselName ? " · " : ""}
                        {c.vesselName ?? ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Jump to</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="crew-jump-grid">
          <JumpCard href="/crew-management" icon={Users} label="Roster" testId="jump-roster" />
          <JumpCard
            href="/crew-scheduler"
            icon={CalendarCheck}
            label="Scheduling"
            testId="jump-scheduling"
          />
          <JumpCard
            href="/hours-of-rest"
            icon={Clock}
            label="Hours of Rest"
            testId="jump-hours-of-rest"
          />
          <JumpCard
            href="/compliance-consolidated"
            icon={Shield}
            label="Compliance"
            testId="jump-compliance"
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
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
