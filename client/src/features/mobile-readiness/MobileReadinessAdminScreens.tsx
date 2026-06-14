import { Link } from "wouter";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Grid2X2,
  List,
  LogOut,
  Mail,
  MoreVertical,
  Package,
  Phone,
  Plus,
  ScanLine,
  Search,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueueItem, ReadinessTone, SummaryMetric } from "./mobile-readiness-model";
import {
  AssetImage,
  Content,
  KpiStrip,
  MobilePageShell,
  NavyHeader,
  SectionCard,
  StatusPill,
  toneClasses,
  useScreens,
} from "./MobileReadinessShared";

export function MobileCrewPage() {
  const { crew } = useScreens("admin");
  return (
    <MobilePageShell>
      <div data-testid="mobile-readiness-screen-crew">
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
            action={<button className="text-sm font-semibold text-brand">View All</button>}
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
              className="flex min-h-8 items-center justify-between px-3 text-xs font-semibold text-brand"
            >
              View All Current Crew
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </Link>
          </SectionCard>
          <SectionCard
            title="Former Crew (24)"
            action={<button className="text-sm font-semibold text-brand">History</button>}
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
      </div>
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
      <div data-testid="mobile-readiness-screen-inventory">
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
            <button className="rounded-md bg-brand-navy py-1.5 text-white">Inventory</button>
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
                    className="grid h-7 w-7 place-items-center rounded bg-brand-navy text-white"
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
                className="flex min-h-8 items-center justify-between px-3 text-xs font-semibold text-brand"
              >
                View Full Inventory
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            </div>
          </SectionCard>
          <SectionCard
            title="Linked Work Orders"
            action={<button className="text-sm font-semibold text-brand">View All</button>}
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
            action={<button className="text-sm font-semibold text-brand">View All</button>}
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
      </div>
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
      <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
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
      <div data-testid="mobile-readiness-screen-settings">
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
                      <span className="block truncate text-[10px] text-slate-500">
                        {item.detail}
                      </span>
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
      </div>
    </MobilePageShell>
  );
}
