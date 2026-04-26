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
} from "lucide-react";

export interface QuickActionDef {
  label: string;
  icon: any;
  href: string;
  variant?: "default" | "destructive" | "outline";
}

export interface RoleConfig {
  id: string;
  label: string;
  description: string;
  icon: any;
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
      { label: "New Work Order", icon: ClipboardCheck, href: "/work-orders?action=create" },
      { label: "Log Engine Entry", icon: BookOpen, href: "/engine-logbook?action=new" },
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
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
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
      { label: "Attention Inbox", icon: AlertTriangle, href: "/attention-inbox" },
      { label: "Diagnostics", icon: Activity, href: "/diagnostics" },
      { label: "Configuration", icon: Settings, href: "/configuration" },
      { label: "Sensor Management", icon: Activity, href: "/sensors" },
      { label: "System Admin", icon: Shield, href: "/system-administration" },
    ],
    pinnedGroups: ["system", "analytics", "operations"],
  },
};

export const ROLE_STORAGE_KEY = "arus-user-role";
