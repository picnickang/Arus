import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowDown,
  ArrowLeft,
  AlertTriangle,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Cog,
  ClipboardList,
  Filter,
  FileText,
  Grid2X2,
  List,
  LogOut,
  Mail,
  MessageSquare,
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
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ROLE_STORAGE_KEY } from "@/config/roles";
import { cn } from "@/lib/utils";
import { getMobileReadinessAsset } from "./mobile-readiness-assets";
import {
  buildMobileReadinessNavigationForVariant,
  buildMobileReadinessScreens,
  normalizeMobileRole,
  type FleetVesselCard,
  type MobileNavVariant,
  type MobileReadinessScreens,
  type PdmRiskCard,
  type PdmScreen,
  type QueueItem,
  type ReadinessTone,
  type SummaryMetric,
} from "./mobile-readiness-model";

type ScreenKind = "today" | "fleet" | "pdm" | "work" | "logs" | "crew" | "inventory" | "settings";

function readRoleHint(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function useScreens(roleOverride?: string): MobileReadinessScreens {
  return buildMobileReadinessScreens(roleOverride ?? readRoleHint());
}

function pickNavVariant(path: string): MobileNavVariant {
  const currentPath = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  if (
    currentPath === "/fleet" ||
    currentPath.startsWith("/fleet/") ||
    currentPath.startsWith("/vessel-intelligence/") ||
    currentPath.startsWith("/vessels/")
  ) {
    return "fleetOps";
  }
  if (
    currentPath === "/maint" ||
    currentPath === "/pdm-platform" ||
    currentPath.startsWith("/pdm/equipment/")
  ) {
    return "machineryOps";
  }
  if (
    currentPath === "/work-orders" ||
    currentPath.startsWith("/work-orders/") ||
    currentPath === "/logs" ||
    currentPath.startsWith("/logs/")
  ) {
    return "technician";
  }
  if (
    currentPath === "/crew-management" ||
    currentPath === "/logistics" ||
    currentPath === "/system"
  ) {
    return "crewOps";
  }
  return "roleToday";
}

function toneClasses(tone: ReadinessTone): {
  text: string;
  bg: string;
  border: string;
  icon: string;
} {
  switch (tone) {
    case "critical":
      return {
        text: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-400",
        icon: "text-red-600",
      };
    case "high":
      return {
        text: "text-orange-700",
        bg: "bg-orange-50",
        border: "border-orange-400",
        icon: "text-orange-600",
      };
    case "medium":
      return {
        text: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-300",
        icon: "text-amber-600",
      };
    case "good":
      return {
        text: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-300",
        icon: "text-emerald-600",
      };
    case "offline":
      return {
        text: "text-slate-600",
        bg: "bg-slate-100",
        border: "border-slate-300",
        icon: "text-slate-500",
      };
    case "info":
      return {
        text: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-300",
        icon: "text-blue-600",
      };
    case "normal":
    default:
      return {
        text: "text-slate-700",
        bg: "bg-slate-100",
        border: "border-slate-300",
        icon: "text-slate-500",
      };
  }
}

function severityLabel(tone: ReadinessTone): string {
  if (tone === "good") {
    return "Normal";
  }
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

function StatusPill({ tone, children }: { tone: ReadinessTone; children?: string }) {
  const toneClass = toneClasses(tone);
  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center rounded-md px-2 text-[11px] font-bold",
        toneClass.bg,
        toneClass.text
      )}
    >
      {children ?? severityLabel(tone)}
    </span>
  );
}

function IconTile({ icon: Icon, tone }: { icon: LucideIcon; tone: ReadinessTone }) {
  const toneClass = toneClasses(tone);
  return (
    <span
      className={cn(
        "grid h-12 w-12 shrink-0 place-items-center rounded-lg border bg-white",
        toneClass.border
      )}
    >
      <Icon className={cn("h-5 w-5", toneClass.icon)} aria-hidden="true" />
    </span>
  );
}

function AppHeader({
  title,
  subtitle,
  vesselName,
  roleLabel,
  right,
}: {
  title: string;
  subtitle?: string;
  vesselName?: string;
  roleLabel?: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[72px] w-full max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg text-[#062a58] md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-[26px] font-extrabold tracking-[0.08em] text-[#082756] md:text-2xl">
              {title}
            </div>
            {subtitle ? <div className="truncate text-sm text-slate-500">{subtitle}</div> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {vesselName || roleLabel ? (
            <div className="text-right">
              {vesselName ? (
                <div className="inline-flex items-center justify-end gap-1 text-sm font-semibold text-slate-900">
                  {vesselName}
                  <ChevronDown className="h-4 w-4 text-slate-700" aria-hidden="true" />
                </div>
              ) : null}
              {roleLabel ? (
                <div className="text-xs font-semibold text-[#0d4da1]">{roleLabel}</div>
              ) : null}
            </div>
          ) : null}
          {right}
        </div>
      </div>
    </header>
  );
}

function NavyHeader({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-[#03295a] text-white shadow-sm">
      <div className="mx-auto flex min-h-[76px] w-full max-w-6xl items-center justify-between gap-3 px-4">
        {left ?? (
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0 text-center">
          <div className="truncate text-xl font-extrabold tracking-normal">{title}</div>
          {subtitle ? <div className="truncate text-xs text-blue-100">{subtitle}</div> : null}
        </div>
        <div className="flex h-11 min-w-11 items-center justify-end gap-2">{right}</div>
      </div>
    </header>
  );
}

function MobilePageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("min-h-screen bg-[#f6f8fb] text-slate-950", className)}
      data-testid="mobile-readiness-shell"
    >
      {children}
    </div>
  );
}

function Content({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-3 md:max-w-4xl", className)}
    >
      {children}
    </div>
  );
}

function KpiStrip({ metrics, compact = false }: { metrics: SummaryMetric[]; compact?: boolean }) {
  return (
    <div
      className={cn(
        "grid gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white",
        compact ? "grid-cols-6" : "grid-cols-4"
      )}
    >
      {metrics.map((metric) => {
        const tone = toneClasses(metric.tone);
        return (
          <div
            key={metric.id}
            className="min-w-0 border-r border-slate-200 px-2 py-1 text-center last:border-r-0"
          >
            <div className={cn("truncate text-lg font-bold", tone.text)}>{metric.value}</div>
            <div className="truncate text-[11px] font-medium text-slate-500">{metric.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function QueueCard({ item, testId }: { item: QueueItem; testId?: string }) {
  return (
    <Link
      href={item.href}
      className="flex min-h-[76px] items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 last:border-b-0"
      data-testid={testId}
    >
      <IconTile icon={item.icon} tone={item.severity} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold leading-tight text-slate-900">
          {item.title}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-600">
          {item.category} - {item.reason}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500">{item.detail}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusPill tone={item.severity} />
        <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
    </Link>
  );
}

function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      {title || action ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
          {title ? (
            <h2 className="text-[13px] font-extrabold uppercase tracking-normal text-slate-800">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function ProgressBar({ value, tone = "good" }: { value: number; tone?: ReadinessTone }) {
  const color =
    tone === "critical" || tone === "high"
      ? "bg-red-500"
      : tone === "medium"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div
        className={cn("h-full rounded-full", color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function VesselThumbnail({ vessel }: { vessel: FleetVesselCard }) {
  const asset = getMobileReadinessAsset(vessel.assetId);
  return (
    <img
      src={asset.src}
      alt={asset.alt}
      className="h-24 w-36 shrink-0 rounded-md border border-slate-200 object-cover"
      data-asset-status={asset.status}
    />
  );
}

function AssetImage({ assetId, className }: { assetId: string; className: string }) {
  const asset = getMobileReadinessAsset(assetId);
  return (
    <img
      src={asset.src}
      alt={asset.alt}
      className={className}
      data-asset-id={asset.id}
      data-asset-status={asset.status}
    />
  );
}

function MobileBottomNav() {
  const roleHint = readRoleHint();
  const [location] = useLocation();
  const currentPath = location.split("?")[0] ?? "/";
  const variant = pickNavVariant(location);
  const nav = buildMobileReadinessNavigationForVariant(variant, roleHint);
  const usesReferenceTabBar = variant === "technician";
  const isActive = (href: string) =>
    href === "/" ? currentPath === "/" : currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t pb-safe shadow-[0_-12px_24px_-18px_rgba(3,41,90,0.35)] md:hidden",
        usesReferenceTabBar
          ? "border-slate-200 bg-white text-slate-600"
          : "border-[#0a376b] bg-[#03295a] text-white"
      )}
      aria-label="Mobile readiness navigation"
      data-testid="mobile-readiness-bottom-nav"
      data-nav-variant={variant}
    >
      <div
        className="mx-auto grid h-16 max-w-md px-2"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold",
                usesReferenceTabBar
                  ? active
                    ? "text-[#03295a]"
                    : "text-slate-500"
                  : active
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-blue-100"
              )}
              data-testid={`mobile-readiness-nav-${item.id}`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileReadinessBottomNav() {
  return <MobileBottomNav />;
}

export function MobileCommandCenterPage({ role }: { role?: string }) {
  const screens = useScreens(role);
  return (
    <MobilePageShell>
      <AppHeader
        title="ARUS"
        subtitle={screens.today.queueLabel}
        vesselName={screens.today.vesselName}
        roleLabel={screens.today.roleLabel}
      />
      <Content className="max-w-md md:max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-950">Today</h1>
            <p className="text-sm text-slate-500">{screens.today.queueLabel}</p>
          </div>
          <span className="text-sm font-semibold text-[#0d4da1]">
            {screens.today.itemCount} items
          </span>
        </div>
        <SectionCard>
          {screens.today.items.map((item) => (
            <QueueCard key={item.id} item={item} testId={`today-card-${item.id}`} />
          ))}
        </SectionCard>
        <button
          type="button"
          className="mx-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          Pull to refresh
        </button>
      </Content>
    </MobilePageShell>
  );
}

export function MobileFleetPage() {
  const { fleet } = useScreens("admin");
  return (
    <MobilePageShell>
      <NavyHeader
        title="ARUS"
        subtitle="Fleet triage"
        right={
          <>
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            <span className="relative">
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span className="absolute -right-1 -top-2 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold">
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
        <div className="grid gap-3 lg:grid-cols-3">
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
                <span className="inline-flex items-center gap-1 font-semibold text-[#0d4da1]">
                  View <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Updated 2 min ago</span>
          <button className="inline-flex items-center gap-1 font-semibold text-[#0d4da1]">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
          </button>
        </div>
      </Content>
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
                  index === 0
                    ? "border-[#0d4da1] text-[#0d4da1]"
                    : "border-transparent text-slate-600"
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
      <Icon className="h-5 w-5 text-[#0d4da1]" aria-hidden="true" />
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
      action={<button className="text-sm font-semibold text-[#0d4da1]">Legend</button>}
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
            <button className="text-xs font-semibold text-[#0d4da1]">View section</button>
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
                  <Wrench className="h-3.5 w-3.5 text-[#0d4da1]" aria-hidden="true" />
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
          ? "border-[#03295a] bg-[#03295a] text-white"
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
              selected && "border-[#0d4da1] text-[#0d4da1]"
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
                segment === "Advanced Graph" && "bg-[#03295a] text-white"
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
                  range === "7d" && "border-[#0d4da1] bg-blue-50 text-[#0d4da1]"
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
            className="flex min-w-0 items-center justify-center gap-1 border-l border-slate-200 px-2 text-xs font-bold text-[#0d4da1]"
          >
            Details <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <SectionCard
          title="Raw Readings (Latest)"
          action={<span className="text-xs font-semibold text-[#0d4da1]">CSV</span>}
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

function MiniState({ label, value, tone }: { label: string; value: string; tone: ReadinessTone }) {
  const toneClass = toneClasses(tone);
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
      <div className="truncate text-[10px] text-slate-500">{label}</div>
      <div className={cn("truncate text-xs font-bold", toneClass.text)}>{value}</div>
    </div>
  );
}

export function MobileWorkOrdersPage() {
  const { work } = useScreens("crew");
  const [location] = useLocation();
  const currentPath = (location.split("?")[0] ?? location).split("#")[0] ?? location;
  const workOrderId = currentPath.startsWith("/work-orders/")
    ? currentPath.replace("/work-orders/", "").split("/")[0]
    : null;

  if (workOrderId) {
    return <MobileWorkExecutionPage />;
  }

  return (
    <MobilePageShell>
      <NavyHeader
        title="ARUS"
        subtitle="Work Queue"
        right={<Filter className="h-5 w-5" aria-hidden="true" />}
      />
      <Content className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-950">Work Queue</h1>
          <button className="inline-flex items-center gap-1 text-sm font-semibold text-[#0d4da1]">
            Filters <Filter className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto border-b border-slate-200">
          {work.filters.map((filter) => (
            <button
              key={filter.id}
              className="shrink-0 border-b-2 border-transparent px-1 pb-1.5 text-sm font-semibold text-slate-600 first:border-[#0d4da1] first:text-[#0d4da1]"
            >
              {filter.label} ({filter.value})
            </button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {work.stageChips.map((chip) => (
            <button
              key={chip.id}
              className={cn(
                "min-h-12 min-w-0 rounded-lg border px-1 py-1 text-center text-[10px] font-semibold leading-tight",
                chip.id === "in-progress"
                  ? "border-[#0d4da1] bg-blue-50 text-[#0d4da1]"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              <span className="block min-h-5 leading-[10px]">{chip.label}</span>
              <span className="block text-lg leading-none">{chip.value}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2 lg:grid-cols-[0.95fr_1.05fr]">
          {work.queue.map((item) => (
            <WorkQueueCard key={item.id} item={item} />
          ))}
        </div>
      </Content>
    </MobilePageShell>
  );
}

function WorkQueueCard({ item }: { item: QueueItem }) {
  const tone = toneClasses(item.severity);
  const Icon = item.icon;
  const [orderCode, status = "Open"] = item.category.split(" - ");
  const stripeClass =
    item.severity === "critical" || item.severity === "high"
      ? "bg-red-500"
      : item.severity === "medium"
        ? "bg-orange-400"
        : "bg-blue-500";
  const queueSeverity =
    item.severity === "normal" ? "LOW" : severityLabel(item.severity).toUpperCase();
  return (
    <Link
      href={item.href}
      className="block rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
      data-testid={`work-card-${item.id}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("w-1 self-stretch rounded-full", stripeClass)} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2 text-[11px] font-bold">
            <StatusPill tone={item.severity}>{queueSeverity}</StatusPill>
            <span className="text-[#0d4da1]">{orderCode}</span>
            <span className="text-slate-500">- {status}</span>
          </div>
          <div className="truncate text-[13px] font-bold leading-tight text-slate-950">
            {item.title}
          </div>
          <div className="truncate text-[11px] font-semibold leading-tight text-slate-600">
            {item.reason}
          </div>
          <div className="truncate text-[11px] leading-tight text-slate-600">{item.detail}</div>
          <div className="mt-2 grid grid-cols-[1.12fr_1fr_20px] items-center gap-1 text-[10px] text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Due: {item.id === "so-4481" ? "Tomorrow 09:00" : "Today 14:00"}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {item.owner}
            </span>
            <span className="inline-flex items-center justify-end gap-1">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {item.id === "sr-1258" ? "2" : item.id === "so-4481" ? "1" : "0"}
            </span>
          </div>
        </div>
        <div className="grid w-[62px] shrink-0 justify-items-end gap-1 text-right">
          <span className={cn("grid h-7 w-7 place-items-center rounded-full", tone.bg)}>
            <Icon className={cn("h-3.5 w-3.5", tone.icon)} aria-hidden="true" />
          </span>
          <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-slate-600">
            {item.action}
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}

function MobileWorkExecutionPage() {
  const { work } = useScreens("crew");
  const execution = work.execution;
  return (
    <MobilePageShell>
      <NavyHeader
        title={execution.orderNumber}
        subtitle="In Progress"
        left={<PdmBackLink href="/work-orders" />}
        right={
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-100">
            <Cloud className="h-4 w-4" aria-hidden="true" />
            {execution.syncState}
          </span>
        }
      />
      <Content className="space-y-2 pb-28 pt-2">
        <SectionCard>
          <div className="flex gap-3 p-2.5">
            <AssetImage
              assetId={execution.assetId}
              className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-950">
                    {execution.vesselName}
                  </div>
                  <div className="truncate text-xs font-medium text-slate-600">{execution.title}</div>
                  <div className="truncate text-[11px] text-slate-500">{execution.description}</div>
                </div>
                <div className="shrink-0 text-right">
                  <StatusPill tone="medium">{execution.priority}</StatusPill>
                  <div className="mt-1 text-[10px] font-medium leading-tight text-slate-500">
                    Due: Tomorrow
                    <br />
                    09:00
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="truncate">{execution.technician}</span>
                <span className="inline-flex items-center gap-1 text-[#0d4da1]">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> 1
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
        <div className="grid grid-cols-4 border-b border-slate-200 bg-white text-center text-xs font-semibold text-slate-600">
          {["Work", "Details", "History", "Linked"].map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "min-h-9 border-b-2 border-transparent",
                index === 0 && "border-[#0d4da1] text-[#0d4da1]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <SectionCard>
          <div className="space-y-1.5 p-2">
            <div>
              <div className="flex items-center justify-between text-[13px] font-semibold">
                <span>Checklist ({execution.checklistProgress})</span>
                <span>{execution.percentComplete}%</span>
              </div>
              <ProgressBar value={execution.percentComplete} />
            </div>
            <div className="divide-y rounded-lg border border-slate-200">
              {execution.checklist.map((step) => (
                <div
                  key={step.label}
                  className="flex min-h-8 items-center gap-2 px-2 py-1 text-[11px] leading-tight"
                >
                  {step.state === "done" ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border border-slate-300" />
                  )}
                  <span className="min-w-0 flex-1">{step.label}</span>
                  {step.telemetry ? (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      {step.telemetry}
                    </span>
                  ) : null}
                  <Camera className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-2.5 py-1.5">
            <h2 className="text-[12px] font-extrabold uppercase tracking-normal text-slate-800">
              Photos
            </h2>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              Required
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 p-2">
            {execution.photoAssetIds.map((assetId) => (
              <AssetImage
                key={assetId}
                assetId={assetId}
                className="h-16 w-full rounded-lg border border-slate-200 object-cover"
              />
            ))}
            <button className="grid h-16 place-items-center rounded-lg border border-slate-200 text-[#0d4da1]">
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span className="text-[11px] font-semibold">Add</span>
            </button>
          </div>
        </section>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-2.5 py-1.5">
            <div className="text-[12px] font-extrabold uppercase tracking-normal text-slate-800">
              Notes
            </div>
            <div className="mt-1 text-xs leading-snug text-slate-700">{execution.notes}</div>
          </div>
          <CompactInfoRow label="Parts Used" value={`${execution.partsUsed} · Qty 1`} />
          <CompactInfoRow label="Time & Labor" value={execution.labor} />
        </section>
        <div className="sticky bottom-16 z-20 grid grid-cols-[0.8fr_1fr_1.1fr] gap-2 bg-[#f6f8fb]/95 py-1.5">
          <button className="min-h-10 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600">
            Actions
          </button>
          <button className="min-h-10 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#0d4da1]">
            {execution.offlineDraftAction}
          </button>
          <button className="min-h-10 rounded-lg bg-[#03295a] text-xs font-semibold text-white">
            {execution.primaryAction}
          </button>
        </div>
      </Content>
    </MobilePageShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="text-right font-bold text-slate-950">{value}</span>
    </div>
  );
}

function CompactInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between border-b border-slate-200 px-2.5 py-1.5 text-xs last:border-b-0">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="text-right font-bold text-slate-950">{value}</span>
    </div>
  );
}

export function MobileLogsPage() {
  const { logs } = useScreens("captain");
  return (
    <MobilePageShell>
      <NavyHeader
        title="Logs"
        right={
          <Link href="/logs" className="inline-flex items-center gap-2 text-xs font-semibold">
            <CalendarIcon /> Daily Required <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />
      <Content className="space-y-2 pb-20 pt-2">
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{logs.requiredBanner}</span>
        </div>
        <div className="grid grid-cols-5 border-b border-slate-200">
          {logs.tabs.map((tab, index) => (
            <button
              key={tab}
              className={cn(
                "min-h-9 min-w-0 border-b-2 px-1 pb-1 text-center text-[11px] font-semibold leading-tight",
                index === 0
                  ? "border-[#0d4da1] text-[#0d4da1]"
                  : "border-transparent text-slate-600"
              )}
            >
              <span className="line-clamp-2">{tab}</span>
            </button>
          ))}
        </div>
        <SectionCard
          title="Engine Log (Autofill Review)"
          action={<button className="text-sm font-semibold text-[#0d4da1]">View All</button>}
        >
          <div className="space-y-2 p-2">
            <div className="text-xs text-slate-600">Review and confirm auto-filled entries.</div>
            <div className="grid grid-cols-[0.8fr_1.25fr_22px] items-center gap-2 rounded-lg border border-slate-200 p-2">
              <div>
                <div className="text-xs text-slate-500">Auto-filled Entries</div>
                <div className="text-3xl font-bold text-slate-950">28</div>
                <div className="text-xs text-slate-500">Last 24 hours</div>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-500">Telemetry Trust</div>
                {logs.autofillTrust.map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          metric.tone === "good"
                            ? "bg-emerald-500"
                            : metric.tone === "medium"
                              ? "bg-amber-500"
                              : "bg-red-500"
                        )}
                      />
                      {metric.label}
                    </span>
                    <span className="font-semibold text-slate-700">{metric.value}</span>
                  </div>
                ))}
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          {logs.requiredCards.slice(1).map((card) => (
            <LogRequiredRow key={card.title} card={card} />
          ))}
        </SectionCard>
        <SectionCard
          title="Compliance History"
          action={<span className="text-xs text-slate-500">Last 7 Days</span>}
        >
          <div className="space-y-2 p-3">
            <KpiStrip metrics={logs.complianceHistory} />
            <div className="divide-y rounded-lg border border-slate-200 bg-white">
              {logs.complianceRows.map((row) => (
                <div
                  key={row.date}
                  className="grid grid-cols-[1fr_0.8fr_1fr_20px] items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-slate-600">{row.date}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {row.status}
                  </span>
                  <span className="truncate text-right text-slate-600">{row.signer}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </div>
              ))}
            </div>
            <button className="text-xs font-semibold text-[#0d4da1]">View More History</button>
          </div>
        </SectionCard>
        <div className="mx-auto flex w-fit items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Fresh
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Delayed
          <span className="h-2 w-2 rounded-full bg-red-500" /> Manual Required
        </div>
      </Content>
    </MobilePageShell>
  );
}

function LogRequiredRow({
  card,
}: {
  card: MobileReadinessScreens["logs"]["requiredCards"][number];
}) {
  return (
    <Link
      href="/logs"
      className="flex min-h-[58px] items-center justify-between border-b border-slate-200 px-3 py-2 last:border-b-0"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-base font-bold leading-tight text-slate-950">
            {card.title}
          </span>
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
            {card.status}
          </span>
        </div>
        <div className="truncate text-sm leading-snug text-slate-500">{card.subtitle}</div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
    </Link>
  );
}

function CalendarIcon() {
  return <CalendarDays className="h-4 w-4" aria-hidden="true" />;
}

export function MobileCrewPage() {
  const { crew } = useScreens("admin");
  return (
    <MobilePageShell>
      <NavyHeader
        title="ARUS"
        subtitle="Crew"
        right={<Plus className="h-5 w-5" aria-hidden="true" />}
      />
      <Content className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-950">{crew.vesselName}</h1>
            <p className="text-sm text-slate-500">IMO 9876543</p>
          </div>
          <StatusPill tone="good">Vessel Ready</StatusPill>
        </div>
        <SectionCard title="Crew Readiness Overview">
          <div className="p-2">
            <KpiStrip metrics={crew.readiness} />
          </div>
        </SectionCard>
        <div className="grid grid-cols-2 gap-2">
          {crew.blockers.map((item) => (
            <CrewBlockerCard key={item.id} item={item} />
          ))}
        </div>
        <SectionCard title="Missing Required Roles">
          <QueueSimple label="Chief Engineer" value="High Priority" tone="critical" />
          <QueueSimple label="2nd Mate" value="Medium Priority" tone="medium" />
        </SectionCard>
        <SectionCard
          title="Current Crew (18)"
          action={<button className="text-sm font-semibold text-[#0d4da1]">View All</button>}
        >
          <div className="grid grid-cols-[32px_1.3fr_0.85fr_0.85fr_0.65fr_42px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500">
            <span />
            <span>Name / Rank</span>
            <span>Status</span>
            <span>Vessel</span>
            <span>Docs</span>
            <span />
          </div>
          {crew.currentCrew.map((person) => (
            <div
              key={person.name}
              className="grid min-h-10 grid-cols-[32px_1.3fr_0.85fr_0.85fr_0.65fr_42px] items-center gap-2 border-b border-slate-200 px-3 py-1"
            >
              <AssetImage
                assetId={person.avatarAssetId}
                className="h-8 w-8 rounded-full border border-slate-200 object-cover"
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-950">{person.name}</div>
                <div className="truncate text-[10px] text-slate-500">{person.rank}</div>
              </div>
              <span className="truncate rounded-md bg-emerald-50 px-1.5 py-1 text-center text-[10px] font-bold text-emerald-700">
                {person.status}
              </span>
              <span className="truncate text-[10px] font-medium text-slate-600">
                {crew.vesselName}
              </span>
              <span className="rounded-md bg-emerald-50 px-1.5 py-1 text-center text-[10px] font-bold text-emerald-700">
                {person.docs}
              </span>
              <span className="flex justify-end gap-1 text-slate-500">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          ))}
          <Link
            href="/crew-management"
            className="flex min-h-8 items-center justify-between px-3 text-xs font-semibold text-[#0d4da1]"
          >
            View All Current Crew
            <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </Link>
        </SectionCard>
        <SectionCard
          title="Former Crew (24)"
          action={<button className="text-sm font-semibold text-[#0d4da1]">History</button>}
        >
          {crew.formerCrew.map((person) => (
            <div
              key={person.name}
              className="grid min-h-10 grid-cols-[32px_1fr_auto_auto] items-center gap-2 border-b border-slate-200 px-3 py-1 last:border-b-0"
            >
              <AssetImage
                assetId={person.avatarAssetId}
                className="h-8 w-8 rounded-full border border-slate-200 object-cover opacity-80"
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-950">{person.name}</div>
                <div className="truncate text-[10px] text-slate-500">{person.rank}</div>
              </div>
              <StatusPill tone="normal">{person.status}</StatusPill>
              <span className="text-[10px] font-medium text-slate-500">{person.date}</span>
            </div>
          ))}
        </SectionCard>
      </Content>
    </MobilePageShell>
  );
}

function CrewBlockerCard({ item }: { item: QueueItem }) {
  const tone = toneClasses(item.severity);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="grid min-h-14 grid-cols-[34px_1fr_16px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm"
    >
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg border", tone.border)}>
        <Icon className={cn("h-4 w-4", tone.icon)} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-slate-950">{item.title}</span>
        <span className="block truncate text-[10px] text-slate-500">{item.reason}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
    </Link>
  );
}

function QueueSimple({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: ReadinessTone;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between border-b border-slate-200 px-3 py-1.5 last:border-b-0">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "critical" ? "bg-red-500" : "bg-amber-500"
          )}
        />
        {label}
      </div>
      <StatusPill tone={tone}>{value}</StatusPill>
    </div>
  );
}

export function MobileInventoryPage() {
  const { inventory } = useScreens("logistics");
  return (
    <MobilePageShell>
      <NavyHeader
        title="ARUS"
        subtitle="Inventory & Logistics"
        right={
          <>
            <Search className="h-5 w-5" aria-hidden="true" />
            <Bell className="h-5 w-5" aria-hidden="true" />
          </>
        }
      />
      <Content className="space-y-1.5 pt-2">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Action Required
          </div>
          <ActionRequiredGrid metrics={inventory.actionRequired} />
        </div>
        <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          <button className="rounded-md bg-[#03295a] py-1.5 text-white">Inventory</button>
          <button className="py-1.5 text-slate-600">Logistics</button>
          <button className="py-1.5 text-slate-600">Vendors</button>
        </div>
        <div className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Search by Part #, Name, or Keyword</span>
          <ScanLine className="h-5 w-5 text-slate-600" aria-hidden="true" />
        </div>
        <SectionCard
          title="Inventory"
          action={
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 rounded-md border border-slate-200 bg-white p-0.5">
                <button
                  className="grid h-7 w-7 place-items-center rounded text-slate-500"
                  aria-label="Card view"
                >
                  <Grid2X2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  className="grid h-7 w-7 place-items-center rounded bg-[#03295a] text-white"
                  aria-label="Table view"
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                <span className="h-2 w-3.5 rounded-full bg-blue-600" />
                Expert
              </span>
            </div>
          }
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-[0.9fr_1.05fr_0.95fr_0.55fr_0.55fr_0.75fr] gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase text-slate-500">
              <span>Part Number</span>
              <span>Name</span>
              <span>Location</span>
              <span className="text-right">On Hand</span>
              <span className="text-right">Avail.</span>
              <span className="text-right">Status</span>
            </div>
            {inventory.rows.map((row) => (
              <div
                key={row.partNumber}
                className="grid min-h-8 grid-cols-[0.9fr_1.05fr_0.95fr_0.55fr_0.55fr_0.75fr] items-center gap-1 border-b border-slate-200 px-2 py-0.5 text-[10px] last:border-b-0"
              >
                <span className="truncate font-mono text-slate-700">{row.partNumber}</span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-slate-950">{row.name}</span>
                  <span className="block truncate text-[9px] text-slate-500">
                    {row.name.split(" ").slice(-1)[0]}
                  </span>
                </span>
                <span className="truncate text-slate-600">{row.location}</span>
                <span className="text-right font-semibold text-slate-900">{row.onHand}</span>
                <span
                  className={cn(
                    "text-right font-semibold",
                    row.tone === "critical" ? "text-red-600" : "text-slate-900"
                  )}
                >
                  {row.available}
                </span>
                <span
                  className={cn(
                    "justify-self-end rounded-md px-1.5 py-1 text-[10px] font-bold",
                    row.tone === "good"
                      ? "bg-emerald-50 text-emerald-700"
                      : row.tone === "critical"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                  )}
                >
                  {row.reorderStatus}
                </span>
              </div>
            ))}
            <Link
              href="/logistics"
              className="flex min-h-8 items-center justify-between px-3 text-xs font-semibold text-[#0d4da1]"
            >
              View Full Inventory
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </Link>
          </div>
        </SectionCard>
        <SectionCard
          title="Linked Work Orders"
          action={<button className="text-sm font-semibold text-[#0d4da1]">View All</button>}
        >
          {inventory.linkedWorkOrders.map((order) => (
            <InventoryLinkedRow
              key={order.id}
              icon={ClipboardList}
              label={order.id}
              detail={order.title}
              value={order.status}
            />
          ))}
        </SectionCard>
        <SectionCard
          title="Logistics Tasks"
          action={<button className="text-sm font-semibold text-[#0d4da1]">View All</button>}
        >
          {inventory.logisticsTasks.map((task) => (
            <InventoryLinkedRow
              key={task.id}
              icon={Truck}
              label={task.id}
              detail={task.title}
              value={task.eta}
            />
          ))}
        </SectionCard>
      </Content>
    </MobilePageShell>
  );
}

function ActionRequiredGrid({ metrics }: { metrics: SummaryMetric[] }) {
  const iconById: Record<string, LucideIcon> = {
    reorder: ScanLine,
    "low-stock": ClipboardList,
    deliveries: Truck,
    linked: Package,
  };
  const sublabelById: Record<string, string> = {
    reorder: "Critical",
    "low-stock": "Near Reorder",
    deliveries: "In Transit",
    linked: "Open",
  };
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {metrics.map((metric) => {
        const tone = toneClasses(metric.tone);
        const Icon = iconById[metric.id] ?? Package;
        return (
          <div
            key={metric.id}
            className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm"
          >
            <Icon className={cn("mb-1 h-4 w-4", tone.icon)} aria-hidden="true" />
            <div className={cn("text-base font-extrabold leading-none", tone.text)}>
              {metric.value}
            </div>
            <div className="mt-1 truncate text-[10px] font-semibold text-slate-600">
              {metric.label}
            </div>
            <div className={cn("truncate text-[9px] font-semibold", tone.text)}>
              {sublabelById[metric.id] ?? "Open"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InventoryLinkedRow({
  icon: Icon,
  label,
  detail,
  value,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <Link
      href="/work-orders"
      className="grid min-h-10 grid-cols-[28px_1fr_auto_16px] items-center gap-2 border-b border-slate-200 px-3 py-1 text-xs last:border-b-0"
    >
      <Icon className="h-5 w-5 text-[#0d4da1]" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate font-bold text-slate-950">{label}</span>
        <span className="block truncate text-[10px] text-slate-500">{detail}</span>
      </span>
      <span className="rounded-md bg-blue-50 px-1.5 py-1 text-[10px] font-bold text-blue-700">
        {value}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
    </Link>
  );
}

export function MobileSettingsPage() {
  const { settings } = useScreens("admin");
  return (
    <MobilePageShell>
      <NavyHeader
        title="ARUS"
        subtitle="Settings"
        right={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
      />
      <Content className="max-w-md space-y-2 pb-20 pt-3 md:max-w-3xl">
        <SectionCard>
          <div className="flex items-center gap-3 p-3">
            <AssetImage
              assetId={settings.profile.avatarAssetId}
              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-950">{settings.profile.name}</div>
              <div className="text-xs text-slate-600">{settings.profile.role}</div>
              <div className="truncate text-xs text-slate-500">{settings.profile.email}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
          </div>
        </SectionCard>
        <SectionCard>
          {settings.items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={
                  item.label.includes("Telemetry")
                    ? "/sensors"
                    : item.label.includes("Copilot")
                      ? "/knowledge-base"
                      : "/system"
                }
                className="flex min-h-11 items-center gap-3 border-b border-slate-200 px-3 py-1.5 last:border-b-0"
              >
                <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-950">
                    {item.label}
                  </span>
                  {item.detail ? (
                    <span className="block truncate text-[10px] text-slate-500">{item.detail}</span>
                  ) : null}
                </span>
                {item.tone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <span className="h-3.5 w-3.5" />
                )}
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            );
          })}
        </SectionCard>
        <button className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-left text-sm font-semibold text-red-600">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Log Out</span>
        </button>
        <div className="space-y-1 text-center text-[10px] text-slate-500">
          <div>ARUS v2.18.0 (Build 321)</div>
          <div>(c) 2025 ARUS Maritime. All rights reserved.</div>
        </div>
      </Content>
    </MobilePageShell>
  );
}

export function MobileReadinessRoute({ screen }: { screen: ScreenKind }) {
  switch (screen) {
    case "fleet":
      return <MobileFleetPage />;
    case "pdm":
      return <MobilePdmPage />;
    case "work":
      return <MobileWorkOrdersPage />;
    case "logs":
      return <MobileLogsPage />;
    case "crew":
      return <MobileCrewPage />;
    case "inventory":
      return <MobileInventoryPage />;
    case "settings":
      return <MobileSettingsPage />;
    case "today":
    default:
      return <MobileCommandCenterPage role={normalizeMobileRole(readRoleHint())} />;
  }
}

export function isMobileReadinessReplacementPath(path: string): boolean {
  const currentPath = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  return (
    currentPath === "/" ||
    currentPath === "/fleet" ||
    currentPath.startsWith("/fleet/") ||
    currentPath === "/vessel-intelligence" ||
    currentPath.startsWith("/vessel-intelligence/") ||
    currentPath === "/maint" ||
    currentPath === "/work-orders" ||
    currentPath.startsWith("/work-orders/") ||
    currentPath === "/pdm-platform" ||
    currentPath.startsWith("/pdm/equipment/") ||
    currentPath === "/logs" ||
    currentPath.startsWith("/logs/") ||
    currentPath === "/crew-management" ||
    currentPath === "/logistics" ||
    currentPath === "/system"
  );
}

export function MobileReadinessCopilotSuppressionMarker() {
  return null;
}
