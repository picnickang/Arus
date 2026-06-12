import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
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
import { cn } from "@/lib/utils";
import { getMobileReadinessAsset } from "./mobile-readiness-assets";
import type { MobileReadinessScreens, QueueItem } from "./mobile-readiness-model";
import {
  AssetImage,
  Content,
  KpiStrip,
  MobilePageShell,
  NavyHeader,
  ProgressBar,
  QueueCard,
  SectionCard,
  StatusPill,
  severityLabel,
  toneClasses,
  useScreens,
} from "./MobileReadinessShared";

function PdmBackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </Link>
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
