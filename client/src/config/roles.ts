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
  super_admin: {
    id: "super_admin",
    label: "Super Admin",
    description: "All hubs, access control, safety configuration",
    icon: Shield,
    quickActions: [
      { label: "Crew Management", icon: Shield, href: "/crew-management" },
      { label: "System Admin", icon: Settings, href: "/system-administration" },
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
    ],
    pinnedGroups: ["system", "crew", "analytics", "maintenance", "logistics"],
  },
  admin: {
    id: "admin",
    label: "Administrator",
    description: "Crew, access, safety, and system management",
    icon: Settings,
    quickActions: [
      { label: "Crew Management", icon: Shield, href: "/crew-management" },
      { label: "Configuration", icon: Settings, href: "/configuration" },
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
    ],
    pinnedGroups: ["system", "crew", "maintenance", "analytics"],
  },
  company_admin: {
    id: "company_admin",
    label: "Company Admin",
    description: "Company-wide administration and permissions",
    icon: Shield,
    quickActions: [
      { label: "Crew Management", icon: Shield, href: "/crew-management" },
      { label: "System Admin", icon: Settings, href: "/system-administration" },
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
    ],
    pinnedGroups: ["system", "crew", "analytics", "maintenance", "logistics"],
  },
  chief_engineer: {
    id: "chief_engineer",
    label: "Chief Engineer",
    description: "Work orders, equipment health, PdM alerts",
    icon: Wrench,
    quickActions: [
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "New Work Order", icon: ClipboardCheck, href: "/work-orders?action=create" },
      { label: "Log Engine Entry", icon: BookOpen, href: "/logs?tab=engine&action=new" },
      {
        label: "Report Defect",
        icon: AlertTriangle,
        href: "/work-orders?action=create&type=corrective",
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
      { label: "Record Rest Hours", icon: Clock, href: "/hours-of-rest?action=record" },
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
      { label: "Fleet Dashboard", icon: Gauge, href: "/" },
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
      { label: "Configuration", icon: Settings, href: "/configuration" },
      { label: "Sensor Management", icon: Activity, href: "/sensors" },
      { label: "System Admin", icon: Shield, href: "/system-administration" },
    ],
    pinnedGroups: ["system", "analytics", "operations"],
  },
  vessel_master: {
    id: "vessel_master",
    label: "Vessel Master",
    description: "Vessel command, crew readiness, safety",
    icon: Ship,
    quickActions: [
      { label: "Crew Management", icon: Shield, href: "/crew-management" },
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "New Deck Entry", icon: BookOpen, href: "/logs?tab=deck&action=new" },
    ],
    pinnedGroups: ["crew", "operations", "records", "fleet"],
  },
  supervisor: {
    id: "supervisor",
    label: "Supervisor",
    description: "Crew coordination and assigned work",
    icon: ClipboardCheck,
    quickActions: [
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "Work Orders", icon: ClipboardCheck, href: "/work-orders" },
      { label: "Crew Schedule", icon: Clock, href: "/crew-scheduler" },
    ],
    pinnedGroups: ["operations", "crew", "maintenance"],
  },
  safety_officer: {
    id: "safety_officer",
    label: "Safety Officer",
    description: "Safety alarms, acknowledgements, compliance",
    icon: Shield,
    quickActions: [
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "Crew Management", icon: Shield, href: "/crew-management" },
      { label: "Compliance", icon: Shield, href: "/logs?tab=compliance" },
    ],
    pinnedGroups: ["crew", "records", "operations"],
  },
  logistics_user: {
    id: "logistics_user",
    label: "Logistics User",
    description: "Inventory, purchasing, and vessel supplies",
    icon: ClipboardCheck,
    quickActions: [
      { label: "Inventory", icon: ClipboardCheck, href: "/inventory-management" },
      { label: "Logistics Hub", icon: ClipboardCheck, href: "/logistics" },
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
    ],
    pinnedGroups: ["logistics", "maintenance", "fleet"],
  },
  crew_member: {
    id: "crew_member",
    label: "Crew Member",
    description: "Personal tasks, vessel assignment, safety",
    icon: Ship,
    quickActions: [
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "My Tasks", icon: ClipboardCheck, href: "/work-orders" },
      { label: "Rest Hours", icon: Clock, href: "/hours-of-rest" },
    ],
    pinnedGroups: ["operations", "crew", "records"],
  },
  viewer: {
    id: "viewer",
    label: "Viewer",
    description: "Read-only operational access",
    icon: Gauge,
    quickActions: [
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "Fleet Dashboard", icon: Gauge, href: "/" },
    ],
    pinnedGroups: ["operations", "fleet", "analytics"],
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
