import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  MoreVertical,
  RefreshCw,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PdmEquipmentDetail } from "@/features/analytics/components/PdmEquipmentDetail";
import type { PdmRiskCard, PdmScreen } from "./mobile-readiness-model";
import {
  Content,
  KpiStrip,
  MobilePageShell,
  NavyHeader,
  StatusPill,
  toneClasses,
  useScreens,
} from "./MobileReadinessShared";

export function MobilePdmPage() {
  const { pdm } = useScreens("chief_engineer");
  const [location] = useLocation();
  const currentPath = (location.split("?")[0] ?? location).split("#")[0] ?? location;
  const locationSearch =
    location.split("?")[1]?.split("#")[0] ??
    (typeof window === "undefined" ? "" : window.location.search.replace(/^\?/, ""));
  const params = new URLSearchParams(locationSearch);
  const isTelemetryPath = currentPath.endsWith("/telemetry");
  const equipmentId = currentPath.startsWith("/pdm/equipment/")
    ? (currentPath.replace("/pdm/equipment/", "").split("/")[0] ?? null)
    : null;

  if (equipmentId && (isTelemetryPath || params.get("view") === "telemetry")) {
    return <MobilePdmTelemetryPage equipmentId={equipmentId} />;
  }

  if (equipmentId) {
    return <MobilePdmAssetCasePage equipmentId={equipmentId} />;
  }

  return <MobilePdmQueuePage pdm={pdm} />;
}

function PdmHeaderActions() {
  return (
    <>
      <Star className="h-5 w-5" aria-hidden="true" />
      <MoreVertical className="h-5 w-5" aria-hidden="true" />
    </>
  );
}

function PdmBackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="grid h-11 w-11 place-items-center rounded-lg" aria-label="Back">
      <ArrowLeft className="h-6 w-6" aria-hidden="true" />
    </Link>
  );
}

function MobilePdmQueuePage({ pdm }: { pdm: PdmScreen }) {
  return (
    <MobilePageShell>
      <div data-testid="mobile-readiness-screen-pdm-queue">
        <NavyHeader
          title="ARUS"
          subtitle="Telemetry + PdM"
          right={
            <div className="relative">
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span className="absolute -right-1 -top-2 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold">
                3
              </span>
            </div>
          }
        />
        <Content>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-950">PdM Risk Queue</h1>
            <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Filters
            </button>
          </div>
          <KpiStrip metrics={pdm.summary} />
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Sort by: Risk Score</span>
            <span className="inline-flex items-center gap-1">
              Updated: 09:41 <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="space-y-2">
            {pdm.riskQueue.map((risk) => (
              <PdmRiskQueueCard key={risk.equipmentId} risk={risk} />
            ))}
          </div>
        </Content>
      </div>
    </MobilePageShell>
  );
}

function PdmRiskQueueCard({ risk }: { risk: PdmRiskCard }) {
  const tone = toneClasses(risk.tone);
  const Icon = risk.icon;
  const signalParts = risk.signal.match(/^([^(\n]+)(?:\((.+)\))?$/);
  const signalName = signalParts?.[1]?.trim().replace(" rising", "") ?? risk.signal;
  const signalDetail = signalParts?.[2]
    ? `${risk.signal.toLowerCase().includes("rising") ? "Rising" : signalName} (${signalParts[2]})`
    : risk.signal;
  return (
    <Link
      href={`/pdm/equipment/${risk.equipmentId}`}
      className={cn("block rounded-lg border-l-4 bg-white shadow-sm", tone.border)}
      data-testid={`pdm-risk-${risk.equipmentId}`}
    >
      <div className="flex min-h-[56px] items-center gap-2 border-b border-slate-200 px-3 py-1">
        <span
          className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border", tone.bg)}
        >
          <Icon className={cn("h-5 w-5", tone.icon)} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold leading-tight text-slate-950">
            {risk.asset}
          </span>
          <span className="block truncate text-sm text-slate-500">{risk.subtitle}</span>
        </span>
        <span className="grid min-w-[66px] justify-items-center gap-1">
          <StatusPill tone={risk.tone}>{risk.riskState}</StatusPill>
          <span className="text-2xl font-bold leading-none text-slate-950">
            {risk.riskScore ?? "-"}
          </span>
          <span className="text-[10px] font-semibold text-slate-500">Risk Score</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-[1fr_1fr_78px] gap-0 px-3 py-1 text-[11px]">
        <div className="min-w-0 border-r border-slate-200 pr-2">
          <div className="truncate text-slate-500">{signalName}</div>
          <div className={cn("truncate font-semibold", tone.text)}>{signalDetail}</div>
        </div>
        <div className="min-w-0 border-r border-slate-200 px-2">
          <div className="truncate text-red-600">{risk.action}</div>
          <div className="font-semibold text-red-500">Action</div>
        </div>
        <div className="min-w-0 pl-2">
          <div className="truncate text-slate-500">Source</div>
          <div
            className={cn(
              "truncate font-semibold",
              risk.tone === "offline" ? "text-red-600" : "text-emerald-600"
            )}
          >
            {risk.sourceHealth}
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Equipment detail (formerly the static "asset case" board). Now renders the
 * live, tabbed PdM detail. The header keeps the `link-pdm-telemetry-advanced`
 * deep link to the telemetry route (pinned by the link-audit journey).
 */
function MobilePdmAssetCasePage({ equipmentId }: { equipmentId: string }) {
  return (
    <MobilePageShell>
      <div data-testid="mobile-readiness-screen-pdm-asset-case">
        <NavyHeader
          title="Equipment Detail"
          subtitle="Predictive maintenance"
          left={<PdmBackLink href="/pdm-platform" />}
          right={<PdmHeaderActions />}
        />
        <div className="mx-auto w-full max-w-6xl px-4 pt-3">
          <Link
            href={`/pdm/equipment/${equipmentId}/telemetry`}
            data-testid="link-pdm-telemetry-advanced"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand"
          >
            Telemetry Evidence
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <PdmEquipmentDetail equipmentId={equipmentId} defaultTab="overview" />
      </div>
    </MobilePageShell>
  );
}

/**
 * Advanced telemetry view (formerly a static chart board). Renders the same
 * live PdM detail; reached via `?view=telemetry` or the `/telemetry` route.
 */
function MobilePdmTelemetryPage({ equipmentId }: { equipmentId: string }) {
  return (
    <MobilePageShell>
      <div data-testid="mobile-readiness-screen-pdm-telemetry">
        <NavyHeader
          title="Telemetry"
          subtitle="Live sensor history"
          left={<PdmBackLink href={`/pdm/equipment/${equipmentId}`} />}
          right={<PdmHeaderActions />}
        />
        <PdmEquipmentDetail equipmentId={equipmentId} defaultTab="overview" />
      </div>
    </MobilePageShell>
  );
}
