import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, ChevronRight, Menu, type LucideIcon } from "lucide-react";
import { ROLE_STORAGE_KEY } from "@/config/roles";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getMobileReadinessAsset } from "./mobile-readiness-assets";
import { MobileBottomNav } from "./mobile-readiness-bottom-nav";
import {
  buildMobileReadinessNavigationForVariant,
  buildMobileReadinessScreens,
  type FleetVesselCard,
  type MobileNavVariant,
  type MobileReadinessScreens,
  type QueueItem,
  type ReadinessTone,
  type SummaryMetric,
} from "./mobile-readiness-model";

export function readRoleHint(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useScreens(roleOverride?: string): MobileReadinessScreens {
  return buildMobileReadinessScreens(roleOverride ?? readRoleHint());
}

export function pickNavVariant(path: string): MobileNavVariant {
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

export function toneClasses(tone: ReadinessTone): {
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

export function severityLabel(tone: ReadinessTone): string {
  if (tone === "good") {
    return "Normal";
  }
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

export function StatusPill({ tone, children }: { tone: ReadinessTone; children?: string }) {
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

export function IconTile({ icon: Icon, tone }: { icon: LucideIcon; tone: ReadinessTone }) {
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

/**
 * Header navigation drawer. The mobile headers previously rendered a "menu"
 * button with no handler (a dead control); this gives it its labelled action —
 * a slide-in nav listing the role's destinations (same model as the bottom
 * nav), which is also the only nav on desktop where the bottom bar is hidden.
 */
function MobileNavDrawer({ tone = "navy" }: { tone?: "navy" | "light" }) {
  const [location] = useLocation();
  const roleHint = readRoleHint();
  const nav = buildMobileReadinessNavigationForVariant(pickNavVariant(location), roleHint);
  const currentPath = location.split("?")[0] ?? "/";
  const isActive = (href: string) =>
    href === "/" ? currentPath === "/" : currentPath === href || currentPath.startsWith(`${href}/`);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-lg",
            tone === "navy" ? "text-white" : "text-brand-navy-850"
          )}
          aria-label="Open navigation"
          data-testid="mobile-readiness-menu-trigger"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[80vw] max-w-xs p-0"
        data-testid="mobile-readiness-nav-drawer"
      >
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle>Navigate</SheetTitle>
        </SheetHeader>
        <nav className="space-y-1 p-3" aria-label="Mobile navigation">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <SheetClose asChild key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                    active ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent/10"
                  )}
                  data-testid={`mobile-readiness-drawer-${item.id}`}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function AppHeader({
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
          <MobileNavDrawer tone="light" />
          <div className="min-w-0">
            <div className="truncate text-[26px] font-extrabold tracking-[0.08em] text-brand-navy-800 md:text-2xl">
              {title}
            </div>
            {subtitle ? <div className="truncate text-sm text-slate-500">{subtitle}</div> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {vesselName || roleLabel ? (
            <div className="text-right">
              {vesselName ? (
                <div className="inline-flex items-center justify-end gap-1 text-sm font-semibold text-slate-900">
                  {vesselName}
                  <ChevronDown className="h-4 w-4 text-slate-700" aria-hidden="true" />
                </div>
              ) : null}
              {roleLabel ? (
                <div className="text-xs font-semibold text-brand">{roleLabel}</div>
              ) : null}
            </div>
          ) : null}
          {right}
        </div>
      </div>
    </header>
  );
}

export function NavyHeader({
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
    <header className="sticky top-0 z-20 bg-brand-navy text-white shadow-sm">
      <div className="mx-auto flex min-h-[76px] w-full max-w-6xl items-center justify-between gap-3 px-4">
        {left ?? <MobileNavDrawer tone="navy" />}
        <div className="min-w-0 text-center">
          <div className="truncate text-xl font-extrabold tracking-normal">{title}</div>
          {subtitle ? <div className="truncate text-xs text-blue-100">{subtitle}</div> : null}
        </div>
        <div className="flex h-11 min-w-11 items-center justify-end gap-2">
          <ThemeToggle />
          {right}
        </div>
      </div>
    </header>
  );
}

export function MobilePageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("min-h-screen bg-brand-mist text-slate-950", className)}
      data-testid="mobile-readiness-shell"
    >
      {children}
    </div>
  );
}

export function Content({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-3 md:max-w-4xl", className)}
    >
      {children}
    </div>
  );
}

export function KpiStrip({
  metrics,
  compact = false,
}: {
  metrics: SummaryMetric[];
  compact?: boolean;
}) {
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

export function QueueCard({ item, testId }: { item: QueueItem; testId?: string }) {
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

export function SectionCard({
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

export function ProgressBar({ value, tone = "good" }: { value: number; tone?: ReadinessTone }) {
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

export function VesselThumbnail({ vessel }: { vessel: FleetVesselCard }) {
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

export function AssetImage({ assetId, className }: { assetId: string; className: string }) {
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

export function MobileReadinessBottomNav() {
  return <MobileBottomNav />;
}
export function MiniState({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: ReadinessTone;
}) {
  const toneClass = toneClasses(tone);
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
      <div className="truncate text-[10px] text-slate-500">{label}</div>
      <div className={cn("truncate text-xs font-bold", toneClass.text)}>{value}</div>
    </div>
  );
}
