import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  List,
  MoreVertical,
  Package,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMobileReadinessAsset } from "./mobile-readiness-assets";
import type { PdmRiskCard, PdmScreen } from "./mobile-readiness-model";
import {
  Content,
  KpiStrip,
  MiniState,
  MobilePageShell,
  NavyHeader,
  SectionCard,
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
    ? currentPath.replace("/pdm/equipment/", "").split("/")[0]
    : null;
  const selectedRisk =
    pdm.riskQueue.find((risk) => risk.equipmentId === equipmentId) ?? pdm.riskQueue[0];

  if (!selectedRisk) {
    return <MobilePdmQueuePage pdm={pdm} />;
  }

  if (equipmentId && (isTelemetryPath || params.get("view") === "telemetry")) {
    return <MobilePdmTelemetryPage pdm={pdm} selectedRisk={selectedRisk} />;
  }

  if (equipmentId) {
    return <MobilePdmAssetCasePage pdm={pdm} selectedRisk={selectedRisk} />;
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

function PdmTabs({ active }: { active: "summary" | "telemetry" }) {
  const tabs =
    active === "telemetry"
      ? ["Summary", "Health", "Trend", "Telemetry", "Events"]
      : ["Summary", "Health", "Trend", "Maintenance", "Info"];
  return (
    <div className="grid grid-cols-5 border-b border-slate-200 bg-white text-center text-xs font-semibold text-slate-600">
      {tabs.map((tab) => {
        const selected =
          (active === "summary" && tab === "Summary") ||
          (active === "telemetry" && tab === "Telemetry");
        return (
          <button
            key={tab}
            type="button"
            className={cn(
              "min-h-10 border-b-2 border-transparent px-1",
              selected && "border-primary text-primary"
            )}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

function MobilePdmQueuePage({ pdm }: { pdm: PdmScreen }) {
  return (
    <MobilePageShell>
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

function MobilePdmAssetCasePage({
  pdm,
  selectedRisk,
}: {
  pdm: PdmScreen;
  selectedRisk: PdmRiskCard;
}) {
  const telemetryChart = getMobileReadinessAsset(pdm.telemetryAdvanced.chartAssetId);
  return (
    <MobilePageShell>
      <NavyHeader
        title={selectedRisk.asset}
        subtitle={selectedRisk.subtitle}
        left={<PdmBackLink href="/pdm-platform" />}
        right={<PdmHeaderActions />}
      />
      <PdmTabs active="summary" />
      <Content>
        <SectionCard>
          <div className="grid grid-cols-[0.9fr_1.3fr] divide-x divide-slate-200">
            <div className="bg-red-50 px-3 py-4 text-center">
              <div className="text-xs font-bold uppercase text-red-600">High Risk</div>
              <div className="text-5xl font-extrabold leading-none text-slate-950">
                {selectedRisk.riskScore ?? pdm.assetCase.riskScore}
              </div>
              <div className="mt-1 text-xs font-semibold text-red-600">Up 18 vs yesterday</div>
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500">Risk Trend (7d)</div>
              <img
                src={telemetryChart.src}
                alt={telemetryChart.alt}
                className="mt-2 h-24 w-full rounded-lg object-cover"
                data-asset-status={telemetryChart.status}
              />
            </div>
          </div>
        </SectionCard>
        <div className="grid grid-cols-4 gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-center text-xs">
          <MiniState label="Status" value={pdm.assetCase.status} tone="good" />
          <MiniState label="Trend" value={pdm.assetCase.trend} tone="critical" />
          <MiniState label="Source Health" value={pdm.assetCase.sourceHealth} tone="good" />
          <MiniState label="Data" value={pdm.assetCase.dataFreshness} tone="good" />
        </div>
        <SectionCard>
          <div className="divide-y divide-slate-200">
            {pdm.assetCase.evidenceSections.map((section, index) => (
              <PdmEvidenceRow key={section.title} section={section} index={index} />
            ))}
          </div>
        </SectionCard>
        <SectionCard>
          <Link
            href={`/pdm/equipment/${selectedRisk.equipmentId}/telemetry`}
            className="flex min-h-20 items-center justify-between gap-3 px-3 py-3"
            data-testid="link-pdm-telemetry-advanced"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-900">Telemetry Evidence</span>
              <span className="mt-1 block text-xs text-slate-500">
                Last update {pdm.telemetryAdvanced.lastUpdate} - confidence{" "}
                {pdm.telemetryAdvanced.confidence}%
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <StatusPill tone="good">{pdm.telemetryAdvanced.trust}</StatusPill>
              <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </span>
          </Link>
        </SectionCard>
      </Content>
    </MobilePageShell>
  );
}

function PdmEvidenceRow({
  section,
  index,
}: {
  section: PdmScreen["assetCase"]["evidenceSections"][number];
  index: number;
}) {
  const icons: LucideIcon[] = [AlertTriangle, List, Wrench, ClipboardList, Package, Users, Camera];
  const Icon = icons[index] ?? FileText;
  const compact = index >= 3;
  return (
    <div className={cn("flex gap-3 px-3", compact ? "py-1.5" : "py-2")}>
      <Icon
        className={cn("mt-0.5 h-5 w-5 shrink-0", index === 0 ? "text-amber-500" : "text-slate-600")}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-900">{section.title}</div>
        <div
          className={cn(
            "mt-0.5 text-xs leading-tight text-slate-600",
            compact ? "truncate" : "line-clamp-3"
          )}
        >
          {section.body}
        </div>
      </div>
      {index >= 3 ? (
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function MobilePdmTelemetryPage({
  pdm,
  selectedRisk,
}: {
  pdm: PdmScreen;
  selectedRisk: PdmRiskCard;
}) {
  const telemetryChart = getMobileReadinessAsset(pdm.telemetryAdvanced.chartAssetId);
  return (
    <MobilePageShell>
      <NavyHeader
        title={selectedRisk.asset}
        subtitle={selectedRisk.subtitle}
        left={<PdmBackLink href={`/pdm/equipment/${selectedRisk.equipmentId}`} />}
        right={<PdmHeaderActions />}
      />
      <PdmTabs active="telemetry" />
      <Content>
        <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600">
          {["Overview", "Advanced Graph", "Raw Data", "Sensors"].map((segment) => (
            <button
              key={segment}
              type="button"
              className={cn(
                "min-h-10 border-r border-slate-200 px-1 last:border-r-0",
                segment === "Advanced Graph" && "bg-primary text-white"
              )}
            >
              {segment}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {["1d", "7d", "30d", "Custom"].map((range) => (
              <button
                key={range}
                type="button"
                className={cn(
                  "min-h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600",
                  range === "7d" && "border-primary bg-blue-50 text-primary"
                )}
              >
                {range}
              </button>
            ))}
          </div>
          <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Compare
          </button>
        </div>
        <SectionCard>
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
              <span className="text-blue-700">Vibration DE (RMS) mm/s</span>
              <span className="text-red-600">Temp DE C</span>
              <span className="text-sky-600">Vibration NDE (RMS) mm/s</span>
              <span className="text-emerald-600">Pressure Oil bar</span>
            </div>
            <img
              src={telemetryChart.src}
              alt={telemetryChart.alt}
              className="h-48 w-full rounded-lg border border-slate-200 object-cover"
              data-asset-status={telemetryChart.status}
            />
          </div>
        </SectionCard>
        <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
          <MiniState label="Last Update" value={pdm.telemetryAdvanced.lastUpdate} tone="info" />
          <MiniState label="Source Health" value={pdm.telemetryAdvanced.trust} tone="good" />
          <MiniState
            label="Confidence"
            value={`High ${pdm.telemetryAdvanced.confidence}%`}
            tone="good"
          />
          <Link
            href={`/pdm/equipment/${selectedRisk.equipmentId}`}
            className="flex min-w-0 items-center justify-center gap-1 border-l border-slate-200 px-2 text-xs font-bold text-primary"
          >
            Details <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <SectionCard
          title="Raw Readings (Latest)"
          action={<span className="text-xs font-semibold text-primary">CSV</span>}
        >
          <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr] border-b border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
            <span>Time (UTC)</span>
            <span>Vib DE</span>
            <span>Vib NDE</span>
            <span>Temp DE</span>
            <span>Oil Press</span>
          </div>
          {[
            ["19 May 09:39", "7.8", "4.2", "86.4", "4.3"],
            ["19 May 09:38", "7.6", "4.1", "86.1", "4.3"],
            ["19 May 09:37", "7.4", "4.0", "85.9", "4.3"],
            ["19 May 09:36", "7.2", "3.9", "85.7", "4.2"],
          ].map((row) => (
            <div
              key={row[0]}
              className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr] border-b border-slate-100 px-3 py-2 text-[11px] text-slate-600 last:border-b-0"
            >
              {row.map((cell) => (
                <span key={cell} className="truncate">
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </SectionCard>
        <SectionCard>
          <div className="flex min-h-14 items-center justify-between px-3">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              Sensor Health ({pdm.telemetryAdvanced.sensorHealthCount})
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
          </div>
        </SectionCard>
      </Content>
    </MobilePageShell>
  );
}
