import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/navigation/PageHeader";
import { NavigationCard } from "@/components/navigation/NavigationCard";
import { QuickActions } from "@/components/shared/QuickActions";
import { AttentionBanner } from "@/components/shared/AttentionBanner";
import { homePageGroups, type HomePageGroup } from "@/config/navigationConfig";
import {
  Wrench, AlertTriangle, Clock, Activity, Ship, Shield,
  ClipboardCheck, Anchor, BookOpen, BarChart3, Settings,
  ChevronRight, Gauge,
} from "lucide-react";

export interface RoleConfig {
  id: string;
  label: string;
  description: string;
  icon: any;
  quickActions: QuickActionDef[];
  pinnedGroups: string[];
}

interface QuickActionDef {
  label: string;
  icon: any;
  href: string;
  variant?: "default" | "destructive" | "outline";
}

const ROLES: Record<string, RoleConfig> = {
  chief_engineer: {
    id: "chief_engineer",
    label: "Chief Engineer",
    description: "Work orders, equipment health, PdM alerts",
    icon: Wrench,
    quickActions: [
      { label: "New Work Order", icon: ClipboardCheck, href: "/work-orders?action=create" },
      { label: "Log Engine Entry", icon: BookOpen, href: "/engine-logbook?action=new" },
      { label: "Report Defect", icon: AlertTriangle, href: "/work-orders?action=create&type=corrective" },
      { label: "Check PdM Alerts", icon: Activity, href: "/pdm-dashboard" },
    ],
    pinnedGroups: ["maintenance", "operations", "fleet"],
  },
  deck_officer: {
    id: "deck_officer",
    label: "Deck Officer",
    description: "Logbooks, STCW hours, vessel track, weather",
    icon: Anchor,
    quickActions: [
      { label: "New Deck Entry", icon: BookOpen, href: "/deck-logbook?action=new" },
      { label: "Record Rest Hours", icon: Clock, href: "/hours-of-rest?action=record" },
      { label: "Vessel Position", icon: Ship, href: "/vessel-track-log" },
      { label: "Compliance Check", icon: Shield, href: "/logs-compliance" },
    ],
    pinnedGroups: ["records", "crew", "operations"],
  },
  fleet_manager: {
    id: "fleet_manager",
    label: "Fleet Manager (Shore)",
    description: "Fleet health, CII compliance, analytics, costs",
    icon: BarChart3,
    quickActions: [
      { label: "Fleet Dashboard", icon: Gauge, href: "/dashboard" },
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
      { label: "Scheduled Reports", icon: ClipboardCheck, href: "/scheduled-reports" },
      { label: "Governance", icon: Shield, href: "/governance-dashboard" },
    ],
    pinnedGroups: ["operations", "analytics", "fleet"],
  },
  system_admin: {
    id: "system_admin",
    label: "System Admin",
    description: "Diagnostics, configuration, sensors, users",
    icon: Settings,
    quickActions: [
      { label: "Diagnostics", icon: Activity, href: "/diagnostics" },
      { label: "Configuration", icon: Settings, href: "/configuration" },
      { label: "Sensor Management", icon: Activity, href: "/sensors" },
      { label: "System Admin", icon: Shield, href: "/system-administration" },
    ],
    pinnedGroups: ["system", "analytics", "operations"],
  },
};

const STORAGE_KEY = "arus-user-role";

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
  const { data: workOrderData } = useQuery({
    queryKey: ["/api/work-orders/summary"],
    refetchInterval: 60000,
  });

  const { data: alertData } = useQuery({
    queryKey: ["/api/alerts?acknowledged=false"],
    refetchInterval: 30000,
  });

  const { data: pdmData } = useQuery({
    queryKey: ["/api/pdm-dashboard/risk-queue"],
    refetchInterval: 120000,
  });

  return useMemo(() => {
    const items: Array<{ label: string; count: number; severity: string; href: string }> = [];

    const overdueWO = (workOrderData as any)?.overdue ?? (workOrderData as any)?.overdueCount ?? 0;
    if (overdueWO > 0) {
      items.push({ label: "Overdue work orders", count: overdueWO, severity: "critical", href: "/work-orders?status=overdue" });
    }

    const unackAlerts = Array.isArray(alertData) ? alertData.length : ((alertData as any)?.count ?? 0);
    if (unackAlerts > 0) {
      items.push({ label: "Unacknowledged alerts", count: unackAlerts, severity: "warning", href: "/dashboard" });
    }

    const highRiskEquipment = Array.isArray(pdmData) ? pdmData.filter((e: any) => e.riskLevel === "high" || e.riskLevel === "critical").length : 0;
    if (highRiskEquipment > 0) {
      items.push({ label: "High-risk equipment", count: highRiskEquipment, severity: "warning", href: "/pdm-dashboard" });
    }

    return items;
  }, [workOrderData, alertData, pdmData]);
}

function MyTasks() {
  const { data: myWorkOrders } = useQuery({
    queryKey: ["/api/work-orders?assignedToMe=true&status=open"],
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

const RECENT_PAGES_KEY = "arus-recent-pages";
const MAX_RECENT = 6;

export function trackPageVisit(path: string) {
  try {
    const stored = localStorage.getItem(RECENT_PAGES_KEY);
    const recent: string[] = stored ? JSON.parse(stored) : [];
    const filtered = recent.filter((p) => p !== path);
    filtered.unshift(path);
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

export default function HomePage() {
  const [role, setRole] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  const attentionItems = useAttentionItems();
  const roleConfig = role ? ROLES[role] : null;

  const handleSelectRole = (roleId: string) => {
    localStorage.setItem(STORAGE_KEY, roleId);
    setRole(roleId);
  };

  if (!role) {
    return <RoleSelector onSelect={handleSelectRole} />;
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
        action={
          <button
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setRole(null);
            }}
            data-testid="button-change-role"
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
          >
            Change role
          </button>
        }
      />

      <div className="px-4 lg:px-6 pt-2">
        {attentionItems.length > 0 && (
          <AttentionBanner items={attentionItems} className="mb-4" />
        )}

        {roleConfig && (
          <QuickActions actions={roleConfig.quickActions} className="mb-6" />
        )}

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
    </div>
  );
}
