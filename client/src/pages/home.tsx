import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { isVesselRole } from "@/lib/briefing-redirect";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/navigation/PageHeader";
import { NavigationCard } from "@/components/navigation/NavigationCard";
import { QuickActions } from "@/components/shared/QuickActions";
import { AttentionBanner } from "@/components/shared/AttentionBanner";
import { PendingApprovalsBanner } from "@/components/shared/PendingApprovalsBanner";
import { QuickWorkOrderSheet } from "@/components/work-orders/QuickWorkOrderSheet";
import { homePageGroups, type HomePageGroup } from "@/config/navigationConfig";
import { trackPageVisit, getLastVisitTime, recordVisitTime } from "@/lib/pageTracking";
import { getBriefingRedirect, markRoleJustSelected, clearRoleJustSelected } from "@/lib/briefing-redirect";
import {
  ChevronRight, History, Plus,
} from "lucide-react";
import { ROLES, ROLE_STORAGE_KEY } from "@/config/roles";
import type { RoleConfig } from "@/config/roles";

export { trackPageVisit };
export type { RoleConfig };

const STORAGE_KEY = ROLE_STORAGE_KEY;

function RoleSelector({ onSelect }: { onSelect: (roleId: string) => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-welcome-title">Welcome to ARUS</h1>
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
    if (!summary) return [];
    const items: Array<{ label: string; count: number; severity: string; href: string }> = [];

    if (summary.overdueWorkOrders > 0) {
      items.push({ label: "Overdue work orders", count: summary.overdueWorkOrders, severity: "critical", href: "/work-orders?status=overdue" });
    }
    if (summary.unacknowledgedAlerts > 0) {
      items.push({ label: "Unacknowledged alerts", count: summary.unacknowledgedAlerts, severity: "warning", href: "/dashboard" });
    }
    if (summary.highRiskEquipment > 0) {
      items.push({ label: "High-risk equipment", count: summary.highRiskEquipment, severity: "warning", href: "/pdm-dashboard" });
    }

    return items;
  }, [summary]);

  return { attentionItems, sinceLastVisit: summary?.newSinceLastVisit };
}

function SinceLastVisit({ data }: { data: { newAlerts: number; newWorkOrders: number; completedWorkOrders: number } }) {
  const total = data.newAlerts + data.newWorkOrders + data.completedWorkOrders;
  if (total === 0) return null;

  return (
    <div className="mb-6 p-4 rounded-lg border bg-card" data-testid="section-since-last-visit">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Since Your Last Visit</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.newAlerts > 0 && (
          <div className="text-center p-2 rounded bg-yellow-500/10">
            <div className="text-lg font-bold text-yellow-600" data-testid="text-new-alerts">{data.newAlerts}</div>
            <div className="text-xs text-muted-foreground">New Alerts</div>
          </div>
        )}
        {data.newWorkOrders > 0 && (
          <div className="text-center p-2 rounded bg-blue-500/10">
            <div className="text-lg font-bold text-blue-600" data-testid="text-new-work-orders">{data.newWorkOrders}</div>
            <div className="text-xs text-muted-foreground">New Work Orders</div>
          </div>
        )}
        {data.completedWorkOrders > 0 && (
          <div className="text-center p-2 rounded bg-green-500/10">
            <div className="text-lg font-bold text-green-600" data-testid="text-completed-work-orders">{data.completedWorkOrders}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MyTasks() {
  const { data: myWorkOrders } = useQuery({
    queryKey: ["/api/work-orders", { assignedToMe: "true", status: "open" }],
    refetchInterval: 60000,
  });

  const [, setLocation] = useLocation();
  const tasks = Array.isArray(myWorkOrders) ? myWorkOrders.slice(0, 5) : [];

  if (tasks.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">My Tasks</h2>
        <button
          onClick={() => setLocation("/work-orders?assignedToMe=true")}
          data-testid="link-view-all-tasks"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        {tasks.map((task: any) => (
          <button
            key={task.id}
            onClick={() => setLocation(`/work-orders?id=${task.id}`)}
            data-testid={`button-task-${task.id}`}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border
                       bg-card hover:border-primary/50 transition-colors text-left touch-target"
          >
            <div className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              task.priority === 1 ? "bg-destructive" :
              task.priority === 2 ? "bg-yellow-500" : "bg-muted-foreground"
            )} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{task.title}</div>
              <div className="text-xs text-muted-foreground">
                {task.equipmentName || task.equipment?.name || "Unassigned equipment"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex-shrink-0">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [, navigate] = useLocation();
  const [role, setRole] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [quickWoOpen, setQuickWoOpen] = useState(false);

  const { attentionItems, sinceLastVisit } = useAttentionItems();
  const roleConfig = role ? ROLES[role] : null;
  const briefingRedirect = role ? getBriefingRedirect() : null;

  const { data: vessels } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
    enabled: isVesselRole(),
    staleTime: 5 * 60 * 1000,
  });
  const homeVesselId = isVesselRole() && vessels?.length ? vessels[0].id : undefined;

  useEffect(() => {
    if (role) {
      recordVisitTime();
    }
  }, [role]);

  useEffect(() => {
    if (briefingRedirect) {
      clearRoleJustSelected();
      navigate(briefingRedirect);
    }
  }, [briefingRedirect, navigate]);

  const handleSelectRole = (roleId: string) => {
    localStorage.setItem(STORAGE_KEY, roleId);
    markRoleJustSelected();
    setRole(roleId);
  };

  if (!role) {
    return <RoleSelector onSelect={handleSelectRole} />;
  }

  if (briefingRedirect) {
    return null;
  }

  const pinnedGroupIds = roleConfig?.pinnedGroups ?? homePageGroups.map((g) => g.id);
  const pinnedGroups = pinnedGroupIds
    .map((id) => homePageGroups.find((g) => g.id === id))
    .filter(Boolean) as HomePageGroup[];
  const otherGroups = homePageGroups.filter((g) => !pinnedGroupIds.includes(g.id));

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      <PageHeader
        title="ARUS"
        subtitle={roleConfig?.label}
        showHome={false}
        showBack={true}
        onBack={() => {
          localStorage.removeItem(STORAGE_KEY);
          setRole(null);
        }}
      />

      <PendingApprovalsBanner />

      <div className="px-4 lg:px-6 pt-2">
        {attentionItems.length > 0 && (
          <AttentionBanner items={attentionItems} className="mb-4" />
        )}

        {roleConfig && (
          <QuickActions actions={roleConfig.quickActions} className="mb-6" />
        )}

        {sinceLastVisit && <SinceLastVisit data={sinceLastVisit} />}

        <MyTasks />

        <div className="space-y-6">
          {pinnedGroups.map((group) => (
            <div key={group.id}>
              <h2 className="text-sm font-semibold text-foreground mb-3">{group.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.items.map((item) => (
                  <NavigationCard
                    key={item.href}
                    name={item.name}
                    href={item.href}
                    icon={item.icon}
                    description={item.description}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {otherGroups.length > 0 && (
          <details className="mt-8">
            <summary
              className="text-sm font-semibold text-muted-foreground cursor-pointer hover:text-foreground mb-3"
              data-testid="button-more-categories"
            >
              More categories ({otherGroups.length})
            </summary>
            <div className="space-y-6 mt-3">
              {otherGroups.map((group) => (
                <div key={group.id}>
                  <h2 className="text-sm font-semibold text-foreground mb-3">{group.name}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {group.items.map((item) => (
                      <NavigationCard
                        key={item.href}
                        name={item.name}
                        href={item.href}
                        icon={item.icon}
                        description={item.description}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <button
        onClick={() => setQuickWoOpen(true)}
        className="fixed bottom-20 left-4 md:bottom-6 md:left-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-40"
        aria-label="Quick Work Order"
        data-testid="button-quick-wo"
      >
        <Plus className="h-6 w-6" />
      </button>

      <QuickWorkOrderSheet
        open={quickWoOpen}
        onClose={() => setQuickWoOpen(false)}
        vesselId={homeVesselId}
      />
    </div>
  );
}
