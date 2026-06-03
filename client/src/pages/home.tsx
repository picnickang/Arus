import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { isVesselRole } from "@/lib/briefing-redirect";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/navigation/PageHeader";
import { NavigationCard } from "@/components/navigation/NavigationCard";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingApprovalsBanner } from "@/components/shared/PendingApprovalsBanner";
import { QuickWorkOrderSheet } from "@/components/work-orders/QuickWorkOrderSheet";
import { MyAssignmentsPanel } from "@/components/work-orders/MyAssignmentsPanel";
import { navigationCategories, type NavigationCategory } from "@/config/navigationConfig";
import { trackPageVisit, getLastVisitTime, recordVisitTime } from "@/lib/pageTracking";
import {
  Flag,
  CheckCircle2,
  Bell,
  Ship,
  ShieldAlert,
  ShieldCheck,
  UserCircle,
  AlertTriangle,
  ClipboardList,
  Menu,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { ROLES, ROLE_STORAGE_KEY } from "@/config/roles";
import type { RoleConfig } from "@/config/roles";
import {
  getAdminPrimaryCategories,
  getPrimaryCategoriesForRole,
  isAdminPortalAccess,
  resolveEffectiveRole,
} from "@/application/navigation/role-navigation-policy";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { OpsSidebar, type OpsSidebarItem } from "@/components/ops/OpsSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SwitchPortalButton } from "@/components/navigation/SwitchPortalButton";
import { LogoutButton } from "@/components/navigation/LogoutButton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useUserDashboardViewModel,
  type MyTaskSlot,
} from "@/application/user-dashboard/user-dashboard-view-model";
import { listSessionFeedback } from "@/application/feedback/feedback-submission";
import { EmergencyAlarmBanner } from "@/components/safety/EmergencyAlarmBanner";
import {
  safeMinimalDashboardConfig,
  type RoleDashboardConfig,
  type WidgetKey,
} from "@shared/role-dashboard";
import { formatDistanceToNow } from "date-fns";

export { trackPageVisit };
export type { RoleConfig };

const STORAGE_KEY = ROLE_STORAGE_KEY;

function RoleSelector({ onSelect }: { onSelect: (roleId: string) => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-welcome-title">
          Welcome to ARUS
        </h1>
        <p className="text-muted-foreground">
          Choose your role to customize your home screen. You can change this anytime in Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        {Object.values(ROLES).map((role) => {
          const Icon = role.icon;
          return (
            <button
              key={role.id}
              onClick={() => onSelect(role.id)}
              data-testid={`button-role-${role.id}`}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border
                         bg-card hover:border-primary hover:bg-primary/5 transition-all
                         text-left cursor-pointer touch-target"
            >
              <Icon className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-sm">{role.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{role.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect("default")}
        data-testid="button-skip-role"
        className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip — show all categories
      </button>
    </div>
  );
}

function useAttentionItems() {
  const lastVisit = getLastVisitTime();

  const { data: summary } = useQuery<{
    overdueWorkOrders: number;
    unacknowledgedAlerts: number;
    highRiskEquipment: number;
    newSinceLastVisit?: {
      newAlerts: number;
      newWorkOrders: number;
      completedWorkOrders: number;
    };
  }>({
    queryKey: ["/api/home/attention-summary", lastVisit ? { since: lastVisit } : {}],
    refetchInterval: 60000,
  });

  const attentionItems = useMemo(() => {
    if (!summary) {
      return [];
    }
    const items: Array<{ label: string; count: number; severity: string; href: string }> = [];

    if (summary.overdueWorkOrders > 0) {
      items.push({
        label: "Overdue work orders",
        count: summary.overdueWorkOrders,
        severity: "critical",
        href: "/work-orders?status=overdue",
      });
    }
    if (summary.unacknowledgedAlerts > 0) {
      items.push({
        label: "Unacknowledged alerts",
        count: summary.unacknowledgedAlerts,
        severity: "warning",
        href: "/attention-inbox",
      });
    }
    if (summary.highRiskEquipment > 0) {
      items.push({
        label: "High-risk equipment",
        count: summary.highRiskEquipment,
        severity: "warning",
        href: "/equipment-intelligence",
      });
    }

    return items;
  }, [summary]);

  return { attentionItems, sinceLastVisit: summary?.newSinceLastVisit };
}

function OverviewTile({
  icon: Icon,
  label,
  value,
  tone,
  loading,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: string;
  loading: boolean;
  testId: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] p-3 text-center"
      data-testid={testId}
    >
      <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-5 w-5" />
      </span>
      {loading ? (
        <Skeleton className="h-6 w-8" />
      ) : (
        <span
          className="text-xl font-bold leading-none tabular-nums text-foreground"
          data-testid={`${testId}-value`}
        >
          {value}
        </span>
      )}
      <span className="text-[11px] font-medium leading-tight text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function AssignedTaskRow({
  task,
  onOpen,
}: {
  task: MyTaskSlot;
  onOpen: (id: string) => void;
}) {
  const overdue = task.dayPill === "overdue";
  const dueLabel =
    task.dayPill === "overdue"
      ? "Overdue"
      : task.dayPill === "today"
        ? "Due today"
        : task.dayPill === "tomorrow"
          ? "Due tomorrow"
          : "No due date";
  const dotTone = overdue
    ? "bg-rose-400"
    : task.dayPill === "today"
      ? "bg-amber-400"
      : "bg-sky-400";
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      data-testid={`row-assigned-task-${task.id}`}
      className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotTone)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{task.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{dueLabel}</span>
          {task.equipmentName && (
            <>
              <span className="opacity-50">•</span>
              <span className="truncate">{task.equipmentName}</span>
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
          overdue ? "bg-rose-500/15 text-rose-400" : "bg-sky-500/15 text-sky-400",
        )}
      >
        {overdue ? "Overdue" : "Open"}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function AlertNoticeRow({
  icon: Icon,
  tone,
  title,
  meta,
  when,
  onOpen,
  testId,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  meta?: string | null;
  when: string | null;
  onOpen: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testId}
      className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        {(meta || when) && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {meta && <span className="truncate">{meta}</span>}
            {meta && when && <span className="opacity-50">•</span>}
            {when && <span className="shrink-0">{when}</span>}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function relativeTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return null;
  }
}

function greetingForNow(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function UserPortalHome({
  role,
  roleLabel,
  onSwitchRole,
}: {
  role: string;
  roleLabel: string | undefined;
  onSwitchRole: () => void;
}) {
  const [location, setLocation] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { attentionItems } = useAttentionItems();
  const vm = useUserDashboardViewModel();

  // The User page renders from the caller's admin-configured role dashboard.
  // A config-fetch failure must NOT block the page — fall back to a safe
  // minimal widget set (read-only, no admin data) and warn inline.
  const { data: dashboard, isError: dashboardError } = useQuery<{
    config: RoleDashboardConfig;
  }>({
    queryKey: ["/api/me/dashboard"],
    refetchInterval: 120000,
    retry: 1,
  });
  const dashboardConfig =
    dashboardError || !dashboard ? safeMinimalDashboardConfig() : dashboard.config;
  const enabledWidgets = new Set<WidgetKey>(dashboardConfig.widgets);
  const showWidget = (widget: WidgetKey) => enabledWidgets.has(widget);

  const now = new Date();
  const greeting = greetingForNow(now);
  const displayName = roleLabel ?? "Crew Member";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Count of flags/feedback the crew member has submitted this session.
  // Session-scoped (no submitted-feedback backend list endpoint exists),
  // so this is the honest count we can show without fabricating numbers.
  const flagCount = useMemo(() => listSessionFeedback().length, []);

  // Sidebar items are sourced from the centralised role-navigation
  // policy (Dashboard + Feedback/Flags for the user portal) — the
  // page must not re-filter or invent its own nav surface.
  const sidebarCategories = getPrimaryCategoriesForRole(role);
  const sidebarItems: OpsSidebarItem[] = sidebarCategories.map((cat) => {
    const Icon = cat.icon;
    return {
      id: cat.id,
      label: cat.id === "user-feedback" ? "Report / Flag Issue" : cat.name,
      href: cat.hubRoute,
      icon: Icon ? <Icon className="h-4 w-4" /> : undefined,
      isActive: location === cat.hubRoute,
    };
  });

  return (
    <div
      // #218: no bottom nav in the user portal, so we drop the
      // mobile bar-clearance utility and matching tall bottom
      // padding. A calm 1.5rem pad keeps content off the iOS
      // home indicator. The admin shell below still reserves
      // bar space because its bar renders.
      className="ops-surface flex min-h-screen pb-6"
      data-testid="shell-user-portal"
    >
      <OpsSidebar
        testId="sidebar-user-portal"
        brand={
          <div className="flex items-center gap-2" data-testid="brand-user-portal">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Ship className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-wide text-foreground">
                ARUS
              </div>
              <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                Marine Ops
              </div>
            </div>
          </div>
        }
        items={sidebarItems}
        footer={
          <div className="flex flex-col gap-1">
            <LogoutButton
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            />
            <SwitchPortalButton
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            />
          </div>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="ops-topbar sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-6"
          data-testid="topbar-user-portal"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground md:hidden"
                  data-testid="button-mobile-menu"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-72 flex-col gap-0 p-0"
                data-testid="sheet-mobile-nav"
              >
                <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Ship className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold tracking-wide text-foreground">
                        ARUS
                      </span>
                      <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                        Marine Ops
                      </span>
                    </span>
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Primary navigation and account actions
                  </SheetDescription>
                </SheetHeader>
                <nav
                  className="flex flex-1 flex-col gap-1 px-3 py-4"
                  aria-label="Primary"
                >
                  {sidebarItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setLocation(item.href);
                        setMobileNavOpen(false);
                      }}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        item.isActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
                      )}
                      data-testid={`mobile-nav-item-${item.id}`}
                      aria-current={item.isActive ? "page" : undefined}
                    >
                      {item.icon ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          {item.icon}
                        </span>
                      ) : null}
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </nav>
                <div className="border-t border-border/60 px-3 py-4 flex flex-col gap-1">
                  <LogoutButton
                    variant="ghost"
                    className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                  />
                  <SwitchPortalButton
                    variant="ghost"
                    className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                  />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
              My Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setLocation("/attention-inbox")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              data-testid="button-notifications"
              aria-label="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {attentionItems.length > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive"
                  data-testid="badge-notifications"
                />
              )}
            </button>
            <div
              className="flex items-center gap-2 rounded-full border border-border/60 bg-background/40 py-1 pl-1 pr-3"
              data-testid="chip-user-identity"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 leading-tight sm:block">
                <div className="truncate text-xs font-medium text-foreground">
                  {displayName}
                </div>
                <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                  {roleLabel ?? "User Portal"}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-6">
          <div className="mb-4">
            <EmergencyAlarmBanner />
          </div>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className="text-xs uppercase tracking-wide text-muted-foreground"
                data-testid="text-user-greeting-label"
              >
                {greeting},
              </div>
              <div
                className="truncate text-xl font-semibold text-foreground sm:text-2xl"
                data-testid="text-user-greeting-name"
              >
                {displayName}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Here's your operational overview for today.
              </div>
            </div>
            <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/30">
              <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
          </div>

          {dashboardError && (
            <div
              className="mb-4 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              data-testid="text-dashboard-fallback"
            >
              Showing a limited safe dashboard — your role configuration could not be
              loaded.
            </div>
          )}

          <section className="ops-card mb-4 p-4" data-testid="card-todays-overview">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Today's Overview
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OverviewTile
                icon={ClipboardList}
                label="Tasks Assigned"
                value={vm.assignedSummary.active}
                tone="bg-blue-500/15 text-blue-400"
                loading={vm.isLoading}
                testId="tile-tasks-assigned"
              />
              <OverviewTile
                icon={Bell}
                label="Alerts New"
                value={vm.activeAlerts.length}
                tone="bg-amber-500/15 text-amber-400"
                loading={vm.isLoading}
                testId="tile-alerts-new"
              />
              <OverviewTile
                icon={Flag}
                label="Flags Submitted"
                value={flagCount}
                tone="bg-violet-500/15 text-violet-400"
                loading={false}
                testId="tile-flags-submitted"
              />
              <OverviewTile
                icon={CheckCircle2}
                label="Tasks Complete"
                value={`${vm.assignedSummary.completionPct}%`}
                tone="bg-emerald-500/15 text-emerald-400"
                loading={vm.isLoading}
                testId="tile-tasks-complete"
              />
            </div>
          </section>

          <MyAssignmentsPanel />

          {showWidget("user_tasks") && (
            <section className="ops-card mb-4 p-4" data-testid="card-assigned-tasks">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ClipboardList className="h-4 w-4 text-blue-400" />
                  Assigned Tasks
                </h2>
                <button
                  type="button"
                  onClick={() => setLocation("/work-orders")}
                  className="text-xs font-medium text-primary hover:underline"
                  data-testid="link-view-all-tasks"
                >
                  View all
                </button>
              </div>
              {vm.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : vm.myTasks.length === 0 ? (
                <div
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"
                  data-testid="empty-my-tasks"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      You're all caught up
                    </div>
                    <div className="text-xs text-muted-foreground">
                      No tasks assigned to you right now.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {vm.myTasks.map((task) => (
                    <AssignedTaskRow
                      key={task.id}
                      task={task}
                      onOpen={(id) => setLocation(`/work-orders?id=${id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="ops-card mb-4 p-4" data-testid="card-user-feedback-cta">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Flag className="h-4 w-4 text-violet-400" />
                Feedback / Flags
              </h2>
              <button
                type="button"
                onClick={() => setLocation("/feedback")}
                className="text-xs font-medium text-primary hover:underline"
                data-testid="link-view-my-flags"
              >
                View mine
              </button>
            </div>
            <p className="text-sm text-foreground" data-testid="text-flag-count">
              {flagCount === 0
                ? "You have no submitted flags this session."
                : `You have ${flagCount} submitted flag${flagCount > 1 ? "s" : ""} this session.`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Spot something off? Submit feedback or flag a concern for the team.
            </p>
            <Button
              onClick={() => setLocation("/feedback")}
              className="mt-3 w-full"
              data-testid="button-user-open-feedback"
            >
              <Flag className="mr-2 h-4 w-4" />
              Submit Feedback / Flag
            </Button>
          </section>

          {(showWidget("active_alerts") || showWidget("safety_notices")) && (
            <section className="ops-card mb-4 p-4" data-testid="card-alerts-notices">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Bell className="h-4 w-4 text-amber-400" />
                  Alerts / Notices
                </h2>
                <button
                  type="button"
                  onClick={() => setLocation("/alerts")}
                  className="text-xs font-medium text-primary hover:underline"
                  data-testid="link-view-all-alerts"
                >
                  View all
                </button>
              </div>
              {vm.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : vm.activeAlerts.length === 0 && vm.safetyNotices.length === 0 ? (
                <div
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"
                  data-testid="empty-attention"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Nothing needs your attention
                    </div>
                    <div className="text-xs text-muted-foreground">
                      We'll surface alerts and safety notices here.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {showWidget("active_alerts") &&
                    vm.activeAlerts.map((alert) => (
                      <AlertNoticeRow
                        key={`alert-${alert.id}`}
                        icon={AlertTriangle}
                        tone={
                          alert.severity === "critical" || alert.severity === "high"
                            ? "bg-rose-500/15 text-rose-400"
                            : alert.severity === "medium"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-slate-500/15 text-slate-300"
                        }
                        title={alert.title}
                        meta={alert.source ?? null}
                        when={relativeTime(alert.createdAt)}
                        onOpen={() => setLocation(`/alerts?id=${alert.id}`)}
                        testId={`row-active-alert-${alert.id}`}
                      />
                    ))}
                  {showWidget("safety_notices") &&
                    vm.safetyNotices.map((notice) => (
                      <AlertNoticeRow
                        key={`notice-${notice.id}`}
                        icon={ShieldCheck}
                        tone="bg-emerald-500/15 text-emerald-400"
                        title={notice.title}
                        meta="Safety notice"
                        when={relativeTime(notice.postedAt)}
                        onOpen={() => setLocation("/safety-bulletins")}
                        testId={`row-safety-notice-${notice.id}`}
                      />
                    ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [role, setRole] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [quickWoOpen, setQuickWoOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { attentionItems } = useAttentionItems();
  const { permissions } = usePermissions();
  // DB role assignments (from /api/permissions/me) are authoritative for
  // the User/Admin page pivot. The locally-stored `role` hint is only a
  // fallback for the first paint / when the permissions call is loading
  // or errored (see resolveEffectiveRole).
  const effectiveRole = resolveEffectiveRole(permissions.roleNames, role);
  const roleConfig = effectiveRole ? ROLES[effectiveRole] : null;

  const { data: vessels } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
    enabled: isVesselRole(),
    staleTime: 5 * 60 * 1000,
  });
  const homeVesselId = isVesselRole() && vessels?.length ? vessels[0]?.id : undefined;

  useEffect(() => {
    if (role) {
      recordVisitTime();
    }
  }, [role]);

  // When no role is stored, route the user through the portal-login
  // landing page rather than the in-place RoleSelector. Portal-login
  // is the single canonical entry surface (Admin Portal / User Portal)
  // and writes the role hint via the nav-storage adapter — keeping
  // `/` reserved for the authenticated home experience.
  useEffect(() => {
    if (!role) {
      setLocation("/portal-login");
    }
  }, [role, setLocation]);

  const handleSelectRole = (roleId: string) => {
    localStorage.setItem(STORAGE_KEY, roleId);
    setRole(roleId);
  };

  // Retain the inline RoleSelector path as a fallback only if the
  // redirect hasn't committed yet (first paint). Wouter's setLocation
  // is synchronous in practice, so this renders for at most one frame.
  if (!role) {
    return <RoleSelector onSelect={handleSelectRole} />;
  }

  // Portal pivot is driven by the explicit hub-admin GRANT, not a static
  // role→portal map: a granted manager lands on the admin command center,
  // while an admin-mapped role WITHOUT the grant is sent to the user portal.
  // Super-admins are always admin; during the first paint (permissions still
  // loading) we fall back to the legacy role→portal map to avoid a flash.
  const ready = !permissions.isLoading;
  const isAdmin = isAdminPortalAccess(
    effectiveRole,
    permissions.hubAdmin || permissions.isDevMode,
    ready,
  );

  // User portal: re-skinned per UI Align Phase 4 (preview panel 2 /
  // mobile panel 9). Cards bind to the view-model in
  // client/src/application/user-dashboard. The page renders only —
  // it does not call useQuery directly and contains no RBAC checks.
  // Empty-state ids `empty-attention` / `empty-my-tasks` are
  // preserved verbatim because other surfaces and tests key off them.
  if (!isAdmin) {
    return <UserPortalHome role={effectiveRole ?? role} roleLabel={roleConfig?.label} onSwitchRole={() => {
      localStorage.removeItem(STORAGE_KEY);
      setRole(null);
    }} />;
  }

  // Admin portal: anchor the home-grid to the same 5 categories the
  // BottomNav and policy surface, instead of the legacy 8-group dump.
  // UI Align Phase 3 + 3B: re-skinned as the dark operational
  // command-center (preview panel 2). KPI counts reuse the existing
  // `useAttentionItems` query (`/api/home/attention-summary`) — no
  // new backend endpoints.
  // The portal decision above already gated on the hub-admin grant, so anchor
  // the home-grid to the role-independent admin primaries. A granted
  // non-super-admin (e.g. manager) therefore gets the real hub launchers
  // rather than the user-portal categories `getPrimaryCategoriesForRole` would
  // return for their underlying role.
  // Per-hub allow-list: `permissions.hubAccess === null` means "all hubs"
  // (super-admins / dev resolve to null server-side); a populated list
  // restricts which hubs render. Enforced here so a granted user never sees
  // a hub outside their allow-list (the route guard blocks deep-links to the
  // same hubs, so the list and the guards stay in lockstep).
  const hubAccess = permissions.hubAccess;
  const isHubAllowed = (id: string) => !hubAccess || hubAccess.includes(id);
  // Anchor to the role-independent admin primaries (the label-overridden
  // categories) and append the remaining nav categories so EVERY accessible
  // hub is listed — not just the pinned set.
  const adminPrimaries = getAdminPrimaryCategories();
  const primaryIds = new Set(adminPrimaries.map((c) => c.id));
  const otherCategories = navigationCategories.filter((c) => !primaryIds.has(c.id));
  const visibleHubs: NavigationCategory[] = [...adminPrimaries, ...otherCategories].filter((c) =>
    isHubAllowed(c.id),
  );

  // No-hubs fallback: an admin-portal account whose hub allow-list is a
  // populated-but-empty set (granted admin access, zero hubs) would
  // otherwise see a blank command center. Show a safe, explicit page with
  // profile + logout access instead. `hubAccess === null` means "all hubs"
  // (super-admin / dev) and never lands here.
  if (visibleHubs.length === 0) {
    return (
      <div
        className="ops-surface flex min-h-screen items-center justify-center px-4"
        data-testid="shell-admin-no-hubs"
      >
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
          </div>
          <h1 className="text-lg font-semibold" data-testid="text-no-hubs-title">
            No admin hubs assigned
          </h1>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="text-no-hubs-body">
            Your account has admin access but no hubs have been assigned yet.
            Contact your Super Admin to be granted a hub.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/profile")}
              data-testid="button-no-hubs-profile"
            >
              <UserCircle className="h-4 w-4" />
              Profile
            </Button>
            <LogoutButton variant="outline" />
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = roleConfig?.label ?? "Admin";

  return (
    <div
      className="ops-surface ops-safe-bottom min-h-screen pb-24 md:pb-6"
      data-testid="shell-admin-hubs"
    >
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-6 lg:max-w-5xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-2xl font-bold tracking-tight"
              data-testid="text-admin-hubs-title"
            >
              Admin Hubs
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Only permission-granted hubs appear here.
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary"
            data-testid="pill-role"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {roleLabel}
          </span>
        </header>

        <PendingApprovalsBanner />

        <div className="mt-4 space-y-3" data-testid="list-admin-hubs">
          {visibleHubs.map((hub) => {
            const Icon = hub.icon;
            return (
              <Link key={hub.id} href={hub.hubRoute}>
                <div
                  className="ops-card flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-white/5"
                  data-testid={`card-hub-${hub.id}`}
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{hub.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {hub.description}
                    </div>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
                    data-testid={`pill-granted-${hub.id}`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Granted access
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>

        <footer className="mt-6 flex items-center justify-between gap-3 border-t border-border/40 pt-4">
          <p
            className="min-w-0 text-xs text-muted-foreground"
            data-testid="text-hubs-footer"
          >
            Only accessible hubs are shown. Direct URLs are still blocked by route guards.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <LogoutButton />
            <SwitchPortalButton />
          </div>
        </footer>
      </div>
    </div>
  );
}

