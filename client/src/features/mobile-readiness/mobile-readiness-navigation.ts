import {
  Anchor,
  AlertTriangle,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  Cog,
  FileCheck2,
  FileText,
  Folder,
  Gauge,
  Home,
  LifeBuoy,
  Package,
  RadioTower,
  Settings,
  Shield,
  Ship,
  Users,
  Wrench,
} from "lucide-react";
import type {
  MobileNavItem,
  MobileNavVariant,
  MobileRole,
  QueueItem,
  ReadinessTone,
} from "./mobile-readiness-model-types";

const roleAliases: Record<string, MobileRole> = {
  admin: "admin",
  super_admin: "admin",
  company_admin: "admin",
  captain: "captain",
  deck_officer: "captain",
  crew: "crew",
  crew_member: "crew",
  technician: "crew",
  maintenance_technician: "crew",
  viewer: "crew",
  chief_engineer: "chief_engineer",
  maintenance: "chief_engineer",
  maintenance_planner: "chief_engineer",
  safety_officer: "captain",
  logistics: "logistics",
  logistics_user: "logistics",
  procurement_user: "logistics",
};

export function normalizeMobileRole(role: string | null | undefined): MobileRole {
  return roleAliases[(role ?? "").toLowerCase()] ?? "admin";
}

export function severityRank(tone: ReadinessTone): number {
  switch (tone) {
    case "critical":
      return 60;
    case "high":
      return 50;
    case "medium":
      return 40;
    case "offline":
      return 30;
    case "normal":
      return 20;
    case "info":
      return 10;
    case "good":
      return 0;
    default:
      return 0;
  }
}

export function buildMobileReadinessNavigation(
  roleInput: string | null | undefined
): MobileNavItem[] {
  const role = normalizeMobileRole(roleInput);
  if (role === "captain") {
    return [
      { id: "bridge", label: "Bridge", href: "/", icon: Anchor },
      { id: "logs", label: "Logs", href: "/logs", icon: BookOpen },
      { id: "crew", label: "Crew", href: "/crew-management", icon: Users },
      { id: "maintenance", label: "Maintenance", href: "/pdm-platform", icon: Wrench },
      { id: "settings", label: "Settings", href: "/profile", icon: Settings },
    ];
  }
  if (role === "crew") {
    return [
      { id: "my-tasks", label: "My Tasks", href: "/", icon: ClipboardCheck },
      { id: "logs", label: "Logs", href: "/logs", icon: BookOpen },
      { id: "safety", label: "Safety", href: "/logs/compliance", icon: Shield },
      { id: "documents", label: "Documents", href: "/profile", icon: Folder },
      { id: "settings", label: "Settings", href: "/profile", icon: Settings },
    ];
  }
  if (role === "chief_engineer") {
    return [
      { id: "today", label: "Today", href: "/", icon: CalendarCheck },
      { id: "machinery", label: "Machinery", href: "/pdm-platform", icon: Wrench },
      { id: "work", label: "Work", href: "/work-orders", icon: ClipboardList },
      { id: "logs", label: "Logs", href: "/logs", icon: FileText },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  if (role === "logistics") {
    return [
      { id: "home", label: "Home", href: "/", icon: Home },
      { id: "crew", label: "Crew", href: "/crew-management", icon: Users },
      { id: "inventory", label: "Inventory", href: "/logistics", icon: Package },
      { id: "work", label: "Work", href: "/work-orders", icon: BriefcaseBusiness },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  return [
    { id: "command", label: "Command", href: "/", icon: Home },
    { id: "vessels", label: "Vessels", href: "/fleet", icon: Ship },
    { id: "tasks", label: "Tasks", href: "/work-orders", icon: ClipboardCheck },
    { id: "reports", label: "Reports", href: "/logs/compliance", icon: FileCheck2 },
    { id: "settings", label: "Settings", href: "/system", icon: Settings },
  ];
}

export function buildMobileReadinessNavigationForVariant(
  variant: MobileNavVariant,
  roleInput: string | null | undefined
): MobileNavItem[] {
  const role = normalizeMobileRole(roleInput);
  if (role === "captain" || role === "crew") {
    return buildMobileReadinessNavigation(role);
  }

  if (variant === "fleetOps") {
    return [
      { id: "fleet", label: "Fleet", href: "/fleet", icon: Ship },
      { id: "work", label: "Work", href: "/work-orders", icon: ClipboardList },
      { id: "alerts", label: "Alerts", href: "/alerts", icon: Bell },
      { id: "crew", label: "Crew", href: "/crew-management", icon: Users },
      { id: "inventory", label: "Inventory", href: "/logistics", icon: Package },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  if (variant === "machineryOps") {
    return [
      { id: "today", label: "Today", href: "/", icon: CalendarCheck },
      { id: "machinery", label: "Machinery", href: "/pdm-platform", icon: Wrench },
      { id: "work", label: "Work", href: "/work-orders", icon: ClipboardList },
      { id: "logs", label: "Logs", href: "/logs", icon: FileText },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  if (variant === "technician") {
    return [
      { id: "today", label: "Today", href: "/", icon: CalendarCheck },
      { id: "work", label: "Work", href: "/work-orders", icon: ClipboardList },
      { id: "logs", label: "Logs", href: "/logs", icon: FileText },
      { id: "profile", label: "Profile", href: "/profile", icon: Users },
    ];
  }
  if (variant === "crewOps") {
    return [
      { id: "home", label: "Home", href: "/", icon: Home },
      { id: "crew", label: "Crew", href: "/crew-management", icon: Users },
      { id: "inventory", label: "Inventory", href: "/logistics", icon: Package },
      { id: "work", label: "Work", href: "/work-orders", icon: BriefcaseBusiness },
      { id: "compliance", label: "Compliance", href: "/logs/compliance", icon: Shield },
      { id: "settings", label: "Settings", href: "/system", icon: Settings },
    ];
  }
  return buildMobileReadinessNavigation(roleInput);
}

export function sortQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}
