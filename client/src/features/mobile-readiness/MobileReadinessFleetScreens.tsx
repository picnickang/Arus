import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Cog,
  ClipboardList,
  Filter,
  FileText,
  Grid2X2,
  List,
  LogOut,
  Mail,
  Menu,
  MoreVertical,
  Package,
  Phone,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Share2,
  SlidersHorizontal,
  Star,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMobileReadinessAsset } from "./mobile-readiness-assets";
import type {
  MobileReadinessScreens,
  ReadinessTone,
  SummaryMetric,
} from "./mobile-readiness-model";
import {
  Content,
  KpiStrip,
  MiniState,
  MobilePageShell,
  NavyHeader,
  ProgressBar,
  QueueCard,
  SectionCard,
  VesselThumbnail,
  severityLabel,
  toneClasses,
  useScreens,
} from "./MobileReadinessShared";

export function MobileFleetPage() {
  const { fleet } = useScreens("admin");
  return (
    <MobilePageShell>
      <div data-testid="mobile-readiness-screen-fleet">
        <NavyHeader
          title="ARUS"
          subtitle="Fleet triage"
          right={
            <>
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              <span className="relative">
                <Bell className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1 -top-2 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold">
                  12
                </span>
              </span>
            </>
          }
        />
        <Content>
          <KpiStrip metrics={fleet.summary} />
          <div className="flex items-center gap-2">
            <div className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search vessels...
            </div>
            <span className="text-xs font-semibold text-slate-500">Sort: Risk</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {fleet.vessels.map((vessel) => (
              <Link
                href="/vessel-intelligence/mv-atlas/overview"
                key={vessel.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                data-testid={`fleet-vessel-card-${vessel.id}`}
              >
                <div className="flex gap-3 p-3">
                  <VesselThumbnail vessel={vessel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-slate-950">
                          {vessel.name}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {vessel.operationalState}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500">{vessel.route}</div>
                      </div>
                      <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
                        <div className={cn("text-xl font-bold", toneClasses(vessel.riskTone).text)}>
                          {vessel.pdmRiskScore}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500">PdM risk</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-y border-slate-200 px-2 py-2">
                  <KpiStrip metrics={vessel.kpis} compact />
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3 text-xs">
                  <div>
                    <div className="text-slate-500">Next action</div>
                    <div className="font-semibold text-slate-900">{vessel.nextAction}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 font-semibold text-brand">
                    View <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Updated 2 min ago</span>
            <button className="inline-flex items-center gap-1 font-semibold text-brand">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
            </button>
          </div>
        </Content>
      </div>
    </MobilePageShell>
  );
}

export function MobileVesselDetailPage() {
  const { fleet } = useScreens("admin");
  const [location] = useLocation();
  const detail = fleet.vesselDetail;
  if (location.includes("/3d") || location.includes("diagram")) {
    return <MobileVesselDiagramView screens={useScreens("admin")} />;
  }
  return (
    <MobilePageShell>
      <div data-testid="mobile-readiness-screen-vessel-detail">
        <NavyHeader
          title={detail.name}
          subtitle={detail.subtitle}
          right={
            <>
              <Star className="h-5 w-5" aria-hidden="true" />
              <Share2 className="h-5 w-5" aria-hidden="true" />
            </>
          }
        />
        <Content className="space-y-2 pt-2">
          <div className="grid grid-cols-4 gap-0 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm">
            <VesselMetricTile label="Readiness" value={`${detail.readiness}%`} tone="good" />
            <VesselMetricTile label="Active alarms" value="2" sublabel="Critical" tone="critical" />
            <VesselMetricTile label="PdM risk" value="82" sublabel="High" tone="high" />
            <VesselMetricTile label="Crew blocker" value="1" sublabel="Yes" tone="medium" />
          </div>

          <SectionCard title="Top priorities">
            {detail.topPriorities.map((item) => (
              <QueueCard key={item.id} item={item} />
            ))}
          </SectionCard>

          <div className="grid grid-cols-2 gap-2">
            {detail.tiles.map((tile) => (
              <VesselActionTile key={tile.id} tile={tile} />
            ))}
          </div>
          <div className="flex gap-4 overflow-x-auto border-b border-slate-200 text-sm font-semibold">
            {["Overview", "Machinery", "Work", "Alerts", "Crew", "Inventory", "Documents"].map(
              (tab, index) => (
                <button
                  key={tab}
                  className={cn(
                    "shrink-0 border-b-2 px-1 pb-2",
                    index === 0 ? "border-brand text-brand" : "border-transparent text-slate-600"
                  )}
                >
                  {tab}
                </button>
              )
            )}
          </div>
          <SectionCard title="Vessel Snapshot">
            <div className="grid grid-cols-4 gap-2 p-3 text-xs">
              <MiniState label="Vessel type" value="Container" tone="normal" />
              <MiniState label="Built" value="2015" tone="normal" />
              <MiniState label="GT / DWT" value="32,512" tone="normal" />
              <MiniState label="Flag" value="Singapore" tone="normal" />
            </div>
          </SectionCard>
          <VesselDiagramPanel screens={useScreens("admin")} compact />
        </Content>
      </div>
    </MobilePageShell>
  );
}

function VesselMetricTile({
  label,
  value,
  tone,
  sublabel,
}: {
  label: string;
  value: string;
  tone: ReadinessTone;
  sublabel?: string;
}) {
  const toneClass = toneClasses(tone);
  return (
    <div className="min-w-0 border-r border-slate-200 px-2 text-center last:border-r-0">
      <div className="truncate text-[11px] font-medium text-slate-500">{label}</div>
      <div className={cn("text-xl font-extrabold leading-tight", toneClass.text)}>{value}</div>
      {label === "Readiness" ? (
        <ProgressBar value={Number.parseInt(value, 10)} />
      ) : (
        <div className={cn("truncate text-[11px] font-semibold", toneClass.text)}>
          {sublabel ?? severityLabel(tone)}
        </div>
      )}
    </div>
  );
}

function VesselActionTile({ tile }: { tile: SummaryMetric }) {
  const tone = toneClasses(tile.tone);
  const sublabelById: Record<string, string> = {
    "work-orders": "5 Overdue",
    inventory: "Critical",
    logs: "3 Overdue",
    alerts: "2 Critical",
  };
  const iconById: Record<string, LucideIcon> = {
    "work-orders": ClipboardList,
    inventory: Package,
    logs: FileText,
    alerts: Bell,
  };
  const Icon = iconById[tile.id] ?? ChevronRight;
  return (
    <Link
      href={tile.id === "inventory" ? "/logistics" : tile.id === "logs" ? "/logs" : "/work-orders"}
      className="grid min-h-20 grid-cols-[28px_1fr_18px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
    >
      <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-600">{tile.label}</span>
        <span className="block text-2xl font-extrabold leading-tight text-slate-950">
          {tile.value}
        </span>
        <span className={cn("block truncate text-[11px] font-bold", tone.text)}>
          {sublabelById[tile.id] ?? severityLabel(tile.tone)}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
    </Link>
  );
}

function MobileVesselDiagramView({ screens }: { screens: MobileReadinessScreens }) {
  const detail = screens.fleet.vesselDetail;
  return (
    <MobilePageShell>
      <div data-testid="mobile-readiness-screen-vessel-diagram">
        <NavyHeader
          title={detail.name}
          subtitle={detail.subtitle}
          right={
            <>
              <Star className="h-5 w-5" aria-hidden="true" />
              <Share2 className="h-5 w-5" aria-hidden="true" />
            </>
          }
        />
        <Content>
          <VesselDiagramPanel screens={screens} />
        </Content>
      </div>
    </MobilePageShell>
  );
}

function VesselDiagramPanel({
  screens,
  compact = false,
}: {
  screens: MobileReadinessScreens;
  compact?: boolean;
}) {
  const detail = screens.fleet.vesselDetail;
  const diagram = getMobileReadinessAsset(detail.diagramAssetId);
  return (
    <SectionCard
      title="Vessel diagram"
      action={<button className="text-sm font-semibold text-brand">Legend</button>}
    >
      <div className="grid grid-cols-6 gap-2 px-3 py-3">
        {detail.diagramModes.map((mode, index) => (
          <DiagramModeButton key={mode} mode={mode} active={index === 0} />
        ))}
      </div>
      <div className="flex justify-end gap-2 px-3 pb-2">
        <button className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
          <Package className="h-4 w-4" aria-hidden="true" />
          Zones
        </button>
        <button className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
          <List className="h-4 w-4" aria-hidden="true" />
          Legend
        </button>
      </div>
      <div className="px-3 pb-3">
        <div
          className={cn(
            "relative overflow-hidden rounded-lg bg-white",
            compact ? "h-52" : "h-[278px]"
          )}
        >
          <img
            src={diagram.src}
            alt={diagram.alt}
            className="h-full w-full scale-[1.18] object-contain"
            data-asset-status={diagram.status}
          />
          <MapPin className="absolute left-[33%] top-[34%]" tone="critical" label="!" />
          <MapPin className="absolute left-[25%] top-[45%]" tone="info" label="" />
          <MapPin className="absolute left-[62%] top-[54%]" tone="medium" label="L" />
          <MapPin className="absolute right-[12%] top-[48%]" tone="good" label="" />
          <div className="absolute bottom-[16%] left-[38%] rounded-lg border-4 border-orange-400 bg-orange-100/70 px-8 py-5 text-orange-700 shadow-lg">
            <Cog className="h-9 w-9" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              {detail.selectedZone.name}
            </div>
            <button className="text-xs font-semibold text-brand">View section</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-slate-500">Location</div>
              <div className="font-semibold text-slate-900">{detail.selectedZone.location}</div>
            </div>
            <div>
              <div className="text-slate-500">Related</div>
              <div className="font-semibold text-slate-900">{detail.selectedZone.related}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.selectedZone.actions.map((action) => (
              <span
                key={action}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold"
              >
                {action === "Machinery" ? (
                  <Wrench className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                ) : action === "Alarm" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                ) : action === "Log" ? (
                  <FileText className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                )}
                {action}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function DiagramModeButton({ mode, active }: { mode: string; active: boolean }) {
  const iconByMode: Record<string, LucideIcon> = {
    "Side elevation": Package,
    "Deck plan": Grid2X2,
    "Machinery arrangement": Cog,
    "Fire safety": AlertTriangle,
    "Electrical single-line": SlidersHorizontal,
    Custom: Plus,
  };
  const Icon = iconByMode[mode] ?? Grid2X2;
  return (
    <button
      type="button"
      className={cn(
        "grid min-h-16 min-w-0 place-items-center rounded-lg border px-1.5 py-1 text-center text-[9px] font-semibold leading-tight",
        active
          ? "border-brand-navy bg-brand-navy text-white"
          : "border-slate-200 bg-white text-slate-600"
      )}
    >
      <Icon className="mb-1 h-4 w-4" aria-hidden="true" />
      <span className="line-clamp-2">{mode}</span>
    </button>
  );
}

function MapPin({
  tone,
  label,
  className,
}: {
  tone: ReadinessTone;
  label: string;
  className?: string;
}) {
  const toneClass = toneClasses(tone);
  return (
    <span
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border-2 border-white text-xs font-bold shadow-md",
        toneClass.bg,
        toneClass.text,
        className
      )}
    >
      {label || <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
    </span>
  );
}
