import {
  Wrench,
  AlertTriangle,
  Clock,
  Activity,
  Ship,
  Shield,
  ClipboardCheck,
  Anchor,
  BookOpen,
  BarChart3,
  Settings,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export interface QuickActionDef {
  label: string;
  icon: LucideIcon;
  href: string;
  variant?: "default" | "destructive" | "outline";
}

export interface RoleConfig {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  quickActions: QuickActionDef[];
  pinnedGroups: string[];
}

export const ROLES: Record<string, RoleConfig> = {
  chief_engineer: {
    id: "chief_engineer",
    label: "Chief Engineer",
    description: "Work orders, equipment health, PdM alerts",
    icon: Wrench,
    quickActions: [
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "New Work Order", icon: ClipboardCheck, href: "/maint?tab=work-orders&action=create" },
      { label: "Log Engine Entry", icon: BookOpen, href: "/logs?tab=engine&action=new" },
      {
        label: "Report Defect",
        icon: AlertTriangle,
        href: "/maint?tab=work-orders&action=create&type=corrective",
      },
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
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "New Deck Entry", icon: BookOpen, href: "/logs?tab=deck&action=new" },
      { label: "Record Rest Hours", icon: Clock, href: "/crew?tab=rest-hours&action=record" },
      { label: "Vessel Position", icon: Ship, href: "/logs?tab=deck" },
      { label: "Compliance Check", icon: Shield, href: "/logs?tab=compliance" },
    ],
    pinnedGroups: ["records", "crew", "operations"],
  },
  fleet_manager: {
    id: "fleet_manager",
    label: "Fleet Manager (Shore)",
    description: "Fleet health, CII compliance, analytics, costs",
    icon: BarChart3,
    quickActions: [
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "Fleet Dashboard", icon: Gauge, href: "/dashboard" },
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
      { label: "Scheduled Reports", icon: ClipboardCheck, href: "/scheduled-reports" },
      { label: "Governance", icon: Shield, href: "/logs?tab=compliance" },
    ],
    pinnedGroups: ["operations", "analytics", "fleet"],
  },
  system_admin: {
    id: "system_admin",
    label: "System Admin",
    description: "Diagnostics, configuration, sensors, users",
    icon: Settings,
    quickActions: [
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "Diagnostics", icon: Activity, href: "/diagnostics" },
      { label: "Configuration", icon: Settings, href: "/system?tab=configuration" },
      { label: "Sensor Management", icon: Activity, href: "/system?tab=sensors" },
      { label: "System Admin", icon: Shield, href: "/system?tab=admin" },
    ],
    pinnedGroups: ["system", "analytics", "operations"],
  },
};

export const ROLE_STORAGE_KEY = "arus-user-role";

/**
 * localStorage key for the per-user BottomNav category override.
 *
 * The stored value is treated strictly as a CACHE / personalisation
 * hint — never authority. `role-navigation-policy.ts` is the only
 * source of truth for which categories a role may see; the override
 * may only reorder or subset that allowed set. See
 * `intersectOverrideWithPolicy()` in role-navigation-policy.ts and
 * BottomNav.tsx for the enforcement point.
 *
 * Centralised here so portal-login, SwitchPortalButton, and BottomNav
 * all use the same string. Previously inlined as a magic string in
 * three places (follow-up #194 leak surface).
 */
export const BOTTOM_NAV_OVERRIDE_STORAGE_KEY = "arus-bottom-nav-items";
